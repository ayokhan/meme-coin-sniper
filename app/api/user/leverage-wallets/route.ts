import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET: list current user's leverage wallets. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const list = await prisma.userLeverageWallet.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      success: true,
      wallets: list.map((w) => ({
        id: w.id,
        address: w.address,
        nickname: w.nickname,
        alertEnabled: w.alertEnabled,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list wallets";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST: add a leverage wallet. Body: { address, nickname? }. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim().toLowerCase();
    const nickname = body.nickname != null ? String(body.nickname).trim() || null : null;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ success: false, error: "Valid 0x address required" }, { status: 400 });
    }
    await prisma.userLeverageWallet.upsert({
      where: {
        userId_address: { userId: session.user.id, address },
      },
      create: { userId: session.user.id, address, nickname, alertEnabled: true },
      update: { nickname },
    });
    const list = await prisma.userLeverageWallet.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      success: true,
      wallets: list.map((w) => ({
        id: w.id,
        address: w.address,
        nickname: w.nickname,
        alertEnabled: w.alertEnabled,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add wallet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE: remove a leverage wallet. Query: address=... */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.trim()?.toLowerCase();
    if (!address) {
      return NextResponse.json({ success: false, error: "Address required" }, { status: 400 });
    }
    await prisma.userLeverageWallet.deleteMany({
      where: { userId: session.user.id, address },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove wallet";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
