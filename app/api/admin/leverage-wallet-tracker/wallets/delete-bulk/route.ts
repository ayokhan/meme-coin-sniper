import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { leverageDb } from "@/lib/leverage-db";

/** POST - Remove multiple leverage wallets. Body: { addresses: string[] }. Owner only. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const raw = body.addresses;
    const addresses: string[] = Array.isArray(raw)
      ? raw.map((a: unknown) => String(a).trim().toLowerCase()).filter((a) => a.length > 0)
      : [];
    if (addresses.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one address in "addresses" array.' }, { status: 400 });
    }
    let deleted = 0;
    for (const address of addresses) {
      const result = await leverageDb.leverageWallet.deleteMany({ where: { address } });
      deleted += result.count;
    }
    return NextResponse.json({
      success: true,
      deleted,
      message: `${deleted} wallet(s) removed.`,
    });
  } catch (e) {
    console.error("Admin leverage-wallet-tracker wallets delete-bulk:", e);
    return NextResponse.json({ success: false, error: "Failed to remove wallets." }, { status: 500 });
  }
}
