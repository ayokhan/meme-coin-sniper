import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFindWalletAccess } from "@/lib/find-wallet-access";
import { findWalletsByTradeAmount, parseUsdAmountInput, type FindWalletSide } from "@/lib/find-wallet-by-trade";
import { trialDeskLimitResponse } from "@/lib/trial-desk-gate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST — VIP: find wallets matching CA + buy/sell USD amount. */
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

    const limited = await trialDeskLimitResponse(access.userId, "wallets");
    if (limited) return limited;

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
    const amountUsd = parseUsdAmountInput(amountRaw);
    if (!ca) {
      return NextResponse.json({ success: false, error: "Contract address (CA) is required." }, { status: 400 });
    }
    if (amountUsd == null) {
      return NextResponse.json(
        { success: false, error: "Enter a valid USD amount (e.g. 49300 or 49.3K)." },
        { status: 400 }
      );
    }

    const sideRaw = typeof body.side === "string" ? body.side.toLowerCase() : "buy";
    const side: FindWalletSide =
      sideRaw === "sell" ? "sell" : sideRaw === "any" ? "any" : "buy";
    const tolerancePct =
      typeof body.tolerancePct === "number" && Number.isFinite(body.tolerancePct)
        ? body.tolerancePct
        : 10;

    const result = await findWalletsByTradeAmount({
      ca,
      amountUsd,
      side,
      tolerancePct,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("Find wallet error:", e);
    return NextResponse.json({ success: false, error: "Failed to search trades." }, { status: 500 });
  }
}
