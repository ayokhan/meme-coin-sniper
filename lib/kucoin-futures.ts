/**
 * KuCoin Futures REST API client (Canada-friendly alternative to Hyperliquid/Blofin).
 * Docs: https://www.kucoin.com/docs/rest/futures-trading/
 * Auth: KC-API-KEY, KC-API-SIGN (base64 HMAC-SHA256 of timestamp+method+path+body), KC-API-TIMESTAMP, KC-API-PASSPHRASE.
 */

import crypto from "crypto";

const BASE = "https://api-futures.kucoin.com";

/** Same tuple shape as Blofin for TA compatibility */
export type Candle = [string, string, string, string, string, string, string, string, string];

function getConfig(): { apiKey: string; secret: string; passphrase: string } | null {
  const apiKey = process.env.KUCOIN_FUTURES_API_KEY?.trim();
  const secret = process.env.KUCOIN_FUTURES_SECRET?.trim();
  const passphrase = process.env.KUCOIN_FUTURES_PASSPHRASE?.trim();
  if (!apiKey || !secret || !passphrase) return null;
  return { apiKey, secret, passphrase };
}

function sign(secret: string, timestamp: string, method: string, path: string, body: string): string {
  const stringToSign = timestamp + method + path + body;
  const hmac = crypto.createHmac("sha256", secret).update(stringToSign).digest();
  return Buffer.from(hmac).toString("base64");
}

async function privateRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: Record<string, unknown>
): Promise<{ code: string; msg?: string; data?: T }> {
  const config = getConfig();
  if (!config) throw new Error("KuCoin Futures API not configured");
  const timestamp = String(Date.now());
  const bodyStr = body ? JSON.stringify(body) : "";
  const pathWithQuery = path.startsWith("/") ? path : `/${path}`;
  const signature = sign(config.secret, timestamp, method, pathWithQuery, bodyStr);
  const url = BASE + pathWithQuery;
  const res = await fetch(url, {
    method,
    headers: {
      "KC-API-KEY": config.apiKey,
      "KC-API-SIGN": signature,
      "KC-API-TIMESTAMP": timestamp,
      "KC-API-PASSPHRASE": config.passphrase,
      "Content-Type": "application/json",
    },
    body: method !== "GET" && bodyStr ? bodyStr : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { code?: string; msg?: string; data?: T };
  return { code: json.code ?? String(res.status), msg: json.msg, data: json.data };
}

async function publicRequest<T>(path: string): Promise<{ code: string; data?: T }> {
  const url = BASE + (path.startsWith("/") ? path : `/${path}`);
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { code?: string; data?: T };
  return { code: json.code ?? String(res.status), data: json.data };
}

/** Map symbol to KuCoin futures symbol (BTC -> XBTUSDTM, ETH -> ETHUSDTM). */
export function instIdToKucoinSymbol(instId: string): string {
  const upper = instId.trim().toUpperCase();
  const base = (upper.split("-")[0] ?? upper.split("/")[0] ?? upper).trim();
  if (base === "BTC") return "XBTUSDTM";
  return `${base}USDTM`;
}

/** Map our timeframe to KuCoin granularity in minutes. */
function toGranularityMinutes(bar: string): number {
  const t = bar.trim().toLowerCase();
  if (t === "1m") return 1;
  if (t === "3m") return 3;
  if (t === "5m") return 5;
  if (t === "15m") return 15;
  if (t === "30m") return 30;
  if (t === "1h") return 60;
  if (t === "2h" || t === "2H") return 120;
  if (t === "4h" || t === "4H") return 240;
  if (t === "8h") return 480;
  if (t === "12h") return 720;
  if (t === "1d" || t === "1D") return 1440;
  if (t === "1w") return 10080;
  return 15;
}

/** Candles (newest first). */
export async function getCandles(instId: string, bar: string, limit = 100): Promise<Candle[]> {
  const symbol = instIdToKucoinSymbol(instId);
  const granularity = toGranularityMinutes(bar);
  const endAt = Date.now();
  const startAt = endAt - limit * granularity * 60 * 1000;
  const path = `/api/v1/kline/query?symbol=${encodeURIComponent(symbol)}&granularity=${granularity}&from=${startAt}&to=${endAt}`;
  const out = await publicRequest<{ data?: Array<[number, string, string, string, string, string, number]> }>(path);
  if (out.code !== "200000" || !Array.isArray(out.data) || !out.data.length) return [];
  const raw = out.data;
  const tuples: Candle[] = raw.map((c) => [
    String(c[0]),
    c[1]!,
    c[3]!,
    c[4]!,
    c[2]!,
    c[5]!,
    "USDT",
    "USDT",
    "1",
  ]);
  tuples.reverse();
  return tuples.slice(0, limit);
}

/** Last price (mark or index). */
export async function getTicker(instId: string): Promise<{ last: string } | null> {
  const symbol = instIdToKucoinSymbol(instId);
  const out = await publicRequest<{ markPrice?: string; lastTradePrice?: string }>(
    `/api/v1/ticker?symbol=${encodeURIComponent(symbol)}`
  );
  if (out.code !== "200000" || !out.data) return null;
  const last = out.data.lastTradePrice ?? out.data.markPrice;
  return last != null ? { last: String(last) } : null;
}

/** Min size (contracts), contract value (multiplier in base, e.g. 0.001 for XBT), settle currency. */
export async function getInstrument(instId: string): Promise<{ minSize: string; contractValue: string; settleCurrency: string } | null> {
  const symbol = instIdToKucoinSymbol(instId);
  const out = await publicRequest<{
    symbol?: string;
    multiplier?: number;
    minOrderSize?: number;
    quoteCurrency?: string;
  }>(`/api/v1/contracts/${encodeURIComponent(symbol)}`);
  if (out.code !== "200000" || !out.data) return null;
  const mult = out.data.multiplier ?? 0.001;
  const minOrder = out.data.minOrderSize ?? 1;
  return {
    minSize: String(minOrder),
    contractValue: String(mult),
    settleCurrency: out.data.quoteCurrency ?? "USDT",
  };
}

/** Open positions. */
export async function getPositions(instId?: string): Promise<{ instId: string; posSide: string; pos: string; avgPx: string }[]> {
  const config = getConfig();
  if (!config) return [];
  const out = await privateRequest<{ currentPage?: number; items?: Array<{ symbol: string; realLeverage: number; currentQty: number; avgFillPrice: string }> }>(
    "GET",
    "/api/v1/positions"
  );
  if (out.code !== "200000" || !out.data?.items) return [];
  const symbolFilter = instId ? instIdToKucoinSymbol(instId) : null;
  const list = out.data.items.filter((p) => p.currentQty !== 0 && (!symbolFilter || p.symbol === symbolFilter));
  return list.map((p) => ({
    instId: p.symbol,
    posSide: p.currentQty > 0 ? "long" : "short",
    pos: String(Math.abs(p.currentQty)),
    avgPx: p.avgFillPrice ?? "0",
  }));
}

/** Set cross leverage. */
export async function setLeverage(instId: string, leverage: number, _marginMode: "isolated" | "cross"): Promise<{ ok: boolean; error?: string }> {
  const symbol = instIdToKucoinSymbol(instId);
  const out = await privateRequest<unknown>("POST", "/api/v2/changeCrossUserLeverage", { symbol, leverage: String(leverage) });
  if (out.code !== "200000") return { ok: false, error: out.msg ?? out.code };
  return { ok: true };
}

/** Place market order. Size in contracts (e.g. 1 = 0.001 BTC for XBTUSDTM). */
export async function placeMarketOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  _marginMode: "isolated" | "cross" = "cross"
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const symbol = instIdToKucoinSymbol(instId);
  const out = await privateRequest<{ orderId?: string }>("POST", "/api/v1/orders", {
    symbol,
    side: side.toUpperCase(),
    type: "market",
    size: parseFloat(size),
  });
  if (out.code !== "200000") return { ok: false, error: out.msg ?? out.code };
  return { ok: true, orderId: out.data?.orderId };
}

export function isKuCoinFuturesConfigured(): boolean {
  return !!getConfig();
}
