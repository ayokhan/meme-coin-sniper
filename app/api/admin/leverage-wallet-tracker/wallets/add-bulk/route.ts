import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { leverageDb } from "@/lib/leverage-db";

function isValidEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

/** POST - Add multiple leverage wallets. Body: { wallets: Array<{ address, nickname? }> }. Owner only. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const raw = body.wallets;
    const items: { address: string; nickname?: string | null }[] = Array.isArray(raw)
      ? raw.map((w: unknown) => {
          if (typeof w === "string") return { address: w.trim().toLowerCase(), nickname: null };
          if (w && typeof w === "object" && "address" in w)
            return {
              address: String((w as { address: string }).address).trim().toLowerCase(),
              nickname: (w as { nickname?: string }).nickname ?? null,
            };
          return { address: "", nickname: null };
        }).filter((x) => x.address.length > 0)
      : [];
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'Provide a "wallets" array with at least one { address }.' }, { status: 400 });
    }
    let added = 0;
    let skipped = 0;
    for (const { address, nickname } of items) {
      if (!isValidEvmAddress(address)) {
        skipped++;
        continue;
      }
      const existing = await leverageDb.leverageWallet.findUnique({ where: { address } });
      if (existing) {
        skipped++;
        continue;
      }
      await leverageDb.leverageWallet.create({
        data: {
          address,
          nickname: typeof nickname === "string" ? nickname.trim() || null : null,
          active: true,
          alertEnabled: false,
        },
      });
      added++;
    }
    return NextResponse.json({
      success: true,
      added,
      skipped,
      message: `${added} wallet(s) added.${skipped > 0 ? ` ${skipped} skipped (invalid or already in list).` : ""}`,
    });
  } catch (e) {
    console.error("Admin leverage-wallet-tracker wallets add-bulk:", e);
    return NextResponse.json({ success: false, error: "Failed to add wallets." }, { status: 500 });
  }
}
