import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import type { GoHuntingView } from "@/lib/go-hunting-views";
import { fetchSolanaGoHuntingTokens } from "@/lib/go-hunting-multichain";
import { checkGoHuntingRefreshLimit } from "@/lib/go-hunting-refresh-limit";

const FREE_LIMIT = 50;
const PAID_LIMIT = 300;

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

    const { isPaid } = await getSessionAndSubscription();
    const { searchParams } = new URL(request.url);
    const maxAgeMinutes = Math.min(parseInt(searchParams.get("maxAgeMinutes") || "120", 10), 1440);
    const view = (searchParams.get("view") || "new_pairs") as GoHuntingView;
    const requestedLimit = parseInt(searchParams.get("limit") || "150", 10);
    const limit = isPaid ? Math.min(PAID_LIMIT, Math.max(100, requestedLimit)) : Math.min(FREE_LIMIT, requestedLimit);
    const effectiveMaxAge = view === "new_pairs" ? Math.min(maxAgeMinutes, 240) : Math.min(maxAgeMinutes, 360);

    const tokens = (await fetchSolanaGoHuntingTokens(view, maxAgeMinutes)).slice(0, limit);

    const viewLabel =
      view === "new_pairs" ? "New pairs" : view === "final_stretch" ? "Final Stretch" : "Migrated";
    return NextResponse.json({
      success: true,
      tokens,
      maxAgeMinutes: effectiveMaxAge,
      view,
      description: `Go Hunting · ${viewLabel}: last ${effectiveMaxAge}m (AI viral score on each).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "New pairs failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
