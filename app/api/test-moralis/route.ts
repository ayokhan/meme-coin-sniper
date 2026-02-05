import { NextResponse } from "next/server";
import { getNewPumpFunTokens, isMoralisConfigured } from "@/lib/api-clients/moralis";

/**
 * GET /api/test-moralis
 * Check Moralis API: new Pump.fun tokens (used as fallback when Birdeye returns 0).
 */
export async function GET() {
  try {
    if (!isMoralisConfigured()) {
      return NextResponse.json({
        success: false,
        message: "Moralis is not configured.",
        count: 0,
        sample: [],
      });
    }
    const tokens = await getNewPumpFunTokens(10);
    const sample = tokens.slice(0, 5).map((t) => ({ address: t.address }));
    return NextResponse.json({
      success: tokens.length > 0,
      message:
        tokens.length > 0
          ? `Moralis returned ${tokens.length} new Pump.fun tokens.`
          : "Moralis returned 0 tokens (API OK, no new listings right now).",
      count: tokens.length,
      sample,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Moralis request failed";
    return NextResponse.json(
      { success: false, message, count: 0, sample: [] },
      { status: 500 }
    );
  }
}
