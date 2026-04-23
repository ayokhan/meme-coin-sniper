import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNovaPerpWalletAnalystAccess } from "@/lib/nova-perp-wallet-analyst-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const access = await getNovaPerpWalletAnalystAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
      { status: access.status }
    );
  }
  return NextResponse.json({ success: true, isOwner: access.isOwner });
}
