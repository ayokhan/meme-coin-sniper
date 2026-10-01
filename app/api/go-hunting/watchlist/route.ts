import { NextResponse } from "next/server";
import { fetchWatchlistRows, isGoHuntingChain, type WatchlistRequestItem } from "@/lib/go-hunting-multichain";

const MAX_ITEMS = 120;

/** Body: { items: [{ chain, address, symbol?, name? }] } — the watchlist lives in the browser, so the client sends it. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { items?: unknown };
    const raw = Array.isArray(body.items) ? body.items : [];
    const items: WatchlistRequestItem[] = [];
    const seen = new Set<string>();
    for (const r of raw.slice(0, MAX_ITEMS)) {
      const it = r as Partial<WatchlistRequestItem>;
      const address = typeof it.address === "string" ? it.address.trim() : "";
      if (!address || address.length > 64 || !isGoHuntingChain(it.chain)) continue;
      const key = `${it.chain}:${address}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        chain: it.chain,
        address,
        symbol: typeof it.symbol === "string" ? it.symbol.slice(0, 32) : undefined,
        name: typeof it.name === "string" ? it.name.slice(0, 64) : undefined,
      });
    }
    const tokens = items.length > 0 ? await fetchWatchlistRows(items) : [];
    return NextResponse.json({ success: true, tokens });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Watchlist failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
