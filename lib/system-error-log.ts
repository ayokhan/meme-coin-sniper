/**
 * Durable owner-facing system / ops error log.
 * Use for crons, Stripe, unhandled route errors, email blasts — anything that fails in production.
 */

import { prisma } from "@/lib/db";

type LogDb = {
  systemErrorLog?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        source: string;
        message: string;
        detail: string | null;
        meta: string | null;
        createdAt: Date;
      }>
    >;
    deleteMany?: (args: unknown) => Promise<{ count: number }>;
  };
};

function errMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function errDetail(e: unknown): string | null {
  if (e instanceof Error && e.stack) return e.stack;
  return null;
}

export async function logSystemError(input: {
  source: string;
  message: string;
  detail?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const db = (prisma as unknown as LogDb).systemErrorLog;
  if (!db) {
    console.error("[system-error]", input.source, input.message, input.detail);
    return;
  }
  try {
    await db.create({
      data: {
        source: String(input.source).slice(0, 80),
        message: String(input.message).slice(0, 500),
        detail: input.detail ? String(input.detail).slice(0, 4000) : null,
        meta: input.meta ? JSON.stringify(input.meta).slice(0, 4000) : null,
      },
    });
  } catch (e) {
    console.error("[system-error] persist failed", e, input);
  }
}

/** Convenience for catch blocks. */
export async function logSystemException(
  source: string,
  e: unknown,
  meta?: Record<string, unknown>
): Promise<void> {
  await logSystemError({
    source,
    message: errMessage(e).slice(0, 500),
    detail: errDetail(e),
    meta,
  });
}

/**
 * After a master cron run, persist each job that reported ok: false.
 * Skips intentional skips (ok: true with skipped).
 */
export async function logCronJobFailures(
  results: Record<string, { ok?: boolean; message?: string; error?: string; [k: string]: unknown }>
): Promise<void> {
  for (const [job, result] of Object.entries(results)) {
    if (!result || result.ok !== false) continue;
    const message =
      (typeof result.message === "string" && result.message) ||
      (typeof result.error === "string" && result.error) ||
      `${job} failed`;
    await logSystemError({
      source: `cron.${job}`,
      message,
      meta: { job, ...result },
    });
  }
}

export async function listSystemErrorLogs(limit = 100, sourceFilter?: string) {
  const db = (prisma as unknown as LogDb).systemErrorLog;
  if (!db) return [];
  try {
    return await db.findMany({
      where: sourceFilter
        ? { source: { contains: sourceFilter, mode: "insensitive" } }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, limit)),
    });
  } catch {
    return [];
  }
}

export async function clearSystemErrorLogsOlderThan(days = 30): Promise<number> {
  const db = (prisma as unknown as LogDb).systemErrorLog;
  if (!db?.deleteMany) return 0;
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const res = await db.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return res.count ?? 0;
  } catch {
    return 0;
  }
}
