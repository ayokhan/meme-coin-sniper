/**
 * Hyperliquid REST API client for perpetual futures (alternative to Blofin).
 * Uses wallet private key (EIP-712). No broker ID required.
 * Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

import { HyperliquidAPI } from "hyperliquid-ts";
import { ethers } from "ethers";

const HL_INFO_BASE = "https://api.hyperliquid.xyz/info";

/** Same tuple shape as Blofin for TA compatibility: [ts, open, high, low, close, vol, volCurrency, volCurrencyQuote, confirm] */
export type Candle = [string, string, string, string, string, string, string, string, string];

function getPrivateKey(): string | null {
  const key = process.env.HYPERLIQUID_PRIVATE_KEY?.trim();
  if (!key) return null;
  return key.startsWith("0x") ? key : `0x${key}`;
}

function getApi(): HyperliquidAPI | null {
  const pk = getPrivateKey();
  if (!pk) return null;
  const isMainnet = process.env.HYPERLIQUID_TESTNET !== "true";
  return new HyperliquidAPI(pk, isMainnet);
}

/** Map symbol like BTC-USDT or BTC to Hyperliquid coin (BTC). */
export function instIdToCoin(instId: string): string {
  const upper = instId.trim().toUpperCase();
  const base = upper.split("-")[0] ?? upper.split("/")[0] ?? upper;
  return base || "BTC";
}

/** Map our timeframe to Hyperliquid interval (1m, 5m, 15m, 1h, 4h, 1d). */
export function toHyperliquidInterval(bar: string): string {
  const t = bar.trim();
  if (t === "1D" || t === "1d") return "1d";
  if (["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"].includes(t)) return t;
  if (t === "1H" || t === "4H") return t.toLowerCase();
  return "15m";
}

/** Fetch candles via public POST /info (no auth). Returns newest-first to match Blofin/TA. */
export async function getCandles(instId: string, bar: string, limit = 100): Promise<Candle[]> {
  const coin = instIdToCoin(instId);
  const interval = toHyperliquidInterval(bar);
  const endTime = Date.now();
  const intervalMs = intervalToMs(interval);
  const startTime = endTime - limit * intervalMs;

  const res = await fetch(HL_INFO_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "candleSnapshot",
      req: { coin, interval, startTime, endTime },
    }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const raw = (await res.json()) as Array<{ t?: number; T?: number; o: string; h: string; l: string; c: string; v: string }>;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const tuples: Candle[] = raw.map((c) => {
    const ts = String(c.T ?? c.t ?? 0);
    return [ts, c.o, c.h, c.l, c.c, c.v, "USDC", "USDC", "1"];
  });
  // Newest first (Blofin/TA convention)
  tuples.reverse();
  return tuples.slice(0, limit);
}

function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    "1m": 60_000,
    "3m": 3 * 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "2h": 2 * 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "8h": 8 * 60 * 60_000,
    "12h": 12 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
    "3d": 3 * 24 * 60 * 60_000,
    "1w": 7 * 24 * 60 * 60_000,
    "1M": 30 * 24 * 60 * 60_000,
  };
  return map[interval] ?? 15 * 60_000;
}

/** Last mid price for symbol. Uses public /info. */
export async function getTicker(instId: string): Promise<{ last: string } | null> {
  const coin = instIdToCoin(instId);
  const res = await fetch(HL_INFO_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const mids = (await res.json()) as Record<string, string>;
  const last = mids?.[coin] ?? mids?.[`${coin}-PERP`];
  return last != null ? { last: String(last) } : null;
}

/** Min size, contract value (1 for perps in units of coin), settle currency. */
export async function getInstrument(instId: string): Promise<{ minSize: string; contractValue: string; settleCurrency: string } | null> {
  const coin = instIdToCoin(instId);
  const res = await fetch(HL_INFO_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { universe?: Array<{ name: string; szDecimals: number }> };
  const universe = data?.universe ?? [];
  const spec = universe.find((u) => u.name === coin || u.name === `${coin}-PERP`);
  if (!spec) return null;
  const szDecimals = spec.szDecimals ?? 3;
  const minSize = Math.pow(10, -szDecimals);
  return {
    minSize: String(minSize),
    contractValue: "1",
    settleCurrency: "USDC",
  };
}

/** Open positions (for current wallet). */
export async function getPositions(instId?: string): Promise<{ instId: string; posSide: string; pos: string; avgPx: string }[]> {
  const api = getApi();
  if (!api) return [];
  try {
    await api.ensureInitialized();
    const wallet = new ethers.Wallet(getPrivateKey()!);
    const state = await api.perpsApi.getClearinghouseState(wallet.address);
    const positions = state?.assetPositions ?? [];
    const out: { instId: string; posSide: string; pos: string; avgPx: string }[] = [];
    for (const { position } of positions) {
      const szi = parseFloat(position?.szi ?? "0");
      if (szi === 0) continue;
      const coin = position?.coin ?? "";
      if (instId && instIdToCoin(instId) !== coin && instIdToCoin(instId) !== coin.replace("-PERP", "")) continue;
      out.push({
        instId: coin,
        posSide: szi > 0 ? "long" : "short",
        pos: String(Math.abs(szi)),
        avgPx: position?.entryPx ?? "0",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Set leverage (cross). */
export async function setLeverage(instId: string, leverage: number, _marginMode: "isolated" | "cross"): Promise<{ ok: boolean; error?: string }> {
  const api = getApi();
  if (!api) return { ok: false, error: "Hyperliquid private key not set" };
  try {
    await api.ensureInitialized();
    const exchange = api.getExchange();
    const coin = instIdToCoin(instId);
    await exchange.updateLeverage(coin, "cross", leverage);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Place market order (IOC limit at mid). Size in base units (e.g. 0.01 BTC). */
export async function placeMarketOrder(
  instId: string,
  side: "buy" | "sell",
  size: string,
  _marginMode: "isolated" | "cross" = "cross"
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const api = getApi();
  if (!api) return { ok: false, error: "Hyperliquid private key not set" };
  try {
    await api.ensureInitialized();
    const exchange = api.getExchange();
    const coin = instIdToCoin(instId);
    const sz = parseFloat(size);
    if (!Number.isFinite(sz) || sz <= 0) return { ok: false, error: "Invalid size" };
    const result = await exchange.placeOrder({
      coin: coin.includes("PERP") ? coin : `${coin}-PERP`,
      is_buy: side === "buy",
      sz: sz,
      limit_px: 0,
      order_type: { limit: { tif: "Ioc" } },
      reduce_only: false,
    });
    const statuses = result?.response?.data?.statuses;
    const first = Array.isArray(statuses) ? statuses[0] : null;
    const oid = first?.resting?.oid ?? first?.filled?.oid;
    return { ok: true, orderId: oid != null ? String(oid) : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function isHyperliquidConfigured(): boolean {
  return !!getPrivateKey();
}
