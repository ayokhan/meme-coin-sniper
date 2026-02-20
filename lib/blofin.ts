/**
 * Blofin REST API client for futures (demo + live).
 * Docs: https://docs.blofin.com
 * Auth: path + method + timestamp + nonce + body -> HMAC-SHA256 -> hex -> base64
 */

const LIVE_BASE = "https://openapi.blofin.com";
const DEMO_BASE = "https://demo-trading-openapi.blofin.com";

function getBaseUrl(demo: boolean): string {
  return demo ? DEMO_BASE : LIVE_BASE;
}

import crypto from "crypto";

function createHmacSha256Hex(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function sign(secret: string, method: string, path: string, body: string): { sign: string; timestamp: string; nonce: string } {
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const prehash = path + method + timestamp + nonce + body;
  const hexSig = createHmacSha256Hex(secret, prehash);
  const base64 = Buffer.from(hexSig, "utf8").toString("base64");
  return { sign: base64, timestamp, nonce };
}

export type BlofinConfig = {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  demo: boolean;
  brokerId?: string;
};

function getConfig(): BlofinConfig | null {
  const apiKey = process.env.BLOFIN_API_KEY;
  const secretKey = process.env.BLOFIN_SECRET_KEY;
  const passphrase = process.env.BLOFIN_PASSPHRASE;
  if (!apiKey || !secretKey || !passphrase) return null;
  const demo = process.env.BLOFIN_DEMO_MODE === "true";
  const brokerId = process.env.BLOFIN_BROKER_ID?.trim() || undefined;
  return { apiKey, secretKey, passphrase, demo, brokerId };
}

/** Signed request to Blofin private API */
async function privateRequest<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<{ code: string; msg: string; data?: T }> {
  const config = getConfig();
  if (!config) throw new Error("Blofin API keys not configured");
  const base = getBaseUrl(config.demo);
  const pathWithQuery = path.startsWith("/") ? path : `/${path}`;
  const url = base + pathWithQuery;
  const bodyStr = body ? JSON.stringify(body) : "";
  const { sign: signVal, timestamp, nonce } = sign(config.secretKey, method, pathWithQuery, bodyStr);
  const headers: Record<string, string> = {
    "ACCESS-KEY": config.apiKey,
    "ACCESS-SIGN": signVal,
    "ACCESS-TIMESTAMP": timestamp,
    "ACCESS-NONCE": nonce,
    "ACCESS-PASSPHRASE": config.passphrase,
    "Content-Type": "application/json",
  };
  if (config.brokerId) headers["broker-id"] = config.brokerId;
  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" && bodyStr ? bodyStr : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { code?: string; msg?: string; data?: T };
  return { code: json.code ?? String(res.status), msg: json.msg ?? "", data: json.data };
}

/** Public request (no auth) */
async function publicRequest<T>(path: string): Promise<{ code: string; msg: string; data?: T }> {
  const config = getConfig();
  const base = config ? getBaseUrl(config.demo) : LIVE_BASE;
  const url = base + (path.startsWith("/") ? path : `/${path}`);
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { code?: string; msg?: string; data?: T };
  return { code: json.code ?? String(res.status), msg: json.msg ?? "", data: json.data };
}

/** Map our timeframe to Blofin bar (e.g. 1D -> 1D, 1h -> 1H) */
export function toBlofinBar(timeframe: string): string {
  const t = timeframe.trim();
  if (t === "1D" || t === "1d") return "1D";
  if (t === "1h" || t === "1H") return "1H";
  if (t === "4h" || t === "4H") return "4H";
  if (["1m", "3m", "5m", "15m", "30m", "2H", "6H", "8H", "12H", "3D", "1W", "1M"].includes(t)) return t;
  return "15m";
}

/** Candlestick: [ts, open, high, low, close, vol, volCurrency, volCurrencyQuote, confirm] */
export type Candle = [string, string, string, string, string, string, string, string, string];

/** GET /api/v1/market/candles */
export async function getCandles(instId: string, bar: string, limit = 100): Promise<Candle[]> {
  const path = `/api/v1/market/candles?instId=${encodeURIComponent(instId)}&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const out = await publicRequest<Candle[]>(path);
  if (out.code !== "0" || !out.data) return [];
  return out.data;
}

/** GET /api/v1/asset/balances?accountType=futures */
export async function getFuturesBalance(): Promise<{ currency: string; available: string; balance: string }[]> {
  const out = await privateRequest<{ details?: { currency: string; available: string; balance: string }[] }>(
    "GET",
    "/api/v1/asset/balances?accountType=futures"
  );
  if (out.code !== "0" || !out.data) return [];
  const d = out.data as { details?: { currency: string; available: string; balance: string }[] };
  return d.details ?? [];
}

/** GET /api/v1/account/positions - open positions */
export async function getPositions(instId?: string): Promise<{ instId: string; posSide: string; pos: string; avgPx: string }[]> {
  const path = instId
    ? `/api/v1/account/positions?instId=${encodeURIComponent(instId)}`
    : "/api/v1/account/positions";
  const out = await privateRequest<unknown>("GET", path);
  if (out.code !== "0" || !out.data) return [];
  const raw = out.data as { holdings?: Array<{ instId: string; posSide: string; pos: string; avgPx: string }>; data?: unknown[] };
  const list = raw.holdings ?? raw.data ?? (Array.isArray(raw) ? raw : []);
  return (Array.isArray(list) ? list : []).filter(
    (h: { pos?: string }) => h && h.pos != null && parseFloat(String(h.pos)) !== 0
  );
}

/** GET /api/v1/market/tickers - last price */
export async function getTicker(instId: string): Promise<{ last: string } | null> {
  const out = await publicRequest<{ last: string }[]>(`/api/v1/market/tickers?instId=${encodeURIComponent(instId)}`);
  if (out.code !== "0" || !out.data?.length) return null;
  return Array.isArray(out.data) ? out.data[0] : null;
}

/** Set leverage. Blofin: POST /api/v1/account/set-leverage */
export async function setLeverage(instId: string, leverage: number, marginMode: "isolated" | "cross"): Promise<{ ok: boolean; error?: string }> {
  const config = getConfig();
  const body: Record<string, unknown> = { instId, leverage: String(leverage), marginMode };
  if (config?.brokerId) body.brokerId = config.brokerId;
  const out = await privateRequest("POST", "/api/v1/account/set-leverage", body);
  if (out.code !== "0") return { ok: false, error: out.msg || out.code };
  return { ok: true };
}

/** Place market order. size in contracts (e.g. 0.1 for BTC-USDT). */
export async function placeMarketOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  marginMode: "isolated" | "cross" = "cross"
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const config = getConfig();
  const body: Record<string, unknown> = { instId, marginMode, side, orderType: "market", size };
  if (config?.brokerId) body.brokerId = config.brokerId;
  const out = await privateRequest<{ orderId?: string }>("POST", "/api/v1/trade/order", body);
  if (out.code !== "0") return { ok: false, error: out.msg || out.code };
  return { ok: true, orderId: out.data?.orderId };
}

/** Get instrument info (min size, contract value) */
export async function getInstrument(instId: string): Promise<{ minSize: string; contractValue: string; settleCurrency: string } | null> {
  const out = await publicRequest<{ instId: string; minSize: string; contractValue: string; settleCurrency: string }[]>(
    `/api/v1/market/instruments?instId=${encodeURIComponent(instId)}`
  );
  if (out.code !== "0" || !out.data?.length) return null;
  const d = out.data[0];
  return { minSize: d.minSize, contractValue: d.contractValue, settleCurrency: d.settleCurrency };
}

export function isBlofinConfigured(): boolean {
  return !!(
    process.env.BLOFIN_API_KEY &&
    process.env.BLOFIN_SECRET_KEY &&
    process.env.BLOFIN_PASSPHRASE
  );
}
