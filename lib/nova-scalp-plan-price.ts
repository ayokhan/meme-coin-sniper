import type { ScalpPlanMarket } from "@/lib/scalp-plan-market";
import { scalpPlanPriceApi } from "@/lib/scalp-plan-market";

export const SCALP_LIVE_PRICE_MS = 12_000;

export async function fetchScalpLivePrice(
  symbol: string,
  market: ScalpPlanMarket = "crypto"
): Promise<number | null> {
  const res = await fetch(`${scalpPlanPriceApi(market)}?symbol=${encodeURIComponent(symbol)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json()) as { success?: boolean; price?: number | null };
  if (!res.ok || !data.success || data.price == null || !Number.isFinite(data.price)) return null;
  return data.price;
}
