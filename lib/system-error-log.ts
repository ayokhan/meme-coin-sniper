/**
 * Durable ops / system error log for owner (cron failures, email send failures, etc.).
 */

import { prisma } from "@/lib/db";

export type SystemErrorSource =
  | "cron_vip_trial_emails"
  | "cron_vip_expiry_emails"
  | "cron_master"
  | "email_send"
  | "stripe_webhook"
  | "other";

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
  };
};

export async function logSystemError(input: {
  source: SystemErrorSource | string;
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

export async function listSystemErrorLogs(limit = 100) {
  const db = (prisma as unknown as LogDb).systemErrorLog;
  if (!db) return [];
  try {
    return await db.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, limit)),
    });
  } catch {
    return [];
  }
}
