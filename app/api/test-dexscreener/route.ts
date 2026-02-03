import { NextResponse } from "next/server";
import {
  getNewSolanaPairs,
  getTrendingSolanaPairs,
} from "@/lib/api-clients/dexscreener";

const DEXSCREENER_BASE = "https://api.dexscreener.com";

/**
 * GET /api/test-dexscreener
 * 1. Raw check: hit DexScreener and see exactly what comes back (status, body keys, pair count).
 * 2. Then run our filtered getNewSolanaPairs / getTrendingSolanaPairs.
 */
export async function GET() {
  const diagnostic: Record<string, unknown> = {};

  try {
    // Raw request to the URL we currently use (may 404 or return different shape)
    const pairsUrl = `${DEXSCREENER_BASE}/latest/dex/pairs/solana`;
    let rawPairsStatus = 0;
    let rawPairsBodyKeys: string[] = [];
    let rawPairsCount = 0;
    let rawPairsError = "";

    try {
      const rawRes = await fetch(pairsUrl, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
      rawPairsStatus = rawRes.status;
      const rawJson = await rawRes.json().catch(() => ({}));
      rawPairsBodyKeys = Object.keys(rawJson);
      const arr = rawJson.pairs ?? rawJson;
      rawPairsCount = Array.isArray(arr) ? arr.length : 0;
      if (!rawRes.ok) rawPairsError = typeof rawJson === "object" ? JSON.stringify(rawJson).slice(0, 200) : String(rawJson).slice(0, 200);
    } catch (e) {
      rawPairsError = e instanceof Error ? e.message : String(e);
    }

    diagnostic.rawPairs = {
      url: pairsUrl,
      status: rawPairsStatus,
      bodyKeys: rawPairsBodyKeys,
      pairsCount: rawPairsCount,
      error: rawPairsError || undefined,
    };

    // Raw request to search endpoint (this one is documented and returns pairs)
    const searchUrl = `${DEXSCREENER_BASE}/latest/dex/search?q=SOL`;
    let searchStatus = 0;
    let searchPairsCount = 0;
    try {
      const searchRes = await fetch(searchUrl, { headers: { Accept: "application/json" }, next: { revalidate: 0 } });
      searchStatus = searchRes.status;
      const searchJson = await searchRes.json().catch(() => ({}));
      const searchPairs = searchJson.pairs ?? [];
      searchPairsCount = Array.isArray(searchPairs) ? searchPairs.length : 0;
    } catch {
      // ignore
    }
    diagnostic.rawSearch = { url: searchUrl, status: searchStatus, pairsCount: searchPairsCount };

    // Our filtered helpers
    const [newPairs, trendingPairs] = await Promise.all([
      getNewSolanaPairs(3000, 240),
      getTrendingSolanaPairs(10),
    ]);

    const sample =
      newPairs[0] || trendingPairs[0]
        ? {
            symbol: (newPairs[0] || trendingPairs[0])?.baseToken?.symbol,
            dexId: (newPairs[0] || trendingPairs[0])?.dexId,
          }
        : null;

    return NextResponse.json({
      success: newPairs.length > 0 || trendingPairs.length > 0 || searchPairsCount > 0,
      message:
        rawPairsCount > 0
          ? "DexScreener /pairs/solana returned data"
          : searchPairsCount > 0
            ? "DexScreener /search returned data; /pairs/solana may not exist"
            : "DexScreener returned no pairs — check diagnostic",
      newPairsCount: newPairs.length,
      trendingCount: trendingPairs.length,
      sample,
      diagnostic,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "DexScreener request failed";
    return NextResponse.json(
      { success: false, message, newPairsCount: 0, trendingCount: 0, diagnostic },
      { status: 500 }
    );
  }
}
