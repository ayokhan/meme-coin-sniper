import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getPnlCalculatorAccess } from "@/lib/pnl-calculator-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const access = await getPnlCalculatorAccess(session, { isOwner: isOwnerSession(session) });
  if (!access.ok) {
    return NextResponse.json(
      {
        success: false,
        error: access.error,
        locked: access.locked,
        disabled: access.disabled,
        needsSignIn: access.needsSignIn,
      },
      { status: access.status }
    );
  }

  return NextResponse.json({
    success: true,
    unlimited: access.unlimited,
    used: access.used,
    limit: access.limit,
    remaining: access.remaining,
    isVip: access.isVip,
  });
}
