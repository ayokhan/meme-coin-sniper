import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

function isValidEvmAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

/** GET — list Polymarket tracker wallets. Owner only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const rows = await prisma.polymarketTrackedWallet.findMany({ orderBy: { createdAt: "asc" } });
    const wallets = rows.map((r) => ({
      id: r.id,
      address: r.address,
      nickname: r.nickname,
      active: r.active,
      global: r.global,
      createdAt: r.createdAt.toISOString(),
    }));
    return NextResponse.json({ success: true, wallets });
  } catch (e) {
    console.error("Admin polymarket-tracker wallets GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load wallets." }, { status: 500 });
  }
}

/** POST — add wallet. Body: { address, nickname? }. Owner only. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim().toLowerCase();
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() || null : null;
    if (!address) {
      return NextResponse.json({ success: false, error: "Address is required." }, { status: 400 });
    }
    if (!isValidEvmAddress(address)) {
      return NextResponse.json({ success: false, error: "Invalid EVM address (0x…)." }, { status: 400 });
    }
    const existing = await prisma.polymarketTrackedWallet.findUnique({ where: { address } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Wallet already in list." }, { status: 400 });
    }
    await prisma.polymarketTrackedWallet.create({
      data: { address, nickname, active: true, global: true },
    });
    return NextResponse.json({ success: true, message: "Wallet added." });
  } catch (e) {
    console.error("Admin polymarket-tracker wallets POST:", e);
    return NextResponse.json({ success: false, error: "Failed to add wallet." }, { status: 500 });
  }
}

/** PATCH — update wallet. Body: { address, nickname?, active?, global? }. Owner only. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim().toLowerCase();
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() || null : undefined;
    const active = typeof body.active === "boolean" ? body.active : undefined;
    const global = typeof body.global === "boolean" ? body.global : undefined;
    if (!address) {
      return NextResponse.json({ success: false, error: "Address is required." }, { status: 400 });
    }
    const data: { nickname?: string | null; active?: boolean; global?: boolean } = {};
    if (nickname !== undefined) data.nickname = nickname;
    if (active !== undefined) data.active = active;
    if (global !== undefined) data.global = global;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "Provide nickname, active, or global." }, { status: 400 });
    }
    await prisma.polymarketTrackedWallet.updateMany({ where: { address }, data });
    return NextResponse.json({ success: true, message: "Updated." });
  } catch (e) {
    console.error("Admin polymarket-tracker wallets PATCH:", e);
    return NextResponse.json({ success: false, error: "Failed to update." }, { status: 500 });
  }
}

/** DELETE — ?address=0x…. Owner only. */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerEmail(session?.user?.email ?? null)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address")?.trim()?.toLowerCase();
    if (!address) {
      return NextResponse.json({ success: false, error: "Address is required." }, { status: 400 });
    }
    await prisma.polymarketTrackedWallet.deleteMany({ where: { address } });
    return NextResponse.json({ success: true, message: "Wallet removed." });
  } catch (e) {
    console.error("Admin polymarket-tracker wallets DELETE:", e);
    return NextResponse.json({ success: false, error: "Failed to remove wallet." }, { status: 500 });
  }
}
