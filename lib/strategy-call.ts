/**
 * NovaStaris Discovery call — booking URL (Calendly) + email copy.
 *
 * Flow: NovaStaris page/email explains the call → user clicks → Calendly
 * (external) for picking a time. NovaStaris does not host the calendar.
 *
 * Internal IDs still use “strategyCall*” for DB/API stability; customer-facing
 * name is Discovery call.
 */

import { prisma } from "@/lib/db";

export const STRATEGY_CALL_CONFIG_ID = "default";

/** Default Calendly event — NovaStaris 30‑min product discovery. */
export const DEFAULT_STRATEGY_CALL_BOOKING_URL =
  "https://calendly.com/novastaris-ai/30min";

export const STRATEGY_CALL_PAGE_PATH = "/discovery-call";
export const STRATEGY_CALL_PAGE_URL = "https://novastaris.ai/discovery-call";

export type StrategyCallConfigAdmin = {
  enabled: boolean;
  bookingUrl: string;
  showNavButton: boolean;
  showOncePopup: boolean;
  updatedAt: string | null;
};

/** Public shape for dashboard (nav + one-time popup). */
export type StrategyCallPublicConfig = {
  enabled: boolean;
  bookingUrl: string;
  showNavButton: boolean;
  showOncePopup: boolean;
};

const DEFAULT: StrategyCallConfigAdmin = {
  enabled: true,
  bookingUrl: DEFAULT_STRATEGY_CALL_BOOKING_URL,
  showNavButton: true,
  showOncePopup: true,
  updatedAt: null,
};

type Row = {
  enabled: boolean;
  bookingUrl: string;
  showNavButton?: boolean;
  showOncePopup?: boolean;
  updatedAt?: Date;
};

type Db = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: {
      id: string;
      enabled: boolean;
      bookingUrl: string;
      showNavButton: boolean;
      showOncePopup: boolean;
    };
    update: {
      enabled: boolean;
      bookingUrl: string;
      showNavButton: boolean;
      showOncePopup: boolean;
    };
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

function fromRow(row: Row | null): StrategyCallConfigAdmin {
  if (!row) return { ...DEFAULT };
  return {
    enabled: row.enabled !== false,
    bookingUrl: (row.bookingUrl ?? "").trim() || DEFAULT_STRATEGY_CALL_BOOKING_URL,
    showNavButton: row.showNavButton !== false,
    showOncePopup: row.showOncePopup !== false,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
  };
}

export async function getStrategyCallConfig(): Promise<StrategyCallConfigAdmin> {
  const db = store();
  if (!db) return { ...DEFAULT };
  try {
    const row = await db.findUnique({ where: { id: STRATEGY_CALL_CONFIG_ID } });
    return fromRow(row);
  } catch {
    return { ...DEFAULT };
  }
}

export async function setStrategyCallConfig(patch: {
  enabled?: boolean;
  bookingUrl?: string;
  showNavButton?: boolean;
  showOncePopup?: boolean;
}): Promise<StrategyCallConfigAdmin> {
  const db = store();
  if (!db) throw new Error("Discovery call config storage unavailable.");
  const current = await getStrategyCallConfig();
  const next = {
    enabled: patch.enabled ?? current.enabled,
    bookingUrl:
      patch.bookingUrl !== undefined
        ? normalizeUrl(patch.bookingUrl) || DEFAULT_STRATEGY_CALL_BOOKING_URL
        : current.bookingUrl,
    showNavButton: patch.showNavButton ?? current.showNavButton,
    showOncePopup: patch.showOncePopup ?? current.showOncePopup,
  };
  await db.upsert({
    where: { id: STRATEGY_CALL_CONFIG_ID },
    create: { id: STRATEGY_CALL_CONFIG_ID, ...next },
    update: next,
  });
  return getStrategyCallConfig();
}

export function toStrategyCallPublic(cfg: StrategyCallConfigAdmin): StrategyCallPublicConfig {
  return {
    enabled: cfg.enabled,
    bookingUrl: cfg.bookingUrl || DEFAULT_STRATEGY_CALL_BOOKING_URL,
    showNavButton: cfg.enabled && cfg.showNavButton,
    showOncePopup: cfg.enabled && cfg.showOncePopup,
  };
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
    subject: "Book a NovaStaris Discovery call",
    body: `Hi there,

Book a Discovery call for a guided introduction to NovaStaris.

In about 30 minutes, we’ll review the desks relevant to how you trade (meme, futures, forex, wallets, Polymarket, or bots), clarify which tabs to use first, and help you leave with one clear next step.

This call is complimentary.

Book a time:
${calendly}

Or review details first:
${STRATEGY_CALL_PAGE_URL}

Already scheduled? Use the same calendar link to reschedule or cancel.

Prefer to explore on your own? Start here anytime:
https://novastaris.ai/start-here

Need help? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
https://novastaris.ai`,
    ctaLabel: "Book a Discovery call",
    ctaUrl: calendly,
  };
}
