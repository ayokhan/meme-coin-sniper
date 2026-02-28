import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSubscriptionTier } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const MIN_BUYERS_OPTIONS = [2, 3, 4, 5] as const;

/** GET: return current user's wallet tracker alert threshold (minBuyers). VIP only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const tier = await getSubscriptionTier(session.user.id);
    if (tier !== "vip") {
      return NextResponse.json({ success: false, error: "VIP required to configure wallet tracker alerts.", locked: true }, { status: 403 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletTrackerMinBuyers: true },
    });
    const minBuyers = user?.walletTrackerMinBuyers ?? null;
    return NextResponse.json({ success: true, minBuyers });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PATCH: set minBuyers (2–5). Body: { minBuyers: number }. VIP only. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const tier = await getSubscriptionTier(session.user.id);
    if (tier !== "vip") {
      return NextResponse.json({ success: false, error: "VIP required to configure wallet tracker alerts.", locked: true }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const raw = body.minBuyers;
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (!Number.isInteger(n) || !(MIN_BUYERS_OPTIONS as readonly number[]).includes(n)) {
      return NextResponse.json(
        { success: false, error: "minBuyers must be 2, 3, 4, or 5" },
        { status: 400 }
      );
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { walletTrackerMinBuyers: n },
    });
    return NextResponse.json({ success: true, minBuyers: n });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save settings";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
