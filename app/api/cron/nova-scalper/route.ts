import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isOwnerUserId } from "@/lib/auth";
import { runNovaScalperTick } from "@/lib/nova-scalper-run";

export const dynamic = "force-dynamic";
/** Allow many users in one invocation; increase on Pro if needed. */
export const maxDuration = 300;

/**
 * Vercel Cron (see vercel.json): runs one Blofin tick per enabled NovaScalper user.
 * Auth: Authorization: Bearer CRON_SECRET (set in Vercel env).
 * Each user uses their saved keys; owner accounts may fall back to BLOFIN_* env per runNovaScalperTick rules.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
