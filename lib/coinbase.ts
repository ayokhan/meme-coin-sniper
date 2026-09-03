/**
 * Coinbase Futures via Advanced Trade CFM (US/Canada regulated futures).
 * Canada and US CFM use api.coinbase.com — not the Global Derivatives Deribit gateway.
 * Auth: per-request CDP JWT with `uri` claim (ES256 ECDSA).
 */

import crypto from "crypto";

const ADVANCED_TRADE_HOST = "api.coinbase.com";

/** Known CFM perpetual product IDs (nano-style, far-dated). */
const CFM_PERP_BY_SYMBOL: Record<string, string> = {
  BTC: "BIP-20DEC30-CDE",
  XBT: "BIP-20DEC30-CDE",
  ETH: "ETP-20DEC30-CDE",
  SOL: "SLP-20DEC30-CDE",
  XRP: "XPP-20DEC30-CDE",
  DOGE: "DOP-20DEC30-CDE",
  AVAX: "AVP-20DEC30-CDE",
};

export type CoinbaseConfig = {
  apiKeyName: string;
  apiSecret: string;
  demo: boolean;
};

/** Leverage remembered between setLeverage() and place*Order() (CFM applies leverage per order). */
const leverageByInst = new Map<string, number>();

function base64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Parse CDP portal download JSON: `{ "id"|"name", "privateKey" }`. */
export function parseCdpApiKeyDownload(raw: string): { apiKeyId: string; privateKey: string } | null {
  const trimmed = raw.trim().replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as { id?: unknown; name?: unknown; privateKey?: unknown };
    const apiKeyId =
      typeof parsed.id === "string" && parsed.id.trim()
        ? parsed.id.trim()
        : typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : "";
    const privateKey = typeof parsed.privateKey === "string" ? parsed.privateKey.trim() : "";
    if (!apiKeyId || !privateKey) return null;
    return { apiKeyId, privateKey: privateKey.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

function isEd25519Base64Secret(secret: string): boolean {
  try {
    const decoded = Buffer.from(secret.replace(/\s+/g, ""), "base64");
    return decoded.length === 64;
  } catch {
    return false;
  }
}

/** Normalize CDP private key — PEM (EC), base64 Ed25519, or full CDP JSON download. */
export function normalizeCoinbasePrivateKeyPem(secret: string): string {
  let s = secret.trim().replace(/^\uFEFF/, "");
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const fromJson = parseCdpApiKeyDownload(s);
  if (fromJson) s = fromJson.privateKey;

  if (!s.includes("\n") && /-----BEGIN/.test(s)) {
    s = s
      .replace(/-----BEGIN ([^-]+)-----/g, "-----BEGIN $1-----\n")
      .replace(/-----END ([^-]+)-----/g, "\n-----END $1-----")
      .replace(/\n+/g, "\n")
      .trim();
  }

  const pemMatch = s.match(/^(-----BEGIN [^-]+-----)\n([\s\S]*?)\n(-----END [^-]+-----)\s*$/);
  if (pemMatch) {
    const body = pemMatch[2].replace(/\s+/g, "");
    const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
    s = `${pemMatch[1]}\n${wrapped}\n${pemMatch[3]}`;
  }

  return s;
}

function friendlyCoinbaseKeyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("DECODER") || msg.includes("unsupported") || /PEM|private key|asn1/i.test(msg)) {
    return (
      "Coinbase private key could not be read. Paste the CDP download JSON (id + privateKey), " +
      "or an EC PEM (-----BEGIN EC PRIVATE KEY-----), or the Ed25519 base64 privateKey from the CDP portal."
    );
  }
  return msg;
}

function loadEd25519SigningKey(base64Secret: string): crypto.KeyObject {
  const decoded = Buffer.from(base64Secret.replace(/\s+/g, ""), "base64");
  if (decoded.length !== 64) {
    throw new Error("Invalid Ed25519 key length — expected 64-byte base64 privateKey from CDP.");
  }
  const seed = decoded.subarray(0, 32);
  const publicKey = decoded.subarray(32);
  return crypto.createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      d: seed.toString("base64url"),
      x: publicKey.toString("base64url"),
    },
    format: "jwk",
  });
}

/** Load Coinbase CDP signing key — EC (ES256) or Ed25519 (EdDSA). */
export function loadCoinbaseSigningKey(secret: string): crypto.KeyObject {
  const normalized = normalizeCoinbasePrivateKeyPem(secret);
  if (!normalized) throw new Error("Coinbase private key is empty.");

  if (!/-----BEGIN/.test(normalized) && isEd25519Base64Secret(normalized)) {
    return loadEd25519SigningKey(normalized);
  }

  const attempts: crypto.PrivateKeyInput[] = [{ key: normalized, format: "pem" }];
  if (/BEGIN EC PRIVATE KEY/i.test(normalized)) {
    attempts.push({ key: normalized.replace(/EC PRIVATE KEY/gi, "PRIVATE KEY"), format: "pem" });
  } else if (/BEGIN PRIVATE KEY/i.test(normalized)) {
    attempts.push({ key: normalized.replace(/PRIVATE KEY/gi, "EC PRIVATE KEY"), format: "pem" });
  }

  const body = normalized.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(body) && body.length > 40) {
    const der = Buffer.from(body, "base64");
    attempts.push({ key: der, format: "der", type: "pkcs8" });
    attempts.push({ key: der, format: "der", type: "sec1" });
  }

  let lastErr: unknown;
  for (const input of attempts) {
    try {
      const key = crypto.createPrivateKey(input);
      if (key.asymmetricKeyType !== "ec" && key.asymmetricKeyType !== "ed25519") {
        throw new Error(
          `Expected an EC or Ed25519 private key for Coinbase CDP, got ${key.asymmetricKeyType ?? "unknown"}.`
        );
      }
      return key;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(friendlyCoinbaseKeyError(lastErr));
}

export function validateCoinbasePrivateKey(
  secret: string
): { ok: true; pem: string } | { ok: false; error: string } {
  try {
    const raw = secret.trim();
    if (!raw) return { ok: false, error: "Private key is required." };

    const fromJson = parseCdpApiKeyDownload(raw);
    const material = fromJson?.privateKey ?? normalizeCoinbasePrivateKeyPem(raw);

    if (!/-----BEGIN/.test(material) && !isEd25519Base64Secret(material)) {
      return {
        ok: false,
        error:
          "Paste your CDP download JSON file contents, the Ed25519 privateKey (base64), or an EC PEM starting with -----BEGIN EC PRIVATE KEY-----. A short HMAC API secret will not work.",
      };
    }

    if (/BEGIN\s+PUBLIC\s+KEY/i.test(material)) {
      return { ok: false, error: "That is a PUBLIC key. Paste the CDP private key instead." };
    }
    loadCoinbaseSigningKey(material);
    return { ok: true, pem: material };
  } catch (e) {
    return { ok: false, error: friendlyCoinbaseKeyError(e) };
  }
}

/** Create a short-lived CDP JWT for Advanced Trade (must include uri). */
export function createAdvancedTradeJwt(
  apiKeyName: string,
  privateKeyMaterial: string,
  method: string,
  requestPath: string
): string {
  const normalized = normalizeCoinbasePrivateKeyPem(privateKeyMaterial);
  const useEd = !/-----BEGIN/.test(normalized) && isEd25519Base64Secret(normalized);
  const key = useEd ? loadEd25519SigningKey(normalized) : loadCoinbaseSigningKey(normalized);
  const nonce = crypto.randomBytes(16).toString("hex");
  const header = {
    alg: useEd ? "EdDSA" : "ES256",
    kid: apiKeyName,
    typ: "JWT",
    nonce,
  };
  const now = Math.floor(Date.now() / 1000);
  const pathOnly = requestPath.split("?")[0] || requestPath;
  const payload = {
    sub: apiKeyName,
    iss: "cdp",
    nbf: now,
    exp: now + 120,
    uri: `${method.toUpperCase()} ${ADVANCED_TRADE_HOST}${pathOnly}`,
  };
  const signingInput = `${base64urlEncode(JSON.stringify(header))}.${base64urlEncode(JSON.stringify(payload))}`;

  if (useEd) {
    const sig = crypto.sign(null, Buffer.from(signingInput), key);
    return `${signingInput}.${base64urlEncode(sig)}`;
  }

  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  sign.end();
  const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64urlEncode(sig)}`;
}

/** @deprecated Prefer createAdvancedTradeJwt — kept for scripts that exchange against drb. */
export function createCdpJwt(apiKeyName: string, privateKeyMaterial: string): string {
  return createAdvancedTradeJwt(apiKeyName, privateKeyMaterial, "GET", "/api/v3/brokerage/cfm/balance_summary");
}

export function getConfig(): CoinbaseConfig | null {
  const apiKeyName = process.env.COINBASE_API_KEY_NAME?.trim();
  const apiSecretRaw = process.env.COINBASE_API_SECRET?.trim();
  if (!apiKeyName || !apiSecretRaw) return null;
  const demo = process.env.COINBASE_SANDBOX_MODE === "true";
  const keyCheck = validateCoinbasePrivateKey(apiSecretRaw);
  return {
    apiKeyName,
    apiSecret: keyCheck.ok ? keyCheck.pem : normalizeCoinbasePrivateKeyPem(apiSecretRaw),
    demo,
  };
}

export function isCoinbaseConfigured(): boolean {
  return !!getConfig();
}

export function formatCoinbaseApiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("DECODER") || msg.includes("unsupported")) {
    return (
      "Coinbase private key could not be read. For Futures, create a CDP key with signature algorithm ECDSA, " +
      "then set COINBASE_API_KEY_NAME to the key id/name and COINBASE_API_SECRET to the PEM private key."
    );
  }
  if (/invalid_credentials|invalid credentials|unauthorized|authentication/i.test(msg)) {
    return (
      "Coinbase rejected the API key. Use an ECDSA CDP key, set COINBASE_API_KEY_NAME + COINBASE_API_SECRET, " +
      "and ensure Futures / CFM is enabled for this Coinbase account (Canada/US CFM uses Advanced Trade)."
    );
  }
  return msg;
}

async function advancedTradeRequest<T>(
  config: CoinbaseConfig,
  method: string,
  pathWithQuery: string,
  body?: unknown
): Promise<T> {
  const pathOnly = pathWithQuery.split("?")[0] || pathWithQuery;
  const fullPath = pathWithQuery.startsWith("/api/")
    ? pathWithQuery
    : `/api/v3/brokerage${pathWithQuery.startsWith("/") ? "" : "/"}${pathWithQuery}`;
  const jwtPath = fullPath.startsWith("/api/") ? fullPath.split("?")[0]! : `/api/v3/brokerage${pathOnly}`;
  let jwt: string;
  try {
    jwt = createAdvancedTradeJwt(config.apiKeyName, config.apiSecret, method, jwtPath);
  } catch (e) {
    throw new Error(formatCoinbaseApiError(e));
  }
  const url = fullPath.startsWith("http") ? fullPath : `https://${ADVANCED_TRADE_HOST}${fullPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { message: text.slice(0, 300) };
  }
  if (!res.ok) {
    const errMsg =
      (typeof json.message === "string" && json.message) ||
      (typeof json.error === "string" && json.error) ||
      `Coinbase HTTP ${res.status}`;
    throw new Error(formatCoinbaseApiError(new Error(errMsg)));
  }
  return json as T;
}

/** Quick connectivity check against CFM balance summary. */
export async function getAccessToken(config: CoinbaseConfig): Promise<string> {
  await advancedTradeRequest(config, "GET", "/api/v3/brokerage/cfm/balance_summary");
  return "cfm-ok";
}

/** Map symbol (BTC, BTC/USDT, BTC_USDC-PERPETUAL) → CFM product id e.g. BIP-20DEC30-CDE. */
export function toCoinbaseInstrument(symbol: string, _marginCurrency = "USDC"): string {
  const raw = symbol.trim().toUpperCase();
  if (/-CDE$/i.test(raw) || /-INTX$/i.test(raw)) return raw;
  if (CFM_PERP_BY_SYMBOL[raw]) return CFM_PERP_BY_SYMBOL[raw]!;

  const base = raw.includes("/")
    ? raw.split("/")[0]!
    : raw.includes("_")
      ? raw.split("_")[0]!
      : raw.includes("-")
        ? raw.split("-")[0]!
        : raw;
  const mapped = CFM_PERP_BY_SYMBOL[base];
  if (mapped) return mapped;
  // Fallback: leave as-is so explicit product ids still work.
  return raw;
}

/** Display symbol from CFM / legacy instrument name. */
export function fromCoinbaseInstrument(instId: string): string {
  const upper = instId.toUpperCase();
  for (const [sym, pid] of Object.entries(CFM_PERP_BY_SYMBOL)) {
    if (pid === upper && sym !== "XBT") return sym;
  }
  const m = instId.match(/^([A-Z0-9]+)_[A-Z]+-PERPETUAL$/i);
  if (m) return m[1]!;
  const cde = instId.match(/^([A-Z]{2,4})-.*-CDE$/i);
  if (cde) {
    const code = cde[1]!.toUpperCase();
    if (code === "BIP") return "BTC";
    if (code === "ETP") return "ETH";
    if (code === "SLP") return "SOL";
    if (code === "XPP") return "XRP";
    if (code === "DOP") return "DOGE";
    if (code === "AVP") return "AVAX";
  }
  return instId.replace(/_USDC-PERPETUAL$/i, "").replace(/-PERPETUAL$/i, "");
}

export function toCoinbaseBar(timeframe: string): string {
  const t = timeframe.trim();
  const map: Record<string, string> = {
    "1m": "ONE_MINUTE",
    "1": "ONE_MINUTE",
    "5m": "FIVE_MINUTE",
    "5": "FIVE_MINUTE",
    "15m": "FIFTEEN_MINUTE",
    "15": "FIFTEEN_MINUTE",
    "30m": "THIRTY_MINUTE",
    "30": "THIRTY_MINUTE",
    "1h": "ONE_HOUR",
    "60": "ONE_HOUR",
    "2h": "TWO_HOUR",
    "4h": "FOUR_HOUR",
    "6h": "SIX_HOUR",
    "1D": "ONE_DAY",
    "1d": "ONE_DAY",
  };
  return map[t] ?? "FIFTEEN_MINUTE";
}

/** Candle: [ts, open, high, low, close, vol] — Blofin-compatible shape for trading-bot-run. */
export type Candle = [string, string, string, string, string, string, string, string, string];

export type PositionRow = {
  instId: string;
  posSide: string;
  pos: string;
  avgPx: string;
  rawPositionSide?: string;
  liqPx?: string | null;
  margin?: string | null;
  imr?: string | null;
  mgnRatio?: string | null;
  upl?: string | null;
  unrealizedPnlRatio?: string | null;
  leverage?: string | null;
  marginMode?: string | null;
  markPx?: string | null;
};

export type CoinbaseInstrumentInfo = {
  minSize: string;
  contractValue: string;
  settleCurrency: string;
  tickSize: string;
  lotSize: string;
  maxLeverage: string;
  maxMarketSize: string;
  state: string;
  assetClass: string;
};

function mapCfmPosition(p: Record<string, unknown>): PositionRow | null {
  const instId = String(p.product_id ?? "");
  const contracts = parseFloat(String(p.number_of_contracts ?? "0"));
  if (!Number.isFinite(contracts) || contracts === 0) return null;
  const sideRaw = String(p.side ?? "").toUpperCase();
  const posSide = sideRaw.includes("SHORT") ? "short" : "long";
  const avgPx = String(p.avg_entry_price ?? "0");
  const markPx = p.current_price != null ? String(p.current_price) : undefined;
  const upl = p.unrealized_pnl != null ? String(p.unrealized_pnl) : undefined;
  return {
    instId,
    posSide,
    pos: String(Math.abs(contracts)),
    avgPx,
    rawPositionSide: "net",
    upl,
    markPx,
    marginMode: "cross",
  };
}

export async function getCandles(
  instId: string,
  bar: string,
  limit = 100,
  _demoOverride?: boolean,
  options?: { config?: CoinbaseConfig | null }
): Promise<Candle[]> {
  const config = options?.config ?? getConfig();
  if (!config) return [];
  const productId = toCoinbaseInstrument(instId);
  const granularity = toCoinbaseBar(bar);
  const endSec = Math.floor(Date.now() / 1000);
  const barSec =
    granularity === "ONE_DAY"
      ? 86400
      : granularity === "SIX_HOUR"
        ? 21600
        : granularity === "FOUR_HOUR"
          ? 14400
          : granularity === "TWO_HOUR"
            ? 7200
            : granularity === "ONE_HOUR"
              ? 3600
              : granularity === "THIRTY_MINUTE"
                ? 1800
                : granularity === "FIFTEEN_MINUTE"
                  ? 900
                  : granularity === "FIVE_MINUTE"
                    ? 300
                    : 60;
  const startSec = endSec - barSec * Math.max(limit, 10);
  const path = `/api/v3/brokerage/products/${encodeURIComponent(productId)}/candles?start=${startSec}&end=${endSec}&granularity=${granularity}`;
  const result = await advancedTradeRequest<{ candles?: { start?: string; open?: string; high?: string; low?: string; close?: string; volume?: string }[] }>(
    config,
    "GET",
    path
  );
  const rows = result.candles ?? [];
  const candles: Candle[] = rows.map((c) => {
    const ts = String(c.start ?? "0");
    const o = String(c.open ?? "0");
    const h = String(c.high ?? "0");
    const l = String(c.low ?? "0");
    const cl = String(c.close ?? "0");
    const v = String(c.volume ?? "0");
    return [ts, o, h, l, cl, v, v, v, "1"];
  });
  return candles.slice(0, limit);
}

export async function getTicker(
  instId: string,
  _demoOverride?: boolean,
  options?: { config?: CoinbaseConfig | null }
): Promise<{ last: string } | null> {
  const config = options?.config ?? getConfig();
  if (!config) return null;
  const productId = toCoinbaseInstrument(instId);
  const product = await advancedTradeRequest<{ price?: string; mid_market_price?: string }>(
    config,
    "GET",
    `/api/v3/brokerage/products/${encodeURIComponent(productId)}`
  );
  const last = product.price || product.mid_market_price;
  if (!last) return null;
  return { last: String(last) };
}

export async function getInstrument(
  instId: string,
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<CoinbaseInstrumentInfo | null> {
  const config = options?.config ?? getConfig();
  if (!config) return null;
  const productId = toCoinbaseInstrument(instId);
  try {
    const row = await advancedTradeRequest<{
      product_id?: string;
      base_min_size?: string;
      base_max_size?: string;
      price_increment?: string;
      base_increment?: string;
      status?: string;
      trading_disabled?: boolean;
      quote_currency_id?: string;
    }>(config, "GET", `/api/v3/brokerage/products/${encodeURIComponent(productId)}`);
    const minContracts = Math.max(1, parseFloat(String(row.base_min_size ?? "1")) || 1);
    const tick = String(row.price_increment ?? row.base_increment ?? "0.01");
    const sym = fromCoinbaseInstrument(productId).toUpperCase();
    // CFM nano-style multipliers (base coin per 1 contract) used for margin→contracts sizing.
    const contractBySym: Record<string, string> = {
      BTC: "0.01",
      ETH: "0.1",
      SOL: "1",
      XRP: "10",
      DOGE: "100",
      AVAX: "1",
    };
    return {
      minSize: String(minContracts),
      contractValue: contractBySym[sym] ?? "0.01",
      settleCurrency: String(row.quote_currency_id ?? "USD"),
      tickSize: tick,
      lotSize: "1",
      maxLeverage: "10",
      maxMarketSize: String(row.base_max_size ?? "5000"),
      state: row.trading_disabled ? "inactive" : "live",
      assetClass: "perpetual",
    };
  } catch {
    return null;
  }
}

/** Convert margin / contracts input into Coinbase order size (contracts + base amount). */
export function computeCoinbaseSizeFromConfig(input: {
  sizeMode: "margin" | "contracts";
  sizeValue: number;
  leverage: number;
  price: number;
  contractSize: number;
  minContracts: number;
  lotSize?: number;
}): {
  contracts: number;
  amountBase: number;
  notional: number;
  margin: number;
  sizeStr: string;
} {
  const contractSize = input.contractSize > 0 ? input.contractSize : 1;
  const minC = Math.max(1, input.minContracts || 1);
  const lot = Math.max(1, input.lotSize || 1);
  const lev = Math.max(1, input.leverage || 1);
  const price = input.price > 0 ? input.price : 0;

  let contracts: number;
  if (input.sizeMode === "contracts") {
    contracts = Math.max(minC, Math.floor(Number(input.sizeValue) || 0));
  } else {
    const margin = Math.max(0, Number(input.sizeValue) || 0);
    const notional = margin * lev;
    const rawContracts = price > 0 && contractSize > 0 ? notional / (price * contractSize) : 0;
    contracts = Math.max(minC, Math.floor(rawContracts / lot) * lot);
  }
  contracts = Math.max(minC, Math.floor(contracts / lot) * lot);
  const amountBase = contracts * contractSize;
  const notional = price > 0 ? amountBase * price : 0;
  const margin = lev > 0 ? notional / lev : notional;
  return {
    contracts,
    amountBase,
    notional,
    margin,
    sizeStr: String(contracts),
  };
}

export async function getFuturesBalance(options?: {
  demo?: boolean;
  config?: CoinbaseConfig | null;
}): Promise<{ currency: string; available: string; balance: string }[]> {
  const config = options?.config ?? getConfig();
  if (!config) return [];
  const result = await advancedTradeRequest<{
    balance_summary?: {
      futures_buying_power?: { value?: string; currency?: string };
      available_margin?: { value?: string; currency?: string };
      cfm_usd_balance?: { value?: string; currency?: string };
      total_usd_balance?: { value?: string; currency?: string };
    };
  }>(config, "GET", "/api/v3/brokerage/cfm/balance_summary");
  const s = result.balance_summary ?? {};
  const available = s.futures_buying_power?.value ?? s.available_margin?.value ?? "0";
  const balance = s.cfm_usd_balance?.value ?? s.total_usd_balance?.value ?? available;
  const currency = s.futures_buying_power?.currency ?? s.cfm_usd_balance?.currency ?? "USD";
  return [{ currency, available: String(available), balance: String(balance) }];
}

export async function getPositions(
  instId?: string,
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<PositionRow[]> {
  const config = options?.config ?? getConfig();
  if (!config) return [];
  const result = await advancedTradeRequest<{ positions?: Record<string, unknown>[] }>(
    config,
    "GET",
    "/api/v3/brokerage/cfm/positions"
  );
  const mapped = (result.positions ?? []).map((p) => mapCfmPosition(p)).filter((p): p is PositionRow => p != null);
  if (!instId) return mapped;
  const want = toCoinbaseInstrument(instId);
  return mapped.filter((p) => p.instId === want || p.instId === instId);
}

export function clampCoinbaseLeverage(requested: number, maxLeverageStr?: string | null): {
  leverage: number;
  clampedFrom: number | null;
  maxLeverage: number;
} {
  const maxParsed = maxLeverageStr != null ? Number(maxLeverageStr) : NaN;
  const maxLeverage = Number.isFinite(maxParsed) && maxParsed > 0 ? Math.min(10, maxParsed) : 10;
  const want = Math.max(1, Math.min(10, Number(requested) || 1));
  const leverage = Math.min(want, maxLeverage);
  return { leverage, clampedFrom: want > maxLeverage ? want : null, maxLeverage };
}

export function roundCoinbaseSize(size: number, minSize: number, lotSize: number): string {
  const step = Math.max(lotSize > 0 ? lotSize : 0, minSize > 0 ? minSize : 0, 1);
  const n = Math.max(minSize, Math.floor(size / step + 1e-12) * step);
  return String(Math.max(1, Math.round(n)));
}

export async function setLeverage(
  instId: string,
  leverage: number,
  _marginMode: "isolated" | "cross",
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  const productId = toCoinbaseInstrument(instId);
  const { leverage: lev } = clampCoinbaseLeverage(leverage);
  leverageByInst.set(productId, lev);
  return { ok: true };
}

function resolveLeverage(instId: string, fallback = 1): number {
  return leverageByInst.get(toCoinbaseInstrument(instId)) ?? fallback;
}

export async function placeMarketOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  marginMode: "isolated" | "cross" = "cross",
  options?: {
    demo?: boolean;
    reduceOnly?: boolean;
    config?: CoinbaseConfig | null;
    sizeUnit?: "contracts" | "amount";
    amountBase?: number;
    leverage?: number;
  }
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  const productId = toCoinbaseInstrument(instId);
  const contracts = String(Math.max(1, Math.round(parseFloat(size) || 0)));
  const lev = options?.leverage ?? resolveLeverage(productId, 1);
  const body: Record<string, unknown> = {
    client_order_id: crypto.randomUUID(),
    product_id: productId,
    side: side.toUpperCase(),
    order_configuration: {
      market_market_ioc: {
        base_size: contracts,
      },
    },
    leverage: String(lev),
    margin_type: marginMode === "isolated" ? "ISOLATED" : "CROSS",
  };
  if (options?.reduceOnly) body.reduce_only = true;
  try {
    const result = await advancedTradeRequest<{
      success?: boolean;
      success_response?: { order_id?: string };
      error_response?: { message?: string; error?: string };
      order_id?: string;
    }>(config, "POST", "/api/v3/brokerage/orders", body);
    if (result.success === false) {
      return {
        ok: false,
        error: result.error_response?.message || result.error_response?.error || "Order rejected",
      };
    }
    const orderId = result.success_response?.order_id ?? result.order_id;
    return { ok: true, orderId: orderId != null ? String(orderId) : undefined };
  } catch (e) {
    return { ok: false, error: formatCoinbaseApiError(e) };
  }
}

export async function placeLimitOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  price: string,
  marginMode: "isolated" | "cross" = "cross",
  options?: { demo?: boolean; config?: CoinbaseConfig | null; leverage?: number }
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  const productId = toCoinbaseInstrument(instId);
  const contracts = String(Math.max(1, Math.round(parseFloat(size) || 0)));
  const lev = options?.leverage ?? resolveLeverage(productId, 1);
  const body = {
    client_order_id: crypto.randomUUID(),
    product_id: productId,
    side: side.toUpperCase(),
    order_configuration: {
      limit_limit_gtc: {
        base_size: contracts,
        limit_price: String(price),
        post_only: false,
      },
    },
    leverage: String(lev),
    margin_type: marginMode === "isolated" ? "ISOLATED" : "CROSS",
  };
  try {
    const result = await advancedTradeRequest<{
      success?: boolean;
      success_response?: { order_id?: string };
      error_response?: { message?: string };
      order_id?: string;
    }>(config, "POST", "/api/v3/brokerage/orders", body);
    if (result.success === false) {
      return { ok: false, error: result.error_response?.message || "Order rejected" };
    }
    const orderId = result.success_response?.order_id ?? result.order_id;
    return { ok: true, orderId: orderId != null ? String(orderId) : undefined };
  } catch (e) {
    return { ok: false, error: formatCoinbaseApiError(e) };
  }
}

export async function closePositionViaApi(
  instId: string,
  _marginMode: "isolated" | "cross",
  _positionSide: "long" | "short" | "net",
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  const productId = toCoinbaseInstrument(instId);
  try {
    await advancedTradeRequest(config, "POST", "/api/v3/brokerage/orders/close_position", {
      client_order_id: crypto.randomUUID(),
      product_id: productId,
    });
    return { ok: true };
  } catch (e) {
    // Fallback: flatten via opposite market order from current position size.
    try {
      const positions = await getPositions(productId, { config });
      const pos = positions[0];
      if (!pos) return { ok: false, error: "No open position to close" };
      const side = pos.posSide === "long" ? "sell" : "buy";
      const placed = await placeMarketOrder(productId, side, pos.pos, "cross", {
        config,
        reduceOnly: true,
      });
      return placed.ok ? { ok: true } : { ok: false, error: placed.error ?? formatCoinbaseApiError(e) };
    } catch (e2) {
      return { ok: false, error: formatCoinbaseApiError(e2) };
    }
  }
}

export async function placeTPSLOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  marginMode: "isolated" | "cross",
  entryPrice: number,
  tpPct: number,
  slPct: number,
  options?: {
    demo?: boolean;
    config?: CoinbaseConfig | null;
    tpTriggerPrice?: number | null;
    slTriggerPrice?: number | null;
    amountBase?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  const isLong = side === "buy";
  const tpPrice =
    options?.tpTriggerPrice != null && options.tpTriggerPrice > 0
      ? options.tpTriggerPrice
      : tpPct > 0
        ? isLong
          ? entryPrice * (1 + tpPct / 100)
          : entryPrice * (1 - tpPct / 100)
        : null;
  const slPrice =
    options?.slTriggerPrice != null && options.slTriggerPrice > 0
      ? options.slTriggerPrice
      : slPct > 0
        ? isLong
          ? entryPrice * (1 - slPct / 100)
          : entryPrice * (1 + slPct / 100)
        : null;
  if (tpPrice == null && slPrice == null) return { ok: false, error: "No TP or SL level to attach" };

  const productId = toCoinbaseInstrument(instId);
  const contracts = String(Math.max(1, Math.round(parseFloat(size) || 0)));
  const lev = resolveLeverage(productId, 1);
  const bracket: Record<string, string> = { base_size: contracts };
  if (tpPrice != null) bracket.take_profit_price = String(tpPrice);
  if (slPrice != null) bracket.stop_trigger_price = String(slPrice);

  const body = {
    client_order_id: crypto.randomUUID(),
    product_id: productId,
    side: side.toUpperCase(),
    order_configuration: {
      market_market_ioc: { base_size: contracts },
    },
    attached_order_configuration: {
      trigger_bracket_gtc: bracket,
    },
    leverage: String(lev),
    margin_type: marginMode === "isolated" ? "ISOLATED" : "CROSS",
  };
  try {
    const result = await advancedTradeRequest<{
      success?: boolean;
      error_response?: { message?: string };
    }>(config, "POST", "/api/v3/brokerage/orders", body);
    if (result.success === false) {
      return { ok: false, error: result.error_response?.message || "TP/SL order rejected" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatCoinbaseApiError(e) };
  }
}

export async function cancelOrder(
  _instId: string,
  orderId: string,
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  try {
    await advancedTradeRequest(config, "POST", "/api/v3/brokerage/orders/batch_cancel", {
      order_ids: [orderId],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatCoinbaseApiError(e) };
  }
}

export async function getOpenOrders(options?: {
  demo?: boolean;
  instId?: string;
  limit?: number;
  config?: CoinbaseConfig | null;
}): Promise<
  { orderId: string; instId: string; side: string; orderType: string; size: string; price: string; state: string; createdAt?: string }[]
> {
  const config = options?.config ?? getConfig();
  if (!config) return [];
  const params = new URLSearchParams({
    order_status: "OPEN",
    limit: String(Math.min(100, options?.limit ?? 50)),
  });
  if (options?.instId) params.set("product_id", toCoinbaseInstrument(options.instId));
  const result = await advancedTradeRequest<{
    orders?: {
      order_id?: string;
      product_id?: string;
      side?: string;
      order_type?: string;
      status?: string;
      created_time?: string;
      filled_size?: string;
      average_filled_price?: string;
      order_configuration?: Record<string, Record<string, string>>;
    }[];
  }>(config, "GET", `/api/v3/brokerage/orders/historical/batch?${params.toString()}`);

  return (result.orders ?? []).map((o) => {
    const cfg = o.order_configuration ?? {};
    const first = Object.values(cfg)[0] ?? {};
    return {
      orderId: String(o.order_id ?? ""),
      instId: String(o.product_id ?? ""),
      side: String(o.side ?? "").toLowerCase(),
      orderType: String(o.order_type ?? ""),
      size: String(first.base_size ?? o.filled_size ?? "0"),
      price: String(first.limit_price ?? o.average_filled_price ?? "0"),
      state: String(o.status ?? "open").toLowerCase(),
      createdAt: o.created_time,
    };
  });
}

export type CoinbaseFillHistoryRow = {
  instId: string;
  tradeId: string;
  orderId: string;
  fillPrice: string;
  fillSize: string;
  fillPnl: string;
  positionSide: string;
  side: string;
  fee: string;
  ts: string;
};

export async function getFillsHistory(options?: {
  demo?: boolean;
  instId?: string;
  limit?: number;
  beginMs?: number;
  config?: CoinbaseConfig | null;
}): Promise<CoinbaseFillHistoryRow[]> {
  const config = options?.config ?? getConfig();
  if (!config) return [];
  const params = new URLSearchParams({
    limit: String(Math.min(100, options?.limit ?? 50)),
  });
  if (options?.instId) params.set("product_id", toCoinbaseInstrument(options.instId));
  if (options?.beginMs) params.set("start_sequence_timestamp", new Date(options.beginMs).toISOString());
  const result = await advancedTradeRequest<{
    fills?: {
      product_id?: string;
      trade_id?: string;
      order_id?: string;
      price?: string;
      size?: string;
      commission?: string;
      side?: string;
      trade_time?: string;
      realized_pl?: string;
    }[];
  }>(config, "GET", `/api/v3/brokerage/orders/historical/fills?${params.toString()}`);

  return (result.fills ?? []).map((r) => ({
    instId: String(r.product_id ?? ""),
    tradeId: String(r.trade_id ?? ""),
    orderId: String(r.order_id ?? ""),
    fillPrice: String(r.price ?? "0"),
    fillSize: String(r.size ?? "0"),
    fillPnl: String(r.realized_pl ?? "0"),
    positionSide: String(r.side ?? "").toLowerCase(),
    side: String(r.side ?? "").toLowerCase(),
    fee: String(r.commission ?? "0"),
    ts: String(r.trade_time ?? ""),
  }));
}

export async function getOrderHistory(options?: {
  demo?: boolean;
  instId?: string;
  limit?: number;
  beginMs?: number;
  config?: CoinbaseConfig | null;
}): Promise<
  {
    orderId: string;
    instId: string;
    side: string;
    orderType: string;
    size: string;
    price: string;
    state: string;
    fillPrice?: string;
    averagePrice?: string;
    leverage?: string;
    createdAt?: string;
    filledAt?: string;
    pnl?: string;
  }[]
> {
  const config = options?.config ?? getConfig();
  if (!config) return [];
  const params = new URLSearchParams({
    limit: String(Math.min(100, options?.limit ?? 50)),
  });
  if (options?.instId) params.set("product_id", toCoinbaseInstrument(options.instId));
  if (options?.beginMs) params.set("start_date", new Date(options.beginMs).toISOString());
  const result = await advancedTradeRequest<{
    orders?: {
      order_id?: string;
      product_id?: string;
      side?: string;
      order_type?: string;
      status?: string;
      created_time?: string;
      last_fill_time?: string;
      filled_size?: string;
      average_filled_price?: string;
      total_fees?: string;
      order_configuration?: Record<string, Record<string, string>>;
    }[];
  }>(config, "GET", `/api/v3/brokerage/orders/historical/batch?${params.toString()}`);

  return (result.orders ?? []).map((o) => {
    const cfg = o.order_configuration ?? {};
    const first = Object.values(cfg)[0] ?? {};
    return {
      orderId: String(o.order_id ?? ""),
      instId: String(o.product_id ?? ""),
      side: String(o.side ?? "").toLowerCase(),
      orderType: String(o.order_type ?? ""),
      size: String(first.base_size ?? o.filled_size ?? "0"),
      price: String(first.limit_price ?? o.average_filled_price ?? "0"),
      state: String(o.status ?? "").toLowerCase(),
      fillPrice: o.average_filled_price,
      averagePrice: o.average_filled_price,
      createdAt: o.created_time,
      filledAt: o.last_fill_time,
    };
  });
}
