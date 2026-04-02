import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isOwnerUserId } from "@/lib/auth";
import { runNovaScalperTick } from "@/lib/nova-scalper-run";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
/** Allow many users in one invocation; increase on Pro if needed. */
export const maxDuration = 300;

/**
 * NovaScalper batch tick. Called from the main daily /api/cron (Hobby) or directly (e.g. extra vercel.json cron on Pro).
 * Gated by feature flag nova_scalper_cron (Admin → Feature flags). Default OFF.
 * Auth: Authorization: Bearer CRON_SECRET (set in Vercel env).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_SCALPER_CRON);
  if (!cronEnabled) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "NovaScalper cron is OFF. Enable Admin → Feature flags → NovaScalper scheduled cron.",
      processed: 0,
      results: [] as { userId: string; ok: boolean; message?: string; error?: string }[],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const rows: { userId: string | null }[] = await db.novaScalperConfig.findMany({
    where: { enabled: true, userId: { not: null } },
    select: { userId: true },
  });

  const results: { userId: string; ok: boolean; message?: string; error?: string }[] = [];

  for (const row of rows) {
    const userId = row.userId as string;
    const envFallbackForOwner = await isOwnerUserId(userId);
    const out = await runNovaScalperTick(userId, { envFallbackForOwner });
    results.push({
      userId,
      ok: out.ok,
      message: out.message,
      error: out.error,
    });
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}
