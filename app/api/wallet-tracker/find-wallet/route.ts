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

function parseOptionalAmount(body: Record<string, unknown>, ...keys: string[]): {
  raw: string;
  value: number | null;
} {
  for (const key of keys) {
    const v = body[key];
    if (typeof v === "number" && Number.isFinite(v)) return { raw: String(v), value: v > 0 ? v : null };
    if (typeof v === "string" && v.trim()) {
      const parsed = parseUsdAmountInput(v);
      return { raw: v.trim(), value: parsed };
    }
  }
  return { raw: "", value: null };
}

/** POST — VIP: CA + optional USD min/max range → trader wallets (consumes daily quota unless owner). */
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const ca = typeof body.ca === "string" ? body.ca.trim() : "";
    if (!ca) {
      return NextResponse.json({ success: false, error: "Contract address (CA) is required." }, { status: 400 });
    }

    const minParsed = parseOptionalAmount(body, "amountMinUsd", "amountMin", "minUsd", "min");
    const maxParsed = parseOptionalAmount(body, "amountMaxUsd", "amountMax", "maxUsd", "max");
    const centerParsed = parseOptionalAmount(body, "amountUsd", "amount");

    if (minParsed.raw && minParsed.value == null) {
      return NextResponse.json(
        { success: false, error: "Enter a valid Min USD (e.g. 800 or 0.8K)." },
        { status: 400 }
      );
    }
    if (maxParsed.raw && maxParsed.value == null) {
      return NextResponse.json(
        { success: false, error: "Enter a valid Max USD (e.g. 1200 or 1.2K)." },
        { status: 400 }
      );
    }
    if (centerParsed.raw && centerParsed.value == null) {
      return NextResponse.json(
        { success: false, error: "Enter a valid USD amount (e.g. 49300 or 49.3K), or use Min/Max range." },
        { status: 400 }
      );
    }

    const hasFilter = minParsed.value != null || maxParsed.value != null || centerParsed.value != null;
    const sideRaw =
      typeof body.side === "string" ? body.side.toLowerCase() : hasFilter ? "buy" : "any";
    const side: FindWalletSide =
      sideRaw === "sell" ? "sell" : sideRaw === "any" ? "any" : "buy";
    const tolerancePct =
      typeof body.tolerancePct === "number" && Number.isFinite(body.tolerancePct)
        ? body.tolerancePct
        : 10;
    const lookbackHours = parseLookbackHours(body.lookbackHours ?? body.timeframeHours ?? 24);

    const result = await findWalletsByTradeAmount({
      ca,
      amountMinUsd: minParsed.value,
      amountMaxUsd: maxParsed.value,
      amountUsd: centerParsed.value,
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
