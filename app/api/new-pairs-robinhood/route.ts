import { NextResponse } from "next/server";
import { getMemeRunnerChainPairs } from "@/lib/api-clients/dexscreener";
import {
  filterPairsForGoHuntingView,
  GO_HUNTING_DEX_ALLOWLIST,
  type GoHuntingView,
} from "@/lib/go-hunting-views";
import { pairToMemeToken } from "@/lib/meme-token-out";
import { checkGoHuntingRefreshLimit } from "@/lib/go-hunting-refresh-limit";

export async function GET(request: Request) {
  try {
    const limitCheck = await checkGoHuntingRefreshLimit(request);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: limitCheck.message,
          limitReached: true,
          retryAfterSeconds: limitCheck.retryAfterSeconds,
        },
        { status: 429, headers: { "Retry-After": String(limitCheck.retryAfterSeconds) } }
      );
    }

    const { searchParams } = new URL(request.url);
    const maxAgeMinutes = Math.min(parseInt(searchParams.get("maxAgeMinutes") || "120", 10), 1440);
    const view = (searchParams.get("view") || "new_pairs") as GoHuntingView;
    const minLiquidity = view === "new_pairs" ? 100 : 300;
    const limit = Math.min(300, parseInt(searchParams.get("limit") || "150", 10));
    const effectiveMaxAge = view === "new_pairs" ? Math.min(maxAgeMinutes, 180) : Math.min(maxAgeMinutes, 360);
    const dexAllow = GO_HUNTING_DEX_ALLOWLIST.robinhood[view];

    const pairs = await getMemeRunnerChainPairs({
      chain: "robinhood",
      minLiquidity,
      maxAgeMinutes: effectiveMaxAge,
      allowedDexIds: dexAllow,
      searchQueries: ["robinhood", "HOOD", "meme", "new token"],
      maxResults: 350,
    });

    const filtered = filterPairsForGoHuntingView(pairs, view, "robinhood");

    const byPair = new Map<string, ReturnType<typeof pairToMemeToken>>();
    for (const pair of filtered) {
      const t = pairToMemeToken(pair);
      const key = pair.pairAddress ?? t.contractAddress;
      byPair.set(key, t);
    }

    const tokens = Array.from(byPair.values())
      .sort((a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime())
      .slice(0, limit);

    const viewLabel =
      view === "new_pairs" ? "New pairs" : view === "final_stretch" ? "Final Stretch" : "Migrated";
    return NextResponse.json({
      success: true,
      tokens,
      maxAgeMinutes: effectiveMaxAge,
      view,
      description: `Robinhood Chain Go Hunting · ${viewLabel}: last ${effectiveMaxAge}m (AI viral score on each).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Robinhood new pairs failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
