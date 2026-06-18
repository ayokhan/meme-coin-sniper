import { NextResponse } from "next/server";
import { getTrendingBscPairs } from "@/lib/api-clients/dexscreener";
import { pairToMemeToken } from "@/lib/meme-token-out";

export async function GET() {
  try {
    const pairs = await getTrendingBscPairs(80);
    const tokens = pairs.map(pairToMemeToken);
    return NextResponse.json({ success: true, tokens });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "BSC trending failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
