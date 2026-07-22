import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runNovaForexScalperTick } from "@/lib/nova-forex-scalper-run";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
/** Allow many users in one invocation; increase on Pro if needed. */
export const maxDuration = 300;

/**
 * Nova Forex Scalper batch tick. Called from the main daily /api/cron (Hobby) or directly
 * (e.g. extra vercel.json cron on Pro). Gated by feature flag nova_forex_scalp_bot_cron
 * (Admin -> Feature flags). Default OFF. Auth: Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FOREX_SCALP_BOT_CRON);
  if (!cronEnabled) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason:
        "Nova Forex Scalper overnight automation is OFF. Enable it under Admin → Feature flags → Nova Forex Scalp Bot cron.",
      processed: 0,
      results: [] as { userId: string; ok: boolean; message?: string; error?: string }[],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const rows: { id: string; userId: string | null }[] = await db.novaForexScalperConfig.findMany({
    where: {
      enabled: true,
      ownerForceOff: false,
      userId: { not: null },
    },
    select: { id: true, userId: true },
  });

  const results: { userId: string; configId: string; ok: boolean; message?: string; error?: string }[] = [];

  for (const row of rows) {
    const userId = row.userId as string;
    const out = await runNovaForexScalperTick(userId, { configId: row.id });
    results.push({
      userId,
      configId: row.id,
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
