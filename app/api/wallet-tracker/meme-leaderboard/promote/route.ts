import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/**
 * Owner-only: promote (or demote) a wallet to global so all users see it on the Meme Leaderboard.
 * Body: { address: string; nickname?: string; global?: boolean }
 *
 * Behaviour:
 *  - global: true  → upsert TrackedWallet with global=true, active=true (default), preserving/overriding label.
 *  - global: false → set global=false on the existing TrackedWallet (does not delete).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_LEADERBOARD);
    if (!enabled) {
      return NextResponse.json({ success: false, error: "Meme Leaderboard is disabled." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const address = String(body.address ?? "").trim();
    const nickname = body.nickname != null ? String(body.nickname).trim().slice(0, 64) || null : null;
    const global = body.global === false ? false : true;
    if (!address) {
      return NextResponse.json({ success: false, error: "Wallet address is required." }, { status: 400 });
    }

    if (!global) {
      await (prisma as unknown as {
        trackedWallet: { updateMany: (args: unknown) => Promise<unknown> };
      }).trackedWallet.updateMany({
        where: { address },
        data: { global: false },
      });
      return NextResponse.json({ success: true, address, global: false });
    }

    const existing = (await (prisma as unknown as {
      trackedWallet: { findUnique: (args: unknown) => Promise<{ id: string; label: string | null } | null> };
    }).trackedWallet.findUnique({ where: { address } })) as { id: string; label: string | null } | null;

    if (existing) {
      await (prisma as unknown as {
        trackedWallet: { update: (args: unknown) => Promise<unknown> };
      }).trackedWallet.update({
        where: { address },
        data: { global: true, active: true, label: nickname ?? existing.label },
      });
    } else {
      await (prisma as unknown as {
        trackedWallet: { create: (args: unknown) => Promise<unknown> };
      }).trackedWallet.create({
        data: { address, label: nickname, active: true, firstBuyEnabled: true, global: true },
      });
    }

    return NextResponse.json({ success: true, address, global: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Promote failed" },
      { status: 500 },
    );
  }
}
