import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { resolveBlofinConfigForFuturesSession } from "@/lib/futures-blofin-session";
import {
  computeNovaRadarCapitalGuard,
  parseCapitalRiskTolerance,
  parseInvestmentAmountUsdt,
} from "@/lib/nova-radar-capital-guard";
import { loadNovaRadarBlofinOpenPositions } from "@/lib/nova-radar-blofin-positions";
import { loadNovaRadarMarketContext } from "@/lib/nova-radar-market-context";
import { parseLeverage } from "@/lib/nova-radar-leverage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST — Capital Guard for an open Blofin position (rescue / no-SL detection). */
export async function POST(request: Request) {
  try {
    const { tier, session } = await getSessionAndSubscription();
    if (tier !== "vip" && !session?.user?.isOwner) {
      return NextResponse.json(
        { success: false, error: "NovaRadar is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const bodyRec = body as Record<string, unknown>;
    const positionId = String(bodyRec.positionId ?? bodyRec.id ?? "").trim();
    const riskTolerance = parseCapitalRiskTolerance(
      bodyRec.capitalRiskTolerance ?? bodyRec.riskLevel ?? bodyRec.riskTolerance
    );
    const investmentOverride = parseInvestmentAmountUsdt(
      bodyRec.investmentAmountUsdt ?? bodyRec.investmentAmount
    );
    const leverageOverride = parseLeverage(bodyRec.leverage);

    if (!positionId) {
      return NextResponse.json({ success: false, error: "Select an open Blofin position." }, { status: 400 });
    }
    if (!riskTolerance) {
      return NextResponse.json({ success: false, error: "Select a Capital Guard risk level." }, { status: 400 });
    }

    const authSession = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForFuturesSession(authSession, tier);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error, configured: false }, { status: resolved.status });
    }

    const positions = await loadNovaRadarBlofinOpenPositions(resolved.config);
    const position = positions.find((p) => p.id === positionId);
    if (!position) {
      return NextResponse.json(
        { success: false, error: "Position not found or already closed on Blofin." },
        { status: 404 }
      );
    }
    if (position.entryPrice == null || position.entryPrice <= 0) {
      return NextResponse.json({ success: false, error: "Could not read entry price for this position." }, { status: 400 });
    }

    const leverage = leverageOverride ?? (position.leverage != null && position.leverage >= 1 ? Math.round(position.leverage) : null);
    if (leverage == null || leverage < 1) {
      return NextResponse.json({ success: false, error: "Leverage required (from position or form)." }, { status: 400 });
    }

    const investmentAmountUsdt =
      investmentOverride ??
      (position.marginUsdt != null && position.marginUsdt > 0 ? position.marginUsdt : null);
    if (investmentAmountUsdt == null || investmentAmountUsdt <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter investment / margin (USDT). Blofin did not return margin for this position.",
        },
        { status: 400 }
      );
    }

    const market = await loadNovaRadarMarketContext(position.symbol);
    const structureRows = market.ok ? market.ctx.structureTimeframes : [];

    const openPositionMeta = {
      instId: position.instId,
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      markPrice: position.markPrice,
      leverage: position.leverage,
      liquidationPrice: position.liquidationPrice,
      marginUsdt: position.marginUsdt,
      hasExchangeStopLoss: position.hasExchangeStopLoss,
      exchangeStopLossPrice: position.exchangeStopLossPrice,
      missingStopAlert: position.missingStopAlert,
    };

    const capitalGuard = computeNovaRadarCapitalGuard({
      riskTolerance,
      investmentAmountUsdt,
      leverage,
      entryPrice: position.entryPrice,
      side: position.side,
      structureRows,
      userStopLossPrice: position.exchangeStopLossPrice,
      openPosition: openPositionMeta,
    });

    if (!capitalGuard) {
      return NextResponse.json({ success: false, error: "Could not compute Capital Guard." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      position,
      capitalGuard,
      marketRead: market.ok
        ? {
            symbol: market.ctx.symbol,
            currentPrice: market.ctx.currentPrice,
            marketDirection: market.ctx.marketDirection,
          }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Open position Capital Guard failed";
    console.error("open-position-guard:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
