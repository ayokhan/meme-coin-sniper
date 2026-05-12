import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMemeLeaderboardAccess } from "@/lib/meme-leaderboard-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PER_USER = 25;

type UserMemeWallet = { id: string; address: string; label: string | null; chain: string };

/** GET: list current user's leaderboard personal wallets. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const access = await getMemeLeaderboardAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error, locked: access.locked === true, disabled: access.disabled === true, wallets: [] },
      { status: access.status },
    );
  }
  try {
    const list = (await (prisma as unknown as {
      userMemeCoinWallet: { findMany: (args: unknown) => Promise<UserMemeWallet[]> };
    }).userMemeCoinWallet.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "asc" },
    })) as UserMemeWallet[];
    return NextResponse.json({
      success: true,
      wallets: list.map((w) => ({ id: w.id, address: w.address, label: w.label, chain: w.chain })),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load wallets", wallets: [] },
      { status: 500 },
    );
  }
}

/** POST: add a wallet to the user's leaderboard. Body: { address, nickname?, chain? } */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await getMemeLeaderboardAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error, locked: access.locked === true, disabled: access.disabled === true },
      { status: access.status },
    );
  }
  try {
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim();
    const nickname = body.nickname != null ? String(body.nickname).trim().slice(0, 64) || null : null;
    const chain = (body.chain === "bsc" ? "bsc" : "solana") as string;
    if (!address) return NextResponse.json({ success: false, error: "Wallet address is required." }, { status: 400 });

    const count = (await (prisma as unknown as {
      userMemeCoinWallet: { count: (args: unknown) => Promise<number> };
    }).userMemeCoinWallet.count({ where: { userId: access.userId } })) as number;
    if (count >= MAX_PER_USER) {
      return NextResponse.json(
        { success: false, error: `You can track up to ${MAX_PER_USER} personal wallets. Remove one to add another.` },
        { status: 400 },
      );
    }

    await (prisma as unknown as {
      userMemeCoinWallet: { upsert: (args: unknown) => Promise<unknown> };
    }).userMemeCoinWallet.upsert({
      where: { userId_address: { userId: access.userId, address } },
      create: { userId: access.userId, address, label: nickname, chain },
      update: { label: nickname, chain },
    });

    const list = (await (prisma as unknown as {
      userMemeCoinWallet: { findMany: (args: unknown) => Promise<UserMemeWallet[]> };
    }).userMemeCoinWallet.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "asc" },
    })) as UserMemeWallet[];

    return NextResponse.json({
      success: true,
      wallets: list.map((w) => ({ id: w.id, address: w.address, label: w.label, chain: w.chain })),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to add wallet" },
      { status: 500 },
    );
  }
}

/** DELETE: remove a wallet from the user's leaderboard. Query ?address=... */
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await getMemeLeaderboardAccess(session);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, error: access.error, locked: access.locked === true, disabled: access.disabled === true },
      { status: access.status },
    );
  }
  try {
    const url = new URL(request.url);
    const address = url.searchParams.get("address")?.trim();
    if (!address) return NextResponse.json({ success: false, error: "Wallet address is required." }, { status: 400 });

    await (prisma as unknown as {
      userMemeCoinWallet: { deleteMany: (args: unknown) => Promise<unknown> };
    }).userMemeCoinWallet.deleteMany({ where: { userId: access.userId, address } });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to remove wallet" },
      { status: 500 },
    );
  }
}
