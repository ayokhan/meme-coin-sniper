/**
 * Coinbase Global Derivatives REST client (Deribit-powered gateway).
 * Docs: https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/guides/derivatives/technical
 * Auth: CDP JWT → public/auth → Bearer access token (~15 min).
 */

import crypto from "crypto";

const LIVE_BASE = "https://drb.coinbase.com/api/v2";

export type CoinbaseConfig = {
  apiKeyName: string;
  apiSecret: string;
  demo: boolean;
};

type TokenEntry = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenEntry>();

function cacheKey(config: CoinbaseConfig): string {
  return `${config.apiKeyName}:${config.demo ? "demo" : "live"}`;
}

function getBaseUrl(_demo: boolean): string {
  return LIVE_BASE;
}

function base64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Normalize CDP private key PEM — env vars and pasted secrets are often mangled. */
export function normalizeCoinbasePrivateKeyPem(secret: string): string {
  let s = secret.trim().replace(/^\uFEFF/, "");
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Full CDP key JSON download: { "name": "...", "privateKey": "-----BEGIN..." }
  if (s.startsWith("{") && /"privateKey"\s*:/.test(s)) {
    try {
      const parsed = JSON.parse(s) as { privateKey?: unknown };
      if (typeof parsed.privateKey === "string" && parsed.privateKey.trim()) {
        s = parsed.privateKey.trim().replace(/\\n/g, "\n");
      }
    } catch {
      /* keep original */
    }
  }

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
      "Coinbase private key could not be read. Paste the full CDP PEM " +
      "(-----BEGIN EC PRIVATE KEY----- … -----END EC PRIVATE KEY-----), " +
      "or the CDP JSON key file. Then re-save keys (or fix COINBASE_API_SECRET on the server)."
    );
  }
  return msg;
}

/** Load Coinbase CDP EC private key for ES256 JWT signing. */
export function loadCoinbaseSigningKey(secret: string): crypto.KeyObject {
  const pem = normalizeCoinbasePrivateKeyPem(secret);
  if (!pem) throw new Error("Coinbase private key is empty.");

  const attempts: crypto.PrivateKeyInput[] = [{ key: pem, format: "pem" }];
  if (/BEGIN EC PRIVATE KEY/i.test(pem)) {
    attempts.push({ key: pem.replace(/EC PRIVATE KEY/gi, "PRIVATE KEY"), format: "pem" });
  } else if (/BEGIN PRIVATE KEY/i.test(pem)) {
    attempts.push({ key: pem.replace(/PRIVATE KEY/gi, "EC PRIVATE KEY"), format: "pem" });
  }

  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(body) && body.length > 40) {
    const der = Buffer.from(body, "base64");
    attempts.push({ key: der, format: "der", type: "pkcs8" });
    attempts.push({ key: der, format: "der", type: "sec1" });
  }

  let lastErr: unknown;
  for (const input of attempts) {
    try {
      const key = crypto.createPrivateKey(input);
      if (key.asymmetricKeyType !== "ec") {
        throw new Error(`Expected an EC private key for Coinbase CDP (ES256), got ${key.asymmetricKeyType ?? "unknown"}.`);
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

    // HMAC-style Advanced Trade secrets (random strings) are not valid for CDP JWT auth.
    if (!/-----BEGIN/.test(raw) && !raw.trim().startsWith("{")) {
      return {
        ok: false,
        error:
          "That looks like an API secret string, not a CDP private key. In the Coinbase CDP portal, download the API key and paste the private key block that starts with -----BEGIN EC PRIVATE KEY----- (or paste the whole .json key file). A short API secret / HMAC key will not work for Coinbase Futures here.",
      };
    }

    const pem = normalizeCoinbasePrivateKeyPem(raw);
    if (!pem) return { ok: false, error: "Private key is required." };
    if (/BEGIN\s+PUBLIC\s+KEY/i.test(pem)) {
      return { ok: false, error: "That is a PUBLIC key. Paste the CDP private key PEM instead." };
    }
    loadCoinbaseSigningKey(pem);
    return { ok: true, pem };
  } catch (e) {
    return { ok: false, error: friendlyCoinbaseKeyError(e) };
  }
}

/** Create a short-lived CDP JWT (ES256) for public/auth. */
export function createCdpJwt(apiKeyName: string, privateKeyPem: string): string {
  const key = loadCoinbaseSigningKey(privateKeyPem);
  const header = { alg: "ES256", kid: apiKeyName, typ: "JWT", nonce: crypto.randomUUID() };
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: apiKeyName, iss: "cdp", nbf: now, exp: now + 120 };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sign = crypto.createSign("SHA256");
  sign.update(signingInput);
  sign.end();
  const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64urlEncode(sig)}`;
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

type JsonRpcResponse<T> = { jsonrpc: string; id: number; result?: T; error?: { code: number; message: string } };

async function jsonRpc<T>(
  method: string,
  params: Record<string, unknown>,
  config: CoinbaseConfig,
  accessToken?: string
): Promise<T> {
  const base = getBaseUrl(config.demo);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as JsonRpcResponse<T>;
  if (json.error) {
    throw new Error(json.error.message || `Coinbase RPC error ${json.error.code}`);
  }
  if (!res.ok) {
    throw new Error(`Coinbase HTTP ${res.status}`);
  }
  return json.result as T;
}

/** Exchange CDP JWT for Deribit access token; cached ~14 min. */
export async function getAccessToken(config: CoinbaseConfig): Promise<string> {
  const ck = cacheKey(config);
  const cached = tokenCache.get(ck);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  let jwt: string;
  try {
    jwt = createCdpJwt(config.apiKeyName, config.apiSecret);
  } catch (e) {
    throw new Error(formatCoinbaseApiError(e));
  }
  const result = await jsonRpc<{ access_token: string; expires_in?: number }>(
    "public/auth",
    { grant_type: "coinbase_cdp", token: jwt },
    config
  );
  const token = result.access_token;
  const ttlMs = (result.expires_in ?? 900) * 1000;
  tokenCache.set(ck, { token, expiresAt: Date.now() + ttlMs - 60_000 });
  return token;
}

async function privateRpc<T>(method: string, params: Record<string, unknown>, config: CoinbaseConfig): Promise<T> {
  const token = await getAccessToken(config);
  return jsonRpc<T>(method, params, config, token);
}

export function formatCoinbaseApiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("DECODER") || msg.includes("unsupported")) {
    return (
      "Coinbase private key could not be read. Paste the full CDP PEM " +
      "(-----BEGIN EC PRIVATE KEY----- … -----END EC PRIVATE KEY-----), " +
      "or the CDP JSON key file. Then re-save keys (or fix COINBASE_API_SECRET on the server)."
    );
  }
  return msg;
}

/** Map symbol (BTC, BTC/USDT) → Coinbase instrument e.g. BTC_USDC-PERPETUAL. */
export function toCoinbaseInstrument(symbol: string, marginCurrency = "USDC"): string {
  const raw = symbol.trim().toUpperCase();
  const base = raw.includes("/") ? raw.split("/")[0] : raw.includes("-") ? raw.split("-")[0] : raw;
  const quote = marginCurrency.toUpperCase() === "USDT" ? "USDC" : marginCurrency.toUpperCase();
  return `${base}_${quote}-PERPETUAL`;
}

/** Display symbol from instrument name. */
export function fromCoinbaseInstrument(instId: string): string {
  const m = instId.match(/^([A-Z0-9]+)_[A-Z]+-PERPETUAL$/i);
  return m ? m[1] : instId.replace(/_USDC-PERPETUAL$/i, "").replace(/-PERPETUAL$/i, "");
}

export function toCoinbaseBar(timeframe: string): string {
  const t = timeframe.trim();
  const map: Record<string, string> = {
    "1m": "1",
    "5m": "5",
    "15m": "15",
    "1h": "60",
    "1H": "60",
    "4h": "240",
    "4H": "240",
    "1D": "1D",
    "1d": "1D",
  };
  return map[t] ?? "15";
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

function mapPosition(p: Record<string, unknown>): PositionRow | null {
  const instId = String(p.instrument_name ?? p.instrumentName ?? "");
  const sizeRaw = p.size ?? p.amount;
  const size = typeof sizeRaw === "number" ? sizeRaw : parseFloat(String(sizeRaw ?? "0"));
  if (!Number.isFinite(size) || size === 0) return null;
  const posSide = size >= 0 ? "long" : "short";
  const avgPx = String(p.average_price ?? p.averagePrice ?? p.avg_price ?? "0");
  const markPx = p.mark_price ?? p.markPrice ?? p.index_price;
  const upl = p.floating_profit_loss ?? p.unrealized_pnl ?? p.upl;
  const leverage = p.leverage;
  const initialMargin = p.initial_margin ?? p.margin;
  const liqPx = p.estimated_liquidation_price ?? p.liquidation_price;
  const marginMode = p.margin_type ?? p.margin_mode;
  const entry = parseFloat(avgPx);
  const mark = markPx != null ? Number(markPx) : NaN;
  let ratio: string | undefined;
  if (Number.isFinite(entry) && entry > 0 && Number.isFinite(mark) && upl != null) {
    const lev = leverage != null ? Number(leverage) : 1;
    const priceMove = posSide === "long" ? (mark - entry) / entry : (entry - mark) / entry;
    if (lev > 0) ratio = String(priceMove * lev);
  }
  return {
    instId,
    posSide,
    pos: String(Math.abs(size)),
    avgPx,
    rawPositionSide: "net",
    liqPx: liqPx != null ? String(liqPx) : undefined,
    margin: initialMargin != null ? String(initialMargin) : undefined,
    upl: upl != null ? String(upl) : undefined,
    unrealizedPnlRatio: ratio,
    leverage: leverage != null ? String(leverage) : undefined,
    marginMode: marginMode != null ? String(marginMode) : undefined,
    markPx: markPx != null ? String(markPx) : undefined,
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
  const resolution = toCoinbaseBar(bar);
  const endSec = Math.floor(Date.now() / 1000);
  const barSec = resolution === "1D" ? 86400 : parseInt(resolution, 10) * 60;
  const startSec = endSec - barSec * limit;
  const result = await jsonRpc<{
    status?: string;
    ticks?: number[];
    open?: number[];
    high?: number[];
    low?: number[];
    close?: number[];
    volume?: number[];
  }>(
    "public/get_tradingview_chart_data",
    { instrument_name: instId, start_timestamp: startSec * 1000, end_timestamp: endSec * 1000, resolution },
    config
  );
  const ticks = result.ticks ?? [];
  const candles: Candle[] = [];
  for (let i = ticks.length - 1; i >= 0; i--) {
    const ts = String(ticks[i]);
    const o = String(result.open?.[i] ?? "0");
    const h = String(result.high?.[i] ?? "0");
    const l = String(result.low?.[i] ?? "0");
    const c = String(result.close?.[i] ?? "0");
    const v = String(result.volume?.[i] ?? "0");
    candles.push([ts, o, h, l, c, v, v, v, "1"]);
  }
  return candles.slice(0, limit);
}

export async function getTicker(
  instId: string,
  _demoOverride?: boolean,
  options?: { config?: CoinbaseConfig | null }
): Promise<{ last: string } | null> {
  const config = options?.config ?? getConfig();
  if (!config) return null;
  const result = await jsonRpc<{ last_price?: number; mark_price?: number }>(
    "public/ticker",
    { instrument_name: instId },
    config
  );
  const last = result.last_price ?? result.mark_price;
  if (last == null) return null;
  return { last: String(last) };
}

/**
 * Coinbase / Deribit linear perps:
 * - `contract_size` = base coin per 1 contract (e.g. nano BTC ≈ 0.01)
 * - UI "Amount (Contract)" = number of contracts
 * - API `amount` = base coin; API `contracts` = contract count (preferred to match UI)
 */
export async function getInstrument(
  instId: string,
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<CoinbaseInstrumentInfo | null> {
  const config = options?.config ?? getConfig();
  if (!config) return null;
  const result = await jsonRpc<{ result?: Record<string, unknown>[] } | Record<string, unknown>[]>(
    "public/get_instruments",
    { currency: "USDC", kind: "future" },
    config
  );
  const list = Array.isArray(result) ? result : (result as { result?: Record<string, unknown>[] }).result ?? [];
  const row = list.find((r) => String(r.instrument_name ?? "") === instId);
  if (!row) return null;
  const contractSize = Number(row.contract_size ?? row.contractSize ?? 0.01);
  const minTradeBase = Number(row.min_trade_amount ?? contractSize ?? 0.01);
  const minContracts =
    contractSize > 0 ? Math.max(1, Math.ceil(minTradeBase / contractSize - 1e-12)) : 1;
  const tick = Number(row.tick_size ?? 0.01);
  const maxLev = Number(row.max_leverage ?? row.leverage ?? 50);
  return {
    /** Minimum order size in contracts (matches Coinbase Advanced "Amount (Contract)"). */
    minSize: String(minContracts),
    /** Base coin per 1 contract (e.g. 0.01 for nano BTC). */
    contractValue: String(contractSize > 0 ? contractSize : 0.01),
    settleCurrency: "USDC",
    tickSize: String(tick),
    lotSize: "1",
    maxLeverage: String(Number.isFinite(maxLev) && maxLev > 0 ? Math.min(50, maxLev) : 50),
    maxMarketSize: String(row.max_liquidation_allocation ?? "100000"),
    state: row.is_active === false ? "inactive" : "live",
    assetClass: "perpetual",
  };
}

/** Convert margin / contracts input into Coinbase order size (contracts + base amount). */
export function computeCoinbaseSizeFromConfig(input: {
  sizeMode: "margin" | "contracts";
  /** Margin in USDC when sizeMode=margin; contract count when sizeMode=contracts. */
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
  const contractSize = input.contractSize > 0 ? input.contractSize : 0.01;
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
  const summary = await privateRpc<{
    equity?: number;
    available_funds?: number;
    balance?: number;
    currency?: string;
  }>("private/get_account_summary", { currency: "USDC" }, config);
  const currency = summary.currency ?? "USDC";
  return [
    {
      currency,
      available: String(summary.available_funds ?? summary.balance ?? 0),
      balance: String(summary.equity ?? summary.balance ?? 0),
    },
  ];
}

export async function getPositions(
  instId?: string,
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<PositionRow[]> {
  const config = options?.config ?? getConfig();
  if (!config) return [];
  const result = await privateRpc<Record<string, unknown>[] | { result?: Record<string, unknown>[] }>(
    "private/get_positions",
    { currency: "USDC", kind: "future" },
    config
  );
  const list = Array.isArray(result) ? result : (result as { result?: Record<string, unknown>[] }).result ?? [];
  const mapped = list.map((p) => mapPosition(p)).filter((p): p is PositionRow => p != null);
  if (!instId) return mapped;
  return mapped.filter((p) => p.instId === instId);
}

export function clampCoinbaseLeverage(requested: number, maxLeverageStr?: string | null): {
  leverage: number;
  clampedFrom: number | null;
  maxLeverage: number;
} {
  const maxParsed = maxLeverageStr != null ? Number(maxLeverageStr) : NaN;
  const maxLeverage = Number.isFinite(maxParsed) && maxParsed > 0 ? Math.min(50, maxParsed) : 50;
  const want = Math.max(1, Math.min(50, Number(requested) || 1));
  const leverage = Math.min(want, maxLeverage);
  return { leverage, clampedFrom: want > maxLeverage ? want : null, maxLeverage };
}

export function roundCoinbaseSize(size: number, minSize: number, lotSize: number): string {
  const step = Math.max(lotSize > 0 ? lotSize : 0, minSize > 0 ? minSize : 0, 1e-8);
  const n = Math.max(minSize, Math.floor(size / step + 1e-12) * step);
  const decimals = step < 1 ? Math.min(8, String(step).split(".")[1]?.length ?? 4) : 0;
  return n.toFixed(decimals);
}

export async function setLeverage(
  instId: string,
  leverage: number,
  _marginMode: "isolated" | "cross",
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  try {
    await privateRpc("private/set_leverage", { instrument_name: instId, leverage }, config);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatCoinbaseApiError(e) };
  }
}

export async function placeMarketOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  _marginMode: "isolated" | "cross" = "cross",
  options?: {
    demo?: boolean;
    reduceOnly?: boolean;
    config?: CoinbaseConfig | null;
    /** Prefer contracts to match Coinbase Advanced Trade UI (Amount = contracts). */
    sizeUnit?: "contracts" | "amount";
    /** Base-coin amount when sizeUnit=contracts (for TP/SL attach). */
    amountBase?: number;
  }
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  const method = side === "buy" ? "private/buy" : "private/sell";
  const n = parseFloat(size);
  const params: Record<string, unknown> = {
    instrument_name: instId,
    type: "market",
  };
  if (options?.sizeUnit === "amount") {
    params.amount = n;
  } else {
    // Default: contracts — same unit as Coinbase Advanced "Amount (Contract)"
    params.contracts = n;
  }
  if (options?.reduceOnly) params.reduce_only = true;
  try {
    const result = await privateRpc<{ order?: { order_id?: string }; order_id?: string }>(method, params, config);
    const orderId = result.order?.order_id ?? result.order_id;
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
  _marginMode: "isolated" | "cross" = "cross",
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  const method = side === "buy" ? "private/buy" : "private/sell";
  try {
    const result = await privateRpc<{ order?: { order_id?: string }; order_id?: string }>(
      method,
      { instrument_name: instId, amount: parseFloat(size), type: "limit", price: parseFloat(price) },
      config
    );
    const orderId = result.order?.order_id ?? result.order_id;
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
  try {
    await privateRpc("private/close_position", { instrument_name: instId, type: "market" }, config);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatCoinbaseApiError(e) };
  }
}

export async function placeTPSLOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  _marginMode: "isolated" | "cross",
  entryPrice: number,
  tpPct: number,
  slPct: number,
  options?: {
    demo?: boolean;
    config?: CoinbaseConfig | null;
    tpTriggerPrice?: number | null;
    slTriggerPrice?: number | null;
    /** Base-coin size for OTOCO legs when `size` is contracts. */
    amountBase?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  const isLong = side === "buy";
  const closeDir = isLong ? "sell" : "buy";
  let tpPrice =
    options?.tpTriggerPrice != null && options.tpTriggerPrice > 0
      ? options.tpTriggerPrice
      : tpPct > 0
        ? isLong
          ? entryPrice * (1 + tpPct / 100)
          : entryPrice * (1 - tpPct / 100)
        : null;
  let slPrice =
    options?.slTriggerPrice != null && options.slTriggerPrice > 0
      ? options.slTriggerPrice
      : slPct > 0
        ? isLong
          ? entryPrice * (1 - slPct / 100)
          : entryPrice * (1 + slPct / 100)
        : null;
  if (tpPrice == null && slPrice == null) return { ok: false, error: "No TP or SL level to attach" };
  // `size` is contracts (Coinbase UI unit).
  const contracts = parseFloat(size);
  const amountBase = options?.amountBase != null && options.amountBase > 0 ? options.amountBase : contracts;
  const otoco: Record<string, unknown>[] = [];
  if (tpPrice != null) {
    otoco.push({
      type: "take_limit",
      direction: closeDir,
      contracts,
      amount: amountBase,
      price: tpPrice,
      trigger: "last_price",
    });
  }
  if (slPrice != null) {
    otoco.push({
      type: "stop_market",
      direction: closeDir,
      contracts,
      amount: amountBase,
      trigger_price: slPrice,
      trigger: "mark_price",
    });
  }
  const method = side === "buy" ? "private/buy" : "private/sell";
  try {
    await privateRpc(
      method,
      {
        instrument_name: instId,
        contracts,
        type: "market",
        linked_order_type: "one_triggers_one_cancels_other",
        otoco_config: otoco,
      },
      config
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatCoinbaseApiError(e) };
  }
}

export async function cancelOrder(
  instId: string,
  orderId: string,
  options?: { demo?: boolean; config?: CoinbaseConfig | null }
): Promise<{ ok: boolean; error?: string }> {
  const config = options?.config ?? getConfig();
  if (!config) return { ok: false, error: "Coinbase API keys not configured" };
  try {
    await privateRpc("private/cancel", { order_id: orderId, instrument_name: instId }, config);
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
  const params: Record<string, unknown> = { currency: "USDC", kind: "future", count: options?.limit ?? 50 };
  if (options?.instId) params.instrument_name = options.instId;
  const result = await privateRpc<Record<string, unknown>[]>("private/get_open_orders_by_currency", params, config);
  return (result ?? []).map((o) => ({
    orderId: String(o.order_id ?? o.orderId ?? ""),
    instId: String(o.instrument_name ?? ""),
    side: String(o.direction ?? o.side ?? ""),
    orderType: String(o.order_type ?? o.type ?? ""),
    size: String(o.amount ?? o.size ?? "0"),
    price: String(o.price ?? "0"),
    state: String(o.order_state ?? o.state ?? "open"),
    createdAt: o.creation_timestamp != null ? String(o.creation_timestamp) : undefined,
  }));
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
  const params: Record<string, unknown> = { currency: "USDC", kind: "future", count: Math.min(100, options?.limit ?? 50) };
  if (options?.instId) params.instrument_name = options.instId;
  if (options?.beginMs) params.start_timestamp = options.beginMs;
  const result = await privateRpc<Record<string, unknown>[]>("private/get_user_trades_by_currency", params, config);
  return (result ?? []).map((r) => ({
    instId: String(r.instrument_name ?? ""),
    tradeId: String(r.trade_id ?? r.trade_seq ?? ""),
    orderId: String(r.order_id ?? ""),
    fillPrice: String(r.price ?? "0"),
    fillSize: String(r.amount ?? "0"),
    fillPnl: String(r.profit_loss ?? r.pnl ?? "0"),
    positionSide: String(r.direction ?? ""),
    side: String(r.direction ?? ""),
    fee: String(r.fee ?? "0"),
    ts: String(r.timestamp ?? r.trade_timestamp ?? ""),
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
  const params: Record<string, unknown> = { currency: "USDC", kind: "future", count: Math.min(100, options?.limit ?? 50) };
  if (options?.instId) params.instrument_name = options.instId;
  if (options?.beginMs) params.start_timestamp = options.beginMs;
  const result = await privateRpc<Record<string, unknown>[]>("private/get_order_history_by_currency", params, config);
  return (result ?? []).map((o) => ({
    orderId: String(o.order_id ?? ""),
    instId: String(o.instrument_name ?? ""),
    side: String(o.direction ?? o.side ?? ""),
    orderType: String(o.order_type ?? o.type ?? ""),
    size: String(o.amount ?? "0"),
    price: String(o.price ?? "0"),
    state: String(o.order_state ?? o.state ?? ""),
    fillPrice: o.average_price != null ? String(o.average_price) : undefined,
    averagePrice: o.average_price != null ? String(o.average_price) : undefined,
    leverage: o.leverage != null ? String(o.leverage) : undefined,
    createdAt: o.creation_timestamp != null ? String(o.creation_timestamp) : undefined,
    filledAt: o.last_update_timestamp != null ? String(o.last_update_timestamp) : undefined,
    pnl: o.profit_loss != null ? String(o.profit_loss) : undefined,
  }));
}
