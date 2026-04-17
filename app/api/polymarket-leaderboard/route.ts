import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  fetchPolymarketClosedPositionsSorted,
  fetchPolymarketTraderLeaderboard,
  tradeTimestampToMs,
  type PolymarketClosedPositionRow,
  type PolymarketLeaderboardCategory,
  type PolymarketLeaderboardTimePeriod,
} from "@/lib/polymarket-data-api";
import { getPolymarketLeaderboardAccess } from "@/lib/polymarket-leaderboard-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const u = (s ?? "MONTH").toUpperCase();
  return (PERIODS.has(u) ? u : "MONTH") as PolymarketLeaderboardTimePeriod;
}

/** Start of current period in UTC (calendar day / ISO week Mon / month), or null for ALL. */
function periodStartUtcMs(period: PolymarketLeaderboardTimePeriod): number | null {
  if (period === "ALL") return null;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (period === "DAY") return d.getTime();
  if (period === "MONTH") {
    d.setUTCDate(1);
    return d.getTime();
  }
  // WEEK — Monday UTC
  const day = d.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + mondayOffset);
  return d.getTime();
}

function isProxyWallet(a: string | undefined): a is string {
  return !!a && /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

type BiggestWinRow = {
  rank: number;
  proxyWallet: string;
  displayName: string;
  marketTitle: string;
  slug?: string;
  realizedPnl: number;
  stakeUsd: number | null;
  payoutUsd: number | null;
};

async function computeBiggestWins(
  period: PolymarketLeaderboardTimePeriod,
  category: PolymarketLeaderboardCategory
): Promise<{ wins: BiggestWinRow[]; note: string }> {
  const cutoff = periodStartUtcMs(period);
  const leaders = await fetchPolymarketTraderLeaderboard({
    category,
    timePeriod: period,
    orderBy: "PNL",
    limit: 50,
    offset: 0,
  });
  const walletLabel = new Map<string, string>();
  for (const row of leaders) {
    const w = row.proxyWallet?.trim().toLowerCase();
    if (!isProxyWallet(w)) continue;
    const name =
      typeof row.userName === "string" && row.userName.trim()
        ? row.userName.trim()
        : `${w.slice(0, 6)}…${w.slice(-4)}`;
    walletLabel.set(w, name);
  }
  const wallets = leaders
    .map((e) => e.proxyWallet?.trim())
    .filter(isProxyWallet)
    .slice(0, 10);

  const seen = new Set<string>();
  const candidates: Array<PolymarketClosedPositionRow & { _wallet: string }> = [];

  const batches = await Promise.all(
    wallets.map(async (w) => {
      const rows = await fetchPolymarketClosedPositionsSorted(w, {
        limit: 50,
        offset: 0,
        sortBy: "REALIZEDPNL",
        sortDirection: "DESC",
      });
      return rows.map((r) => ({ ...r, _wallet: w }));
    })
  );

  for (const rows of batches) {
    for (const r of rows) {
      const pnl = Number(r.realizedPnl);
      if (!Number.isFinite(pnl) || pnl <= 0) continue;
      const tsMs = tradeTimestampToMs(r.timestamp);
      if (cutoff != null && (tsMs == null || tsMs < cutoff)) continue;
      const slug = typeof r.slug === "string" ? r.slug : "";
      const title = typeof r.title === "string" ? r.title : "";
      const outcome = typeof r.outcome === "string" ? r.outcome : "";
      const key = `${r._wallet}|${slug}|${title}|${outcome}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(r);
    }
  }

  candidates.sort((a, b) => Number(b.realizedPnl ?? 0) - Number(a.realizedPnl ?? 0));
  const top = candidates.slice(0, 25);

  const wins: BiggestWinRow[] = top.map((r, i) => {
    const w = r._wallet;
    const bought = Number(r.totalBought);
    const pnl = Number(r.realizedPnl);
    const stakeUsd = Number.isFinite(bought) && bought > 0 ? bought : null;
    const payoutUsd =
      stakeUsd != null && Number.isFinite(pnl) ? stakeUsd + pnl : Number.isFinite(pnl) ? pnl : null;
    return {
      rank: i + 1,
      proxyWallet: w,
      displayName: walletLabel.get(w.toLowerCase()) || `${w.slice(0, 6)}…${w.slice(-4)}`,
      marketTitle: (typeof r.title === "string" && r.title) || "Market",
      slug: typeof r.slug === "string" ? r.slug : undefined,
      realizedPnl: pnl,
      stakeUsd,
      payoutUsd,
    };
  });

  return {
    wins,
    note:
      "Biggest wins are approximated from the largest realized PnL on recently closed positions among the current top traders on this leaderboard (Polymarket public data API). Filters by time use resolved-position timestamps in UTC; totals may differ slightly from polymarket.com.",
  };
}

/** GET — trader leaderboard + optional biggest-wins sidebar (VIP + admin flag). */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketLeaderboardAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
          disabled: access.disabled,
          leaderboardDisabled: access.leaderboardDisabled,
        },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = parseCategory(searchParams.get("category"));
    const timePeriod = parsePeriod(searchParams.get("timePeriod"));
    const orderByRaw = (searchParams.get("orderBy") ?? "PNL").toUpperCase();
    const orderBy = orderByRaw === "VOL" ? "VOL" : "PNL";
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25));
    const offset = Math.min(1000, Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0));
    const userNameFilter = searchParams.get("userName")?.trim() || undefined;
    const includeWins = (searchParams.get("includeWins") ?? "1").toLowerCase() !== "0";

    const leaderboard = await fetchPolymarketTraderLeaderboard({
      category,
      timePeriod,
      orderBy,
      limit,
      offset,
      userName: userNameFilter,
    });

    let biggestWins: BiggestWinRow[] | undefined;
    let biggestWinsNote: string | undefined;
    if (includeWins) {
      const { wins, note } = await computeBiggestWins(timePeriod, category);
      biggestWins = wins;
      biggestWinsNote = note;
    }

    const hasMore = leaderboard.length === limit && offset + limit < 1000;

    return NextResponse.json({
      success: true,
      category,
      timePeriod,
      orderBy,
      offset,
      limit,
      hasMore,
      leaderboard,
      biggestWins,
      biggestWinsNote,
      polymarketLeaderboardUrl: (() => {
        const slug =
          timePeriod === "DAY" ? "today" : timePeriod === "WEEK" ? "weekly" : timePeriod === "MONTH" ? "monthly" : "all";
        return `https://polymarket.com/leaderboard/overall/${slug}/profit`;
      })(),
    });
  } catch (e) {
    console.error("polymarket-leaderboard:", e);
    const message = e instanceof Error ? e.message : "Failed to load leaderboard.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
