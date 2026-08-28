import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getPnlCalculatorAccess } from "@/lib/pnl-calculator-access";
import { parseVisitorIdFromRequest } from "@/lib/pnl-calculator-quota";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const url = new URL(request.url);
  const visitorId = parseVisitorIdFromRequest(url, request.headers.get("x-visitor-id"));
  const access = await getPnlCalculatorAccess(session, {
    isOwner: isOwnerSession(session),
    visitorId,
  });
  if (!access.ok) {
    return NextResponse.json(
      {
        success: false,
        error: access.error,
        locked: access.locked,
        disabled: access.disabled,
        needsRegister: access.needsRegister,
      },
      { status: access.status }
    );
  }

  return NextResponse.json({
    success: true,
    isGuest: access.isGuest,
    unlimited: access.unlimited,
    used: access.used,
    limit: access.limit,
    remaining: access.remaining,
    isVip: access.isVip,
  });
}
