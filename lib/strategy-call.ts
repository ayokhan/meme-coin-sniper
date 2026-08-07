/**
 * Free NovaStaris strategy call — booking URL (Calendly etc.) + email copy.
 */

import { prisma } from "@/lib/db";

export const STRATEGY_CALL_CONFIG_ID = "default";

export type StrategyCallConfigAdmin = {
  enabled: boolean;
  bookingUrl: string;
  updatedAt: string | null;
};

const DEFAULT: StrategyCallConfigAdmin = {
  enabled: false,
  bookingUrl: "",
  updatedAt: null,
};

type Row = {
  enabled: boolean;
  bookingUrl: string;
  updatedAt?: Date;
};

type Db = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: { id: string; enabled: boolean; bookingUrl: string };
    update: { enabled: boolean; bookingUrl: string };
  }) => Promise<unknown>;
};

function store(): Db | null {
  return (prisma as unknown as { strategyCallConfig?: Db }).strategyCallConfig ?? null;
}

function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

export async function getStrategyCallConfig(): Promise<StrategyCallConfigAdmin> {
  const db = store();
  if (!db) return { ...DEFAULT };
  try {
    const row = await db.findUnique({ where: { id: STRATEGY_CALL_CONFIG_ID } });
    if (!row) return { ...DEFAULT };
    return {
      enabled: !!row.enabled,
      bookingUrl: (row.bookingUrl ?? "").trim(),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function setStrategyCallConfig(patch: {
  enabled?: boolean;
  bookingUrl?: string;
}): Promise<StrategyCallConfigAdmin> {
  const db = store();
  if (!db) throw new Error("Strategy call config storage unavailable.");
  const current = await getStrategyCallConfig();
  const next = {
    enabled: patch.enabled ?? current.enabled,
    bookingUrl: patch.bookingUrl !== undefined ? normalizeUrl(patch.bookingUrl) : current.bookingUrl,
  };
  await db.upsert({
    where: { id: STRATEGY_CALL_CONFIG_ID },
    create: { id: STRATEGY_CALL_CONFIG_ID, ...next },
    update: next,
  });
  return getStrategyCallConfig();
}

/** Public booking URL when enabled; otherwise empty. */
export async function getStrategyCallBookingUrl(): Promise<string> {
  const cfg = await getStrategyCallConfig();
  if (!cfg.enabled || !cfg.bookingUrl) return "";
  return cfg.bookingUrl;
}

export function buildStrategyCallEmail(bookingUrl: string): {
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
} {
  const url =
    bookingUrl.trim() ||
    "https://calendly.com/YOUR-USERNAME/novastaris-strategy-call";
  return {
    subject: "Free NovaStaris strategy call — book a time",
    body: `Hi there,

Want a free walkthrough of NovaStaris?

Book a short strategy call and we’ll help you pick a path (meme, futures, forex, wallets, or Polymarket), open the right tabs, and take one real action — so you’re not stuck staring at the dashboard.

This call is free. No payment required.

Book here:
${url}

Already booked? Use the same link to reschedule or cancel.

Prefer self-serve? Open Start here anytime:
https://novastaris.ai/start-here

Need help? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
https://novastaris.ai`,
    ctaLabel: "Book free strategy call",
    ctaUrl: url,
  };
}
