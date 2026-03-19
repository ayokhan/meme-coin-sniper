import { NextResponse } from "next/server";
import { getTrackedWallets } from "@/lib/wallet-tracker-config";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { canAccessMemeCoinsTrader } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { tier, session } = await getSessionAndSubscription();
  if (tier !== 'vip' || !canAccessMemeCoinsTrader(session)) {
    return NextResponse.json({ success: false, error: 'VIP + on-demand access required for Meme Coins Traders.', locked: true }, { status: 403 });
  }
  const wallets = await getTrackedWallets();
  return NextResponse.json({
    success: true,
    wallets: wallets.map((w) => ({ address: w.address, label: w.label })),
  });
}
