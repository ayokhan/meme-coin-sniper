/**
 * Resolve the best live mid for forex/CFD symbols for a signed-in user.
 * Prefer connected broker (MetaAPI) so UI/plans match what bots trade;
 * then Swissquote spot for metals; then Yahoo-calibrated ticker.
 */
import { getForexBrokerConfigForUser, type ForexBrokerId, FOREX_BROKER_IDS } from "@/lib/forex-broker-user-config";
import { getForexSpotMid, usesSpotCalibration } from "@/lib/forex-spot-feed";
import { getForexTicker, normalizeForexSymbol } from "@/lib/forex-market";
import { getMetaApiSymbolPrice, isMetaApiConfigured } from "@/lib/metaapi";

export type ForexLivePriceResult = {
  price: number;
  source: "broker" | "spot" | "yahoo";
  bid?: number;
  ask?: number;
};

async function firstConnectedMetaApiAccountId(
  userId: string,
  preferBroker?: ForexBrokerId | null
): Promise<string | null> {
  if (!isMetaApiConfigured()) return null;
  const order: ForexBrokerId[] = preferBroker
    ? [preferBroker, ...FOREX_BROKER_IDS.filter((b) => b !== preferBroker)]
    : [...FOREX_BROKER_IDS];
  for (const broker of order) {
    const cfg = await getForexBrokerConfigForUser(userId, broker);
    if (cfg?.metaApiAccountId) return cfg.metaApiAccountId;
  }
  return null;
}

/**
 * Live mid for UI / scalp plans. When the user has a linked MT account, use that
 * broker quote so XAUUSD matches what they see in MT5 (closer to their TV broker chart
 * if they use the same broker) — not a generic TradingView feed.
 */
export async function resolveForexLivePrice(input: {
  symbol: string;
  userId?: string | null;
  preferBroker?: ForexBrokerId | null;
}): Promise<ForexLivePriceResult | null> {
  const symbol = normalizeForexSymbol(input.symbol) || String(input.symbol ?? "").trim().toUpperCase();
  if (!symbol) return null;

  if (input.userId) {
    const accountId = await firstConnectedMetaApiAccountId(input.userId, input.preferBroker);
    if (accountId) {
      const quote = await getMetaApiSymbolPrice(accountId, symbol);
      if (quote && Number.isFinite(quote.last) && quote.last > 0) {
        return { price: quote.last, source: "broker", bid: quote.bid, ask: quote.ask };
      }
      // Try common gold aliases on MT
      if (symbol === "XAUUSD") {
        for (const alt of ["GOLD", "XAUUSDm", "XAUUSD."]) {
          const q2 = await getMetaApiSymbolPrice(accountId, alt);
          if (q2 && Number.isFinite(q2.last) && q2.last > 0) {
            return { price: q2.last, source: "broker", bid: q2.bid, ask: q2.ask };
          }
        }
      }
    }
  }

  if (usesSpotCalibration(symbol)) {
    const mid = await getForexSpotMid(symbol);
    if (mid != null && Number.isFinite(mid) && mid > 0) {
      return { price: mid, source: "spot" };
    }
  }

  const ticker = await getForexTicker(symbol);
  const last = ticker?.last ? Number(ticker.last) : NaN;
  if (Number.isFinite(last) && last > 0) return { price: last, source: "yahoo" };
  return null;
}
