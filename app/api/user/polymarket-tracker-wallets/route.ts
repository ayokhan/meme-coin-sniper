import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPolymarketTrackerAccess } from "@/lib/polymarket-tracker-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

/** GET — current user's Polymarket tracker wallets (personal list). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketTrackerAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, disabled: access.disabled },
        { status: access.status }
      );
    }
    const list = await prisma.userPolymarketTrackedWallet.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      success: true,
      wallets: list.map((w) => ({
        id: w.id,
        address: w.address,
        nickname: w.nickname,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list wallets";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST — add wallet. Body: { address, nickname? }. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketTrackerAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, disabled: access.disabled },
        { status: access.status }
      );
    }
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim().toLowerCase();
    const nicknameProvided = Object.prototype.hasOwnProperty.call(body, "nickname");
    const nickname = nicknameProvided ? String(body.nickname ?? "").trim().slice(0, 120) || null : null;
    if (!address || !isValidEvmAddress(address)) {
      return NextResponse.json({ success: false, error: "Valid 0x address required." }, { status: 400 });
    }
    await prisma.userPolymarketTrackedWallet.upsert({
      where: {
        userId_address: { userId: access.userId, address },
      },
      create: { userId: access.userId, address, nickname: nicknameProvided ? nickname : null },
      update: nicknameProvided ? { nickname } : {},
    });
    const list = await prisma.userPolymarketTrackedWallet.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      success: true,
      wallets: list.map((w) => ({
        id: w.id,
        address: w.address,
        nickname: w.nickname,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add wallet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE — ?address=0x… */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketTrackerAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, disabled: access.disabled },
        { status: access.status }
      );
    }
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.trim()?.toLowerCase();
    if (!address) {
      return NextResponse.json({ success: false, error: "Address required." }, { status: 400 });
    }
    await prisma.userPolymarketTrackedWallet.deleteMany({
      where: { userId: access.userId, address },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove wallet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
