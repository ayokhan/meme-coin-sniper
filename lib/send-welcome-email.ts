/**
 * Auto-send welcome email after signup (noreply — do not invite email replies).
 * Logs each attempt to WelcomeEmailLog for Admin → Emails audit.
 */

import { WELCOME_EMAIL } from "@/lib/welcome-email";
import { buildAnnouncementEmailHtml } from "@/lib/announcement-email";
import { sendEmailDetailed } from "@/lib/send-email";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

const START_HERE_URL =
  (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "") + "/start-here";

export type WelcomeEmailSource = "register" | "google";

function isTransientSendError(error: string): boolean {
  const e = error.toLowerCase();
  return (
    e.includes("fetch failed") ||
    e.includes("network") ||
    e.includes("econnreset") ||
    e.includes("etimedout") ||
    e.includes("socket") ||
    e.includes("503") ||
    e.includes("429") ||
    e.includes("timeout")
  );
}

async function logWelcome(args: {
  email: string;
  userId?: string | null;
  success: boolean;
  error?: string | null;
  source: WelcomeEmailSource;
}): Promise<void> {
  try {
    await (
      prisma as unknown as {
        welcomeEmailLog: {
          create: (a: { data: Record<string, unknown> }) => Promise<unknown>;
        };
      }
    ).welcomeEmailLog.create({
      data: {
        email: args.email,
        userId: args.userId ?? null,
        success: args.success,
        error: args.error ?? null,
        source: args.source,
      },
    });
  } catch (e) {
    console.warn("WelcomeEmailLog create failed:", e);
    try {
      const { logSystemError } = await import("@/lib/system-error-log");
      await logSystemError({
        source: "email.welcome.log",
        message: `WelcomeEmailLog write failed for ${args.email}`,
        detail: e instanceof Error ? e.message : String(e),
        meta: { email: args.email, success: args.success, source: args.source },
      });
    } catch {
      /* ignore */
    }
  }
}

export type WelcomeEmailLogRow = {
  id: string;
  email: string;
  userId: string | null;
  success: boolean;
  error: string | null;
  source: string;
  createdAt: string;
};

export async function listRecentWelcomeEmailLogs(limit = 50): Promise<WelcomeEmailLogRow[]> {
  try {
    const rows = await (
      prisma as unknown as {
        welcomeEmailLog: {
          findMany: (a: unknown) => Promise<Array<Record<string, unknown>>>;
        };
      }
    ).welcomeEmailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: String(r.id),
      email: String(r.email ?? ""),
      userId: r.userId != null ? String(r.userId) : null,
      success: !!r.success,
      error: r.error != null ? String(r.error) : null,
      source: String(r.source ?? "register"),
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ""),
    }));
  } catch (e) {
    console.warn("listRecentWelcomeEmailLogs:", e);
    return [];
  }
}

async function sendWithRetry(to: string, subject: string, html: string, attempts = 3) {
  let last: { ok: true } | { ok: false; error: string } = { ok: false, error: "not attempted" };
  for (let i = 0; i < attempts; i++) {
    last = await sendEmailDetailed(to, subject, html);
    if (last.ok) return last;
    if (!isTransientSendError(last.error) || i === attempts - 1) return last;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return last;
}

/** Fire-and-forget safe; never throws to callers. Retries transient Resend/network failures. */
export async function sendWelcomeEmailToUser(
  email: string | null | undefined,
  opts?: { userId?: string | null; source?: WelcomeEmailSource }
): Promise<void> {
  const to = (email ?? "").trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;

  const source = opts?.source ?? "register";
  const userId = opts?.userId ?? null;

  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.WELCOME_AUTO_EMAIL);
  if (!enabled) {
    await logWelcome({
      email: to,
      userId,
      success: false,
      error: "welcome_auto_email flag OFF",
      source,
    });
    return;
  }

  try {
    const html = buildAnnouncementEmailHtml({
      body: WELCOME_EMAIL.body,
      template: "welcome",
      format: "rich",
      ctaLabel: "Open Start here",
      ctaUrl: START_HERE_URL,
    });
    const result = await sendWithRetry(to, WELCOME_EMAIL.subject, html, 3);
    if (result.ok) {
      await logWelcome({ email: to, userId, success: true, source });
    } else {
      console.warn("Welcome email failed:", to, result.error);
      await logWelcome({ email: to, userId, success: false, error: result.error, source });
      try {
        const { logSystemError } = await import("@/lib/system-error-log");
        await logSystemError({
          source: "email.welcome",
          message: `Welcome email failed for ${to}`,
          detail: result.error,
          meta: { email: to, userId, source },
        });
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    console.error("sendWelcomeEmailToUser:", e);
    const message = e instanceof Error ? e.message : "send failed";
    await logWelcome({
      email: to,
      userId,
      success: false,
      error: message,
      source,
    });
    try {
      const { logSystemException } = await import("@/lib/system-error-log");
      await logSystemException("email.welcome", e, { email: to, userId, source });
    } catch {
      /* ignore */
    }
  }
}
