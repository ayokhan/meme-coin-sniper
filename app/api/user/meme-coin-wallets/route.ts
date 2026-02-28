import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_MEME_COIN_WALLETS = 5;

/** GET: list current user's meme coin wallets (max 5). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const list = await (prisma as any).userMemeCoinWallet.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      success: true,
      wallets: list.map((w: { id: string; address: string; label: string | null; chain: string }) => ({ id: w.id, address: w.address, label: w.label, chain: w.chain })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list wallets";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST: add a meme coin wallet (max 5 per user). Body: { address, label?, chain? }. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim();
    const label = body.label != null ? String(body.label).trim() || null : null;
    const chain = (body.chain === "bsc" ? "bsc" : "solana") as string;
    if (!address) {
      return NextResponse.json({ success: false, error: "Address required" }, { status: 400 });
    }
    const count = await (prisma as any).userMemeCoinWallet.count({ where: { userId: session.user.id } });
    if (count >= MAX_MEME_COIN_WALLETS) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_MEME_COIN_WALLETS} meme coin wallets allowed. Remove one to add another.` },
        { status: 400 }
      );
    }
    await (prisma as any).userMemeCoinWallet.upsert({
      where: {
        userId_address: { userId: session.user.id, address },
      },
      create: { userId: session.user.id, address, label, chain },
      update: { label, chain },
    });
    const list = await (prisma as any).userMemeCoinWallet.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      success: true,
      wallets: list.map((w: { id: string; address: string; label: string | null; chain: string }) => ({ id: w.id, address: w.address, label: w.label, chain: w.chain })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add wallet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE: remove a meme coin wallet. Query: address=... */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.trim();
    if (!address) {
      return NextResponse.json({ success: false, error: "Address required" }, { status: 400 });
    }
    await (prisma as any).userMemeCoinWallet.deleteMany({
      where: { userId: session.user.id, address },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove wallet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
