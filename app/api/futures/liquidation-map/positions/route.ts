import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getPositions, type PositionRow } from "@/lib/blofin";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { instIdToMapSymbol, resolveBlofinConfigForFuturesSession } from "@/lib/futures-blofin-session";

export const dynamic = "force-dynamic";

function parseNum(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatPosition(p: PositionRow) {
  const symbol = instIdToMapSymbol(p.instId);
  const side = p.posSide === "short" ? "short" : "long";
  const entryPrice = parseNum(p.avgPx);
  const markPrice = parseNum(p.markPx);
  const leverage = parseNum(p.leverage);
  const liquidationPrice = parseNum(p.liqPx);
  const levLabel = leverage != null && leverage > 0 ? `${Math.round(leverage)}x` : "—";
  const entryLabel = entryPrice != null ? entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—";
  const label = `${symbol} ${side} ${levLabel} @ ${entryLabel}`;

  return {
    id: `${p.instId}:${side}`,
    instId: p.instId,
    symbol,
    side,
    entryPrice,
    markPrice,
    leverage,
    liquidationPrice,
    marginMode: p.marginMode ?? null,
    unrealizedPnl: parseNum(p.upl),
    label,
  };
}

/** GET — open Blofin positions for Liquidation Map import (VIP; owner may use server env keys). */
export async function GET() {
  try {
    const { tier, session } = await getSessionAndSubscription();
    const isOwner = !!session?.user?.isOwner;
    if (!(isOwner || tier === "vip")) {
      return NextResponse.json(
        { success: false, error: "VIP required for Liquidation Map.", locked: true, configured: false },
        { status: 403 }
      );
    }

    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_LIQUIDATION_MAP);
    if (!enabled) {
      return NextResponse.json(
        {
          success: false,
          error: "Liquidation Map is not available on your account yet.",
          disabled: true,
          configured: false,
        },
        { status: 403 }
      );
    }

    const authSession = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForFuturesSession(authSession, tier);
    if (!resolved.ok) {
      return NextResponse.json(
        {
          success: false,
          error: resolved.error,
          configured: false,
        },
        { status: resolved.status }
      );
    }

    const positions = await getPositions(undefined, {
      demo: resolved.config.demo,
      config: resolved.config,
    });

    return NextResponse.json({
      success: true,
      configured: true,
      credentialSource: resolved.credentialSource,
      positions: positions.map(formatPosition),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load Blofin positions.";
    return NextResponse.json({ success: false, error: message, configured: true }, { status: 500 });
  }
}
