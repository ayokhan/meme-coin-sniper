import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFuturesBalance, getFillsHistory, getOrderHistory, getPositions, getTicker, getInstrument } from "@/lib/blofin";
import { resolveBlofinPositionPnl } from "@/lib/blofin-position-pnl";
import {
  analyzeClosedTrades,
  closedTradesFromFills,
  closedTradesFromOrders,
  filterClosedTradesByPeriod,
  mergeClosedTrades,
  sumClosedTradesRealized,
} from "@/lib/closed-trades";
import {
  computePropFirmGuards,
  computePropFirmMetrics,
  type PropFirmConfig,
  type SessionState,
  type SyncedPosition,
} from "@/lib/prop-firm-bot";
import { getPropFirmBlofinMeta, resolveBlofinConfigForPropFirmSession } from "@/lib/prop-firm-blofin-session";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

function parseNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

type SyncBody = {
  cfg?: Partial<PropFirmConfig>;
  state?: Partial<SessionState>;
  proposedRiskUsd?: number;
  /** Override demo vs live for this sync (must match where you trade on Blofin). */
  blofinDemo?: boolean;
};

async function loadPositionsWithPnl(
  blofinDemo: boolean,
  config: Parameters<typeof getPositions>[1] extends infer O ? O extends { config?: infer C } ? C : never : never
) {
  const positions = await getPositions(undefined, { demo: blofinDemo, config });
  if (!positions.length) return { positions: [] as SyncedPosition[], totalUnrealizedPnl: 0, openRiskUsd: 0, openContracts: 0 };

  const uniqueInstIds = [...new Set(positions.map((p) => p.instId).filter(Boolean))];
  const instData = await Promise.all(
    uniqueInstIds.map(async (id) => {
      const [instrument, ticker] = await Promise.all([
        getInstrument(id, { demo: blofinDemo, config }),
        getTicker(id, blofinDemo, { config }),
      ]);
      return {
        instId: id,
        contractValue: instrument ? parseNum(instrument.contractValue) : 0,
        markPrice: ticker?.last ? parseNum(ticker.last) : 0,
      };
    })
  );
  const byInst = Object.fromEntries(instData.map((d) => [d.instId, d]));

  const withPnl: SyncedPosition[] = positions.map((pos) => {
    const size = Math.abs(parseNum(pos.pos));
    const entryPrice = parseNum(pos.avgPx);
    const d = byInst[pos.instId] ?? { contractValue: 0, markPrice: 0 };
    const markFromRow = pos.markPx != null && pos.markPx !== "" ? parseNum(pos.markPx) : null;
    const markPrice =
      markFromRow != null && Number.isFinite(markFromRow) && markFromRow > 0 ? markFromRow : d.markPrice;
    const pnl = resolveBlofinPositionPnl(pos, { markPrice, contractValue: d.contractValue ?? 0 });
    const marginNum = pos.margin != null && pos.margin !== "" ? parseNum(pos.margin) : null;
    return {
      instId: pos.instId,
      posSide: pos.posSide,
      size,
      entryPrice,
      markPrice: pnl.markPrice,
      unrealizedPnl: pnl.unrealizedPnl,
      margin: Number.isFinite(marginNum) ? marginNum : null,
      leverage: pnl.leverage,
    };
  });

  const totalUnrealizedPnl = withPnl.reduce((s, p) => s + p.unrealizedPnl, 0);
  const openRiskUsd = withPnl.reduce((s, p) => s + (p.margin ?? Math.abs(p.unrealizedPnl)), 0);
  const openContracts = withPnl.reduce((s, p) => s + p.size, 0);
  return { positions: withPnl, totalUnrealizedPnl, openRiskUsd, openContracts };
}

/** POST — sync challenge state from Blofin + return entry/exit guardrails. */
export async function POST(request: Request) {
  try {
    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_PROP_FIRM_BOT);
    if (!enabled) {
      return NextResponse.json({ success: false, error: "Nova Prop Firm Challenge is disabled." }, { status: 403 });
    }

    const blofinEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PROP_FIRM_BLOFIN);
    if (!blofinEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Blofin integration is disabled for Nova Prop Firm Challenge. Use manual tracking.",
          blofinIntegrationEnabled: false,
        },
        { status: 403 }
      );
    }

    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForPropFirmSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error, configured: false }, { status: resolved.status });
    }

    const body = (await request.json().catch(() => ({}))) as SyncBody;
    const cfg = body.cfg as PropFirmConfig | undefined;
    const state = body.state as SessionState | undefined;
    const proposedRiskUsd = Number(body.proposedRiskUsd) || 0;

    if (!cfg?.accountSize) {
      return NextResponse.json({ success: false, error: "Challenge config required." }, { status: 400 });
    }

    const { config, credentialSource } = resolved;
    const blofinDemo =
      typeof body.blofinDemo === "boolean" ? body.blofinDemo : config.demo;
    const blofin = getPropFirmBlofinMeta(config, credentialSource, blofinDemo);
    const leverage = 10;

    const [positionPack, fills, orders, balances] = await Promise.all([
      loadPositionsWithPnl(blofin.blofinDemo, config),
      getFillsHistory({ demo: blofin.blofinDemo, limit: 100, config }).catch(() => []),
      getOrderHistory({ demo: blofin.blofinDemo, limit: 100, config }),
      getFuturesBalance({ demo: blofin.blofinDemo, config }).catch(() => []),
    ]);

    const fromFills = closedTradesFromFills(fills, leverage);
    const fromOrders = closedTradesFromOrders(orders, leverage);
    const allClosed = mergeClosedTrades(fromFills, fromOrders);
    const closed24h = filterClosedTradesByPeriod(allClosed, "24h");
    const closed30d = filterClosedTradesByPeriod(allClosed, "30d");

    const dayResetMs = state?.dayResetAt ? Date.parse(state.dayResetAt) : NaN;
    const closedToday =
      Number.isFinite(dayResetMs)
        ? closed24h.filter((t) => {
            const ts = t.closedAt ? Date.parse(t.closedAt) : NaN;
            // closedAt may be unix ms string — Date.parse handles ISO; normalizeUnixMs for numeric
            if (Number.isFinite(ts) && ts >= dayResetMs) return true;
            const n = Number(t.closedAt);
            const ms = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : NaN;
            return Number.isFinite(ms) && ms >= dayResetMs;
          })
        : closed24h;

    const todaysRealizedPnl = sumClosedTradesRealized(closedToday);
    const totalRealizedPnl = sumClosedTradesRealized(closed30d);
    const tradesToday = analyzeClosedTrades(closedToday).totalTrades;

    const syncedState: SessionState = {
      startBalance: cfg.accountSize,
      currentBalance: cfg.accountSize + totalRealizedPnl + positionPack.totalUnrealizedPnl,
      todaysPnl: todaysRealizedPnl + positionPack.totalUnrealizedPnl,
      openRiskUsd: positionPack.openRiskUsd,
      tradesToday,
      challengeStartedAt: state?.challengeStartedAt ?? new Date().toISOString(),
      dayResetAt: state?.dayResetAt ?? null,
    };

    const metrics = computePropFirmMetrics(cfg, syncedState, positionPack.openContracts);
    const guards = computePropFirmGuards(cfg, syncedState, positionPack.positions, proposedRiskUsd);

    const usdtBalance = balances.find((b) => b.currency === "USDT");
    const blofinBalanceUsd = usdtBalance ? parseNum(usdtBalance.balance) : null;

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      blofin,
      blofinBalanceUsd,
      state: syncedState,
      positions: positionPack.positions,
      metrics,
      guards,
      syncMeta: {
        todaysRealizedPnl,
        totalRealizedPnl,
        totalUnrealizedPnl: positionPack.totalUnrealizedPnl,
        openContracts: positionPack.openContracts,
        tradesToday,
      },
    });
  } catch (e) {
    console.error("Prop firm bot sync:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Sync failed." },
      { status: 500 }
    );
  }
}

/** GET — Blofin connection status for prop firm workspace. */
export async function GET() {
  try {
    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_PROP_FIRM_BOT);
    if (!enabled) {
      return NextResponse.json({
        success: true,
        configured: false,
        canAccess: false,
        featureDisabled: true,
        blofinIntegrationEnabled: false,
        error: "Nova Prop Firm Challenge is disabled by admin.",
      });
    }

    const blofinEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PROP_FIRM_BLOFIN);
    if (!blofinEnabled) {
      return NextResponse.json({
        success: true,
        configured: false,
        canAccess: true,
        blofinIntegrationEnabled: false,
        error: "Blofin integration is disabled for Nova Prop Firm Challenge. Use manual tracking.",
      });
    }

    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForPropFirmSession(session);
    if (!resolved.ok) {
      return NextResponse.json({
        success: true,
        configured: false,
        canAccess: resolved.status !== 403,
        error: resolved.error,
      });
    }
    const blofin = getPropFirmBlofinMeta(resolved.config, resolved.credentialSource);
    return NextResponse.json({
      success: true,
      configured: true,
      canAccess: true,
      blofinIntegrationEnabled: true,
      blofin,
    });
  } catch (e) {
    console.error("Prop firm bot status:", e);
    return NextResponse.json({ success: false, error: "Failed to check Blofin status." }, { status: 500 });
  }
}
