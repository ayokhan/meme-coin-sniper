/**
 * Free NovaStaris strategy call — booking URL (Calendly) + email copy.
 *
 * Flow: NovaStaris page/email explains the call → user clicks → Calendly
 * (external) for picking a time. NovaStaris does not host the calendar.
 */

import { prisma } from "@/lib/db";

export const STRATEGY_CALL_CONFIG_ID = "default";

/** Default Calendly event — NovaStaris 30‑min feature walkthrough. */
export const DEFAULT_STRATEGY_CALL_BOOKING_URL =
  "https://calendly.com/novastaris-ai/30min";

export const STRATEGY_CALL_PAGE_PATH = "/strategy-call";
export const STRATEGY_CALL_PAGE_URL = "https://novastaris.ai/strategy-call";

export type StrategyCallConfigAdmin = {
  enabled: boolean;
  bookingUrl: string;
  updatedAt: string | null;
};

const DEFAULT: StrategyCallConfigAdmin = {
  enabled: true,
  bookingUrl: DEFAULT_STRATEGY_CALL_BOOKING_URL,
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
    const bookingUrl = (row.bookingUrl ?? "").trim() || DEFAULT_STRATEGY_CALL_BOOKING_URL;
    return {
      enabled: row.enabled !== false,
      bookingUrl,
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
    bookingUrl:
      patch.bookingUrl !== undefined
        ? normalizeUrl(patch.bookingUrl) || DEFAULT_STRATEGY_CALL_BOOKING_URL
        : current.bookingUrl,
  };
  await db.upsert({
    where: { id: STRATEGY_CALL_CONFIG_ID },
    create: { id: STRATEGY_CALL_CONFIG_ID, ...next },
    update: next,
  });
  return getStrategyCallConfig();
}

/**
 * Calendly (or override) URL for the Book CTA.
 * Always returns a usable link — falls back to the default Calendly event.
 */
export async function getStrategyCallBookingUrl(): Promise<string> {
  const cfg = await getStrategyCallConfig();
  return cfg.bookingUrl || DEFAULT_STRATEGY_CALL_BOOKING_URL;
}

/** Whether to promote the call on Start here / public surfaces. */
export async function isStrategyCallPromoted(): Promise<boolean> {
  const cfg = await getStrategyCallConfig();
  return cfg.enabled !== false;
}

export function buildStrategyCallEmail(bookingUrl: string): {
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
} {
  const calendly = bookingUrl.trim() || DEFAULT_STRATEGY_CALL_BOOKING_URL;
  return {
    subject: "Free NovaStaris strategy call — walk through the features",
    body: `Hi there,

Want a free strategy call to go over NovaStaris features?

On a short call we’ll walk through the desks that matter for you (meme, futures, forex, wallets, Polymarket, bots), show how the tabs fit together, and help you take one clear next step — so you’re not stuck staring at the dashboard.

This call is free. No payment required.

Book a time (opens Calendly):
${calendly}

Or open the NovaStaris page first:
${STRATEGY_CALL_PAGE_URL}

Already booked? Use the same Calendly link to reschedule or cancel.

Prefer self-serve? Open Start here anytime:
https://novastaris.ai/start-here

Need help? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
https://novastaris.ai`,
    ctaLabel: "Book free strategy call",
    ctaUrl: calendly,
  };
}
