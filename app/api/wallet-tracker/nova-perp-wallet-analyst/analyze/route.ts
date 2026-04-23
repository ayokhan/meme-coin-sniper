import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTopTradersPositions, getUserFills } from "@/lib/api-clients/hyperliquid";
import { getNovaPerpWalletAnalystAccess } from "@/lib/nova-perp-wallet-analyst-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FillLike = { coin?: string; dir?: string; sz?: string; time?: number };

function inferOpenPositionOpenedAtFromFills(fills: FillLike[]): Map<string, number> {
  type CoinState = { net: number; openedAtMs: number | null };
  const byCoin = new Map<string, CoinState>();
  const asc = [...fills]
    .filter((f) => Number.isFinite(Number(f?.time ?? 0)) && Number(f?.time ?? 0) > 0)
    .sort((a, b) => Number(a.time ?? 0) - Number(b.time ?? 0));

  for (const f of asc) {
    const coin = String(f.coin ?? "").trim().toLowerCase();
    if (!coin) continue;
    const dir = String(f.dir ?? "").toLowerCase();
    const sz = Number(f.sz ?? "0");
    const ts = Number(f.time ?? 0);
    if (!Number.isFinite(sz) || sz <= 0 || !Number.isFinite(ts) || ts <= 0) continue;

    let delta = 0;
    if (dir.startsWith("open long") || dir.startsWith("add long")) delta = sz;
    else if (dir.startsWith("close long") || dir.startsWith("reduce long")) delta = -sz;
    else if (dir.startsWith("open short") || dir.startsWith("add short")) delta = -sz;
    else if (dir.startsWith("close short") || dir.startsWith("reduce short")) delta = sz;
    else continue;

    const cur = byCoin.get(coin) ?? { net: 0, openedAtMs: null };
    const before = cur.net;
    const after = before + delta;
    let openedAtMs = cur.openedAtMs;

    if (Math.abs(after) <= 1e-12) {
      byCoin.set(coin, { net: 0, openedAtMs: null });
      continue;
    }
    if (Math.abs(before) <= 1e-12 || before * after < 0 || openedAtMs == null) {
      openedAtMs = ts;
    }
    byCoin.set(coin, { net: after, openedAtMs });
  }

  const out = new Map<string, number>();
  for (const [coin, state] of byCoin.entries()) {
    if (!state.openedAtMs || Math.abs(state.net) <= 1e-12) continue;
    const side = state.net > 0 ? "long" : "short";
    out.set(`${coin}|${side}`, state.openedAtMs);
  }
  return out;
}

function recommendAction(winRate: number, closedTrades: number, totalRealizedPnlUsd: number): "copy" | "monitor" | "ignore" {
  if (closedTrades < 10) return "monitor";
  if (winRate >= 60 && totalRealizedPnlUsd > 0) return "copy";
  if (winRate >= 45) return "monitor";
  return "ignore";
}

function buildRecommendationDetails(winRate: number, closedTrades: number, totalRealizedPnlUsd: number): {
  confidenceScore: number;
  reasons: string[];
  thresholds: { minClosedTradesForStrongSignal: number; copyWinRatePct: number; monitorWinRatePct: number };
} {
  const thresholds = {
    minClosedTradesForStrongSignal: 10,
    copyWinRatePct: 60,
    monitorWinRatePct: 45,
  };
  const reasons: string[] = [];

  if (closedTrades < thresholds.minClosedTradesForStrongSignal) {
    reasons.push(`Only ${closedTrades} closed positions sampled (< ${thresholds.minClosedTradesForStrongSignal}); confidence is reduced.`);
  } else {
    reasons.push(`Sample size is ${closedTrades} closed positions (meets baseline).`);
  }
  reasons.push(`Win rate is ${winRate.toFixed(1)}%.`);
  reasons.push(
    `Total realized PnL is ${totalRealizedPnlUsd >= 0 ? "+" : ""}${Math.round(totalRealizedPnlUsd).toLocaleString()} USD.`
  );

  let score = 0;
  if (closedTrades >= thresholds.minClosedTradesForStrongSignal) score += 30;
  else score += Math.max(0, Math.round((closedTrades / thresholds.minClosedTradesForStrongSignal) * 30));

  if (winRate >= thresholds.copyWinRatePct) score += 45;
  else if (winRate >= thresholds.monitorWinRatePct) score += 25;
  else score += 5;

  if (totalRealizedPnlUsd > 0) score += 25;
  else if (totalRealizedPnlUsd > -2_000) score += 10;
  else score += 0;

  return { confidenceScore: Math.max(0, Math.min(100, score)), reasons, thresholds };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaPerpWalletAnalystAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim().toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ success: false, error: "Valid 0x wallet address required." }, { status: 400 });
    }

    const [topRows, fills] = await Promise.all([
      getTopTradersPositions([{ address }]),
      getUserFills(address).catch(() => []),
    ]);
    const row = topRows[0];
    const openedAtByCoinSide = inferOpenPositionOpenedAtFromFills(fills);

    const openPositions = (row?.positions ?? []).map((p) => {
      const openedAtMs = openedAtByCoinSide.get(`${p.coin.toLowerCase()}|${p.side}`);
      return {
        coin: p.coin,
        side: p.side,
        szi: p.szi,
        entryPx: Number(p.entryPx ?? 0),
        positionUsd: Number(p.positionValue ?? 0),
        unrealizedPnlUsd: Number(p.unrealizedPnl ?? 0),
        leverage: p.leverage ?? null,
        liquidationPx: p.liquidationPx != null ? Number(p.liquidationPx) : null,
        openedAtMs: openedAtMs ?? null,
      };
    });

    const closed = fills.filter((f) => {
      const dir = String(f.dir ?? "").toLowerCase();
      return dir.includes("close") || dir.includes("reduce");
    });
    const withPnl = closed.filter((f) => Number.isFinite(Number(f.closedPnl ?? "")));
    const wins = withPnl.filter((f) => Number(f.closedPnl ?? "0") > 0).length;
    const losses = withPnl.filter((f) => Number(f.closedPnl ?? "0") < 0).length;
    const closedTrades = withPnl.length;
    const winRate = closedTrades > 0 ? (wins / closedTrades) * 100 : 0;
    const totalRealizedPnlUsd = withPnl.reduce((sum, f) => sum + Number(f.closedPnl ?? "0"), 0);
    const avgRealizedPnlUsd = closedTrades > 0 ? totalRealizedPnlUsd / closedTrades : 0;
    const recommendation = recommendAction(winRate, closedTrades, totalRealizedPnlUsd);
    const recommendationDetails = buildRecommendationDetails(winRate, closedTrades, totalRealizedPnlUsd);

    return NextResponse.json({
      success: true,
      isOwner: access.isOwner,
      address,
      recommendation,
      summary:
        recommendation === "copy"
          ? "Profile looks strong enough to copy with disciplined risk sizing."
          : recommendation === "monitor"
            ? "Profile is mixed/early. Monitor behavior before committing to copy."
            : "Profile is weak right now. Better to ignore than copy.",
      accountValueUsd: Number(row?.accountValue ?? 0),
      metrics: {
        winRate,
        wins,
        losses,
        closedTrades,
        openPositions: openPositions.length,
        totalRealizedPnlUsd,
        avgRealizedPnlUsd,
        fillsSampled: fills.length,
      },
      recommendationDetails,
      openPositions,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to analyze wallet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
