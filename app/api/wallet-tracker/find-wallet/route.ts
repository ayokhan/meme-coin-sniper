import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFindWalletAccess } from "@/lib/find-wallet-access";
import {
  getFindWalletConfig,
  getFindWalletUsage,
  recordFindWalletUse,
  resolveFindWalletDailyLimit,
  countFindWalletUsesToday,
} from "@/lib/find-wallet-quota";
import {
  findWalletsByTradeAmount,
  parseLookbackHours,
  parseUsdAmountInput,
  type FindWalletSide,
} from "@/lib/find-wallet-by-trade";
import { trialDeskLimitResponse } from "@/lib/trial-desk-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST — VIP: CA + optional USD amount → matching / recent trader wallets (consumes daily quota unless owner). */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getFindWalletAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
          disabled: access.disabled === true,
          locked: access.locked === true,
        },
        { status: access.status }
      );
    }

    const config = await getFindWalletConfig();
    if (!config.enabled && !access.isOwner) {
      return NextResponse.json(
        { success: false, error: "Find Wallet is currently disabled by admin.", locked: true, disabled: true },
        { status: 403 }
      );
    }

    const limited = await trialDeskLimitResponse(access.userId, "wallets");
    if (limited) return limited;

    if (!access.isOwner) {
      const dailyLimit = await resolveFindWalletDailyLimit(access.userId);
      if (dailyLimit === 0) {
        return NextResponse.json(
          { success: false, error: "Your Find Wallet access has been disabled.", locked: true },
          { status: 403 }
        );
      }
      const usedToday = await countFindWalletUsesToday(access.userId);
      if (usedToday >= dailyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Daily limit reached (${dailyLimit} search${dailyLimit !== 1 ? "es" : ""} per day — resets midnight UTC).`,
            locked: true,
            limitReached: true,
            used: usedToday,
            limit: dailyLimit,
          },
          { status: 429 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const ca = typeof body.ca === "string" ? body.ca.trim() : "";
    const amountRaw =
      typeof body.amountUsd === "number"
        ? String(body.amountUsd)
        : typeof body.amountUsd === "string"
          ? body.amountUsd
          : typeof body.amount === "string"
            ? body.amount
            : "";
    const amountTrimmed = amountRaw.trim();
    const amountUsd = amountTrimmed ? parseUsdAmountInput(amountTrimmed) : null;
    if (!ca) {
      return NextResponse.json({ success: false, error: "Contract address (CA) is required." }, { status: 400 });
    }
    if (amountTrimmed && amountUsd == null) {
      return NextResponse.json(
        { success: false, error: "Enter a valid USD amount (e.g. 49300 or 49.3K), or leave blank to browse recent trades." },
        { status: 400 }
      );
    }

    const sideRaw = typeof body.side === "string" ? body.side.toLowerCase() : amountUsd == null ? "any" : "buy";
    const side: FindWalletSide =
      sideRaw === "sell" ? "sell" : sideRaw === "any" ? "any" : "buy";
    const tolerancePct =
      typeof body.tolerancePct === "number" && Number.isFinite(body.tolerancePct)
        ? body.tolerancePct
        : 10;
    const lookbackHours = parseLookbackHours(body.lookbackHours ?? body.timeframeHours ?? 24);

    const result = await findWalletsByTradeAmount({
      ca,
      amountUsd,
      side,
      tolerancePct,
      lookbackHours,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    if (!access.isOwner) {
      await recordFindWalletUse(access.userId);
    }

    const usage = await getFindWalletUsage(access.userId, access.isOwner);
    return NextResponse.json({ success: true, ...result, usage });
  } catch (e) {
    console.error("Find wallet error:", e);
    return NextResponse.json({ success: false, error: "Failed to search trades." }, { status: 500 });
  }
}
