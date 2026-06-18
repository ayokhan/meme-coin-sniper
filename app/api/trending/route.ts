import { NextResponse } from "next/server";
import { getTrendingSolanaPairs } from "@/lib/api-clients/dexscreener";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { pairToMemeToken } from "@/lib/meme-token-out";

export async function GET() {
  try {
    const { isPaid } = await getSessionAndSubscription();
    const FREE_LIMIT = 10;
    const pairs = await getTrendingSolanaPairs(isPaid ? 80 : FREE_LIMIT);
    const tokens = pairs.map(pairToMemeToken);
    return NextResponse.json({ success: true, tokens });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Trending failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
