import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runNovaScalperTick } from "@/lib/nova-scalper-run";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/**
 * Optional cron: GET with Authorization: Bearer CRON_SECRET.
 * Runs one tick per enabled NovaScalper (user Blofin keys; env fallback for owners only is not applied per-user here — users should use UI polling or we only tick rows where getBlofinConfigForUser works).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.novaScalperConfig.findMany({ where: { enabled: true } });
  const results: { userId: string; ok: boolean; action?: string; error?: string }[] = [];
  for (const row of rows) {
    const r = await runNovaScalperTick(row.userId, { allowEnvFallback: true });
    results.push({ userId: row.userId, ok: r.ok, action: r.action, error: r.error });
  }
  return NextResponse.json({ success: true, processed: rows.length, results });
}
