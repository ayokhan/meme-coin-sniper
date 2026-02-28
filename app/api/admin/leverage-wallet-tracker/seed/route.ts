import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { leverageDb } from "@/lib/leverage-db";
import { APEXLIQUID_TOP_TRADERS } from "@/lib/config/apexliquid-top-traders";

/** POST - Seed default ApexLiquid top trader addresses if table is empty. Owner only. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const count = await leverageDb.leverageWallet.count();
    if (count > 0) {
      return NextResponse.json({ success: true, message: "Leverage wallets already seeded.", count });
    }
    for (const { address } of APEXLIQUID_TOP_TRADERS) {
      const addr = address.trim().toLowerCase();
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) continue;
      await leverageDb.leverageWallet.upsert({
        where: { address: addr },
        create: { address: addr, active: true, alertEnabled: false },
        update: {},
      });
    }
    const newCount = await leverageDb.leverageWallet.count();
    return NextResponse.json({ success: true, message: `Seeded ${newCount} default wallets.`, count: newCount });
  } catch (e) {
    console.error("Admin leverage-wallet-tracker seed:", e);
    return NextResponse.json({ success: false, error: "Seed failed." }, { status: 500 });
  }
}
