import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getInstrument } from "@/lib/blofin";
import { estimateBlofinIsolatedLiquidation } from "@/lib/blofin-estimated-liq";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { getBlofinMetalInstId, isBlofinMetal, normalizeMetalBase } from "@/lib/blofin-metals";
import { parsePositionNotionalUsdt, parsePositionContracts } from "@/lib/blofin-margin-tiers";
import { parseLeverage } from "@/lib/nova-radar-leverage";
import { parseTargetPrice } from "@/lib/nova-radar";

export const dynamic = "force-dynamic";

/** POST — Blofin-style isolated liquidation estimate (VIP). Uses saved Blofin keys for contract size when available. */
export async function POST(request: Request) {
  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json(
        { success: false, error: "NovaRadar liquidation estimate is for VIP subscribers.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeMetalBase(String(body.symbol ?? "BTC")) || "BTC";
    const entryPrice = parseTargetPrice(body.entryPrice ?? body.entry);
    const leverage = parseLeverage(body.leverage ?? body.lev);
    const side = String(body.side ?? "long").toLowerCase() === "short" ? "short" : "long";

    if (entryPrice == null || leverage == null) {
      return NextResponse.json(
        { success: false, error: "entryPrice and leverage required." },
        { status: 400 }
      );
    }

    const positionNotionalUsdt = parsePositionNotionalUsdt(
      body.positionNotionalUsdt ?? body.positionNotional ?? body.notionalUsdt
    );
    const positionContracts = parsePositionContracts(
      body.positionContracts ?? body.contracts ?? body.positionSize
    );

    let contractValue: number | null = null;
    const session = await getServerSession(authOptions);
    const userConfig = session?.user?.id ? await getBlofinConfigForUser(session.user.id) : null;

    if (isBlofinMetal(symbol)) {
      const instId = getBlofinMetalInstId(symbol);
      if (instId) {
        try {
          const inst = await getInstrument(instId, {
            config: userConfig ?? undefined,
            demo: userConfig?.demo,
          });
          const cv = inst ? Number(inst.contractValue) : NaN;
          if (Number.isFinite(cv) && cv > 0) contractValue = cv;
        } catch {
          /* optional */
        }
      }
    }

    const estimate = estimateBlofinIsolatedLiquidation({
      symbol,
      side,
      entryPrice,
      leverage,
      positionNotionalUsdt,
      positionContracts,
      contractValue,
    });

    return NextResponse.json({
      success: true,
      estimate,
      blofinKeysConfigured: !!userConfig,
      symbol,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Liquidation estimate failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
