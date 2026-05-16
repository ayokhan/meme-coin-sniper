import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEliteCount, scanPolymarketEliteConsensus } from "@/lib/polymarket-elite";
import { getPolymarketEliteAccess } from "@/lib/polymarket-elite-access";
import type { PolymarketLeaderboardCategory, PolymarketLeaderboardTimePeriod } from "@/lib/polymarket-data-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

const CATEGORIES = new Set([
  "OVERALL",
  "POLITICS",
  "SPORTS",
  "CRYPTO",
  "CULTURE",
  "MENTIONS",
  "WEATHER",
  "ECONOMICS",
  "TECH",
  "FINANCE",
]);

const PERIODS = new Set(["DAY", "WEEK", "MONTH", "ALL"]);

function parseCategory(s: string | null): PolymarketLeaderboardCategory {
  const u = (s ?? "OVERALL").toUpperCase();
  return (CATEGORIES.has(u) ? u : "OVERALL") as PolymarketLeaderboardCategory;
}

function parsePeriod(s: string | null): PolymarketLeaderboardTimePeriod {
  const u = (s ?? "WEEK").toUpperCase();
  return (PERIODS.has(u) ? u : "WEEK") as PolymarketLeaderboardTimePeriod;
}

/** GET — elite trader consensus signals (leaderboard top wallets + overlapping recent trades). */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketEliteAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
          disabled: access.disabled,
          eliteDisabled: access.eliteDisabled,
        },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = parseCategory(searchParams.get("category"));
    const timePeriod = parsePeriod(searchParams.get("timePeriod"));
    const lbRaw = searchParams.get("lookbackHours");
    const lookbackHours =
      lbRaw != null && lbRaw !== ""
        ? Math.min(336, Math.max(6, parseInt(lbRaw, 10) || 72))
        : undefined;

    const eliteCount = normalizeEliteCount(
      searchParams.get("eliteCount") ? parseInt(searchParams.get("eliteCount")!, 10) : 5
    );

    const result = await scanPolymarketEliteConsensus({
      category,
      timePeriod,
      eliteCount,
      lookbackHours: lookbackHours || undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("polymarket-elite/signals:", e);
    const message = e instanceof Error ? e.message : "Failed to scan elite signals.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
