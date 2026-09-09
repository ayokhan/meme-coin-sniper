/**
 * VIP Strategy Session promo — admin end date + session list price drive banner / email / subscribe copy.
 * Flag: vip_strategy_session_promo. End date (America/New_York calendar day) still gates when flag is ON.
 */
import { prisma } from "@/lib/db";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import type { SiteAnnouncementBannerConfig } from "@/lib/site-announcement-banner";
import { setSiteAnnouncementBanner, getSiteAnnouncementBannerForPublic } from "@/lib/site-announcement-banner";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
export const VIP_STRATEGY_SESSION_SUBSCRIBE_URL = `${APP_ORIGIN}/subscribe`;
export const VIP_STRATEGY_SESSION_PROMO_CONFIG_ID = "default";
export const DEFAULT_VIP_STRATEGY_SESSION_ENDS_ON = "2026-12-31";
export const DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD = 150;

export const VIP_STRATEGY_SESSION_PROMO_RULES = {
  sessionLengthMins: 30,
  bookWithinDays: 7,
  refundWithinDaysAfterSession: 3,
} as const;

type ConfigRow = {
  endsOnDate: string;
  sessionListPriceUsd?: number | null;
  updatedAt: Date;
};

type PrismaPromo = typeof prisma & {
  vipStrategySessionPromoConfig?: {
    findUnique: (args: { where: { id: string } }) => Promise<ConfigRow | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; endsOnDate: string; sessionListPriceUsd: number };
      update: { endsOnDate?: string; sessionListPriceUsd?: number };
    }) => Promise<ConfigRow>;
  };
};

function configDb() {
  return (prisma as PrismaPromo).vipStrategySessionPromoConfig ?? null;
}

/** YYYY-MM-DD validation. */
export function normalizeEndsOnDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

export function normalizeSessionListPriceUsd(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n < 1 || n > 10000) return null;
  return Math.round(n);
}

/** Today in America/New_York as YYYY-MM-DD. */
export function formatNyCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Display label e.g. "Dec 31, 2026". */
export function formatPromoEndsLabel(endsOnDate: string): string {
  const [y, m, d] = endsOnDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(utc);
}

/** Short label for titles — "Dec 31" same year as now (NY), else "Dec 31, 2027". */
export function formatPromoEndsShort(endsOnDate: string, now = new Date()): string {
  const [y, m, d] = endsOnDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  const nowYear = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric" }).format(now)
  );
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  };
  if (y !== nowYear) opts.year = "numeric";
  return new Intl.DateTimeFormat("en-US", opts).format(utc);
}

export type VipStrategySessionPromoConfigAdmin = {
  endsOnDate: string;
  endsLabel: string;
  endsShort: string;
  sessionListPriceUsd: number;
  updatedAt: string | null;
};

export type VipStrategySessionPromoCopy = ReturnType<typeof buildVipStrategySessionPromoCopy>;

export async function getVipStrategySessionPromoConfig(): Promise<VipStrategySessionPromoConfigAdmin> {
  const db = configDb();
  let endsOnDate = DEFAULT_VIP_STRATEGY_SESSION_ENDS_ON;
  let sessionListPriceUsd = DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD;
  let updatedAt: string | null = null;
  if (db) {
    try {
      const row = await db.findUnique({ where: { id: VIP_STRATEGY_SESSION_PROMO_CONFIG_ID } });
      if (row?.endsOnDate && normalizeEndsOnDate(row.endsOnDate)) {
        endsOnDate = row.endsOnDate;
        updatedAt = row.updatedAt?.toISOString?.() ?? null;
      }
      const price = normalizeSessionListPriceUsd(row?.sessionListPriceUsd);
      if (price != null) sessionListPriceUsd = price;
    } catch {
      /* table/column may not exist yet */
    }
  }
  return {
    endsOnDate,
    endsLabel: formatPromoEndsLabel(endsOnDate),
    endsShort: formatPromoEndsShort(endsOnDate),
    sessionListPriceUsd,
    updatedAt,
  };
}

export async function setVipStrategySessionPromoConfig(patch: {
  endsOnDate?: string;
  sessionListPriceUsd?: number | string;
}): Promise<VipStrategySessionPromoConfigAdmin> {
  const current = await getVipStrategySessionPromoConfig();
  const endsOnDate =
    patch.endsOnDate != null ? normalizeEndsOnDate(patch.endsOnDate) : current.endsOnDate;
  if (!endsOnDate) throw new Error("Invalid date. Use YYYY-MM-DD.");
  const sessionListPriceUsd =
    patch.sessionListPriceUsd != null
      ? normalizeSessionListPriceUsd(patch.sessionListPriceUsd)
      : current.sessionListPriceUsd;
  if (sessionListPriceUsd == null) throw new Error("Invalid session list price.");

  const db = configDb();
  if (!db) throw new Error("Promo config storage unavailable. Run migrations.");
  await db.upsert({
    where: { id: VIP_STRATEGY_SESSION_PROMO_CONFIG_ID },
    create: {
      id: VIP_STRATEGY_SESSION_PROMO_CONFIG_ID,
      endsOnDate,
      sessionListPriceUsd,
    },
    update: { endsOnDate, sessionListPriceUsd },
  });
  return getVipStrategySessionPromoConfig();
}

/** @deprecated prefer setVipStrategySessionPromoConfig */
export async function setVipStrategySessionPromoEndsOnDate(
  raw: string
): Promise<VipStrategySessionPromoConfigAdmin> {
  return setVipStrategySessionPromoConfig({ endsOnDate: raw });
}

export function buildVipStrategySessionPromoCopy(
  endsOnDate: string,
  sessionListPriceUsd = DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD
) {
  const endsShort = formatPromoEndsShort(endsOnDate);
  const endsLabel = formatPromoEndsLabel(endsOnDate);
  const { sessionLengthMins, bookWithinDays, refundWithinDaysAfterSession } = VIP_STRATEGY_SESSION_PROMO_RULES;
  const price = normalizeSessionListPriceUsd(sessionListPriceUsd) ?? DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD;
  return {
    title: `VIP promo through ${endsShort}: $${price} strategy session free`,
    shortBlurb: `Subscribe to VIP and get a ${sessionLengthMins}-minute strategy session with a NovaStaris coach — $${price} value, included free. Book within ${bookWithinDays} days of subscription. After your session, if you’re not satisfied you can cancel VIP within ${refundWithinDaysAfterSession} days for a 100% refund of the subscription fee.`,
    valueBreakdownLines: [
      `${sessionLengthMins}-min strategy session with a NovaStaris coach: $${price} value`,
      "Included free with new VIP during this promo",
      `You save $${price}`,
    ],
    postcardLine: `Includes $${price} strategy session free with VIP`,
    sessionLengthMins,
    bookWithinDays,
    refundWithinDaysAfterSession,
    sessionListPriceUsd: price,
    endsOnDate,
    endsLabel,
    endsShort,
  };
}

export function buildVipStrategySessionBanner(
  endsOnDate: string,
  sessionListPriceUsd = DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD
): SiteAnnouncementBannerConfig {
  const copy = buildVipStrategySessionPromoCopy(endsOnDate, sessionListPriceUsd);
  return {
    enabled: true,
    title: copy.title,
    body: [
      `New VIP includes a ${copy.sessionLengthMins}-minute strategy session with a NovaStaris coach — normally $${copy.sessionListPriceUsd}, free with this promo.`,
      "",
      "Value included",
      `• Strategy session (${copy.sessionLengthMins} min): $${copy.sessionListPriceUsd}`,
      "• With VIP this promo: $0",
      `• You save: $${copy.sessionListPriceUsd}`,
      "",
      `Book within ${copy.bookWithinDays} days of subscription.`,
      `After the session, cancel within ${copy.refundWithinDaysAfterSession} days for a 100% refund of your VIP fee if you’re not satisfied.`,
      "",
      "Full details are in our Payment Terms.",
    ].join("\n"),
    ctaLabel: "See VIP plans",
    ctaHref: "/subscribe",
    showPartnerLogos: false,
    partnerBrand: "blofin",
  };
}

/** Sync default for scripts. */
export const VIP_STRATEGY_SESSION_BANNER = buildVipStrategySessionBanner(
  DEFAULT_VIP_STRATEGY_SESSION_ENDS_ON,
  DEFAULT_VIP_STRATEGY_SESSION_LIST_PRICE_USD
);

export function isVipStrategySessionPromoInDateWindow(endsOnDate: string, now = new Date()): boolean {
  return formatNyCalendarDate(now) <= endsOnDate;
}

export async function isVipStrategySessionPromoActive(now = new Date()): Promise<boolean> {
  const { endsOnDate } = await getVipStrategySessionPromoConfig();
  if (!isVipStrategySessionPromoInDateWindow(endsOnDate, now)) return false;
  return getFeatureFlag(FEATURE_FLAG_KEYS.VIP_STRATEGY_SESSION_PROMO);
}

export async function vipStrategySessionPromoPublicPayload(active: boolean) {
  const cfg = await getVipStrategySessionPromoConfig();
  const copy = buildVipStrategySessionPromoCopy(cfg.endsOnDate, cfg.sessionListPriceUsd);
  return {
    active,
    endsAt: `${cfg.endsOnDate}T23:59:59.999-05:00`,
    endsOnDate: cfg.endsOnDate,
    endsLabel: cfg.endsLabel,
    endsShort: cfg.endsShort,
    sessionListPriceUsd: copy.sessionListPriceUsd,
    title: copy.title,
    shortBlurb: copy.shortBlurb,
    valueBreakdownLines: copy.valueBreakdownLines,
    postcardLine: copy.postcardLine,
    sessionLengthMins: copy.sessionLengthMins,
    bookWithinDays: copy.bookWithinDays,
    refundWithinDaysAfterSession: copy.refundWithinDaysAfterSession,
    subscribeUrl: VIP_STRATEGY_SESSION_SUBSCRIBE_URL,
  };
}

function looksLikeStrategySessionBanner(title: string, body: string, ctaHref: string): boolean {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  return (
    ctaHref.trim() === "/subscribe" &&
    (t.includes("strategy session") || b.includes("strategy session")) &&
    (t.includes("vip promo") || b.includes("strategy session") || b.includes("you save"))
  );
}

/** If the live site announcement is this promo, rewrite title/body for the new config. */
export async function refreshLiveStrategySessionBannerIfPublished(
  endsOnDate: string,
  sessionListPriceUsd?: number
): Promise<boolean> {
  try {
    const current = await getSiteAnnouncementBannerForPublic();
    if (!looksLikeStrategySessionBanner(current.title, current.body, current.ctaHref)) {
      return false;
    }
    const price =
      sessionListPriceUsd ??
      (await getVipStrategySessionPromoConfig()).sessionListPriceUsd;
    const next = buildVipStrategySessionBanner(endsOnDate, price);
    await setSiteAnnouncementBanner({
      ...next,
      enabled: current.enabled,
    });
    return true;
  } catch {
    return false;
  }
}
