import { NextResponse } from "next/server";
import { getTrackedWallets } from "@/lib/wallet-tracker-config";

export const dynamic = 'force-dynamic';

export async function GET() {
  const wallets = await getTrackedWallets();
  return NextResponse.json({
    success: true,
    wallets: wallets.map((w) => ({ address: w.address, label: w.label })),
  });
}
