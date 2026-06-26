export const SCALP_LIVE_PRICE_MS = 12_000;

export async function fetchScalpLivePrice(symbol: string): Promise<number | null> {
  const res = await fetch(`/api/nova-scalp-agent/price?symbol=${encodeURIComponent(symbol)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = (await res.json()) as { success?: boolean; price?: number | null };
  if (!res.ok || !data.success || data.price == null || !Number.isFinite(data.price)) return null;
  return data.price;
}
