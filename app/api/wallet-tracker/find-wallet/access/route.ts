import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFindWalletAccess } from "@/lib/find-wallet-access";
import { getFindWalletUsage } from "@/lib/find-wallet-quota";

export const dynamic = "force-dynamic";

export async function GET() {
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
  const usage = await getFindWalletUsage(access.userId, access.isOwner);
  return NextResponse.json({ success: true, isOwner: access.isOwner, usage });
}
