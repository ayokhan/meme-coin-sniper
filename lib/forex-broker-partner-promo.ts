import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { SiteAnnouncementBannerConfig } from "@/lib/site-announcement-banner";
import type { ForexBrokerId } from "@/lib/forex-broker-user-config";

export const FOREX_BROKER_PARTNER_IDS: ForexBrokerId[] = ["vantage", "tiomarkets"];

export type ForexBrokerPartnerPromoConfig = {
  enabled: boolean;
  registerUrl: string;
  headline: string;
  bodyText: string;
  promoLabel: string;
  ctaLabel: string;
  showLogosInBanner: boolean;
  includeLogosInEmail: boolean;
  includeLogosInBroadcast: boolean;
};

export type ForexBrokerPartnerPromoAdmin = ForexBrokerPartnerPromoConfig & {
  broker: ForexBrokerId;
  active: boolean;
  usesDefault: boolean;
  updatedAt: string | null;
  registerClickCount: number;
};

const BROKER_LABEL: Record<ForexBrokerId, string> = {
  vantage: "Vantage Markets",
  tiomarkets: "TIOmarkets",
};

/** Placeholder affiliate URLs — edit in Admin → Banners → Forex Broker Partners before enabling. */
export const DEFAULT_FOREX_BROKER_PARTNER_PROMO: Record<ForexBrokerId, ForexBrokerPartnerPromoConfig> = {
  vantage: {
    enabled: false,
    registerUrl: "",
    headline: "Trade Forex & CFDs on Vantage Markets with NovaStaris",
    bodyText:
      "Register with Vantage Markets through NovaStaris and connect your MT4/MT5 account to run Nova Forex Bot and Nova Forex Scalper on your own trades.",
    promoLabel: "NovaStaris partner offer",
    ctaLabel: "Register on Vantage Markets",
    showLogosInBanner: true,
    includeLogosInEmail: true,
    includeLogosInBroadcast: true,
  },
  tiomarkets: {
    enabled: false,
    registerUrl: "",
    headline: "Trade Forex & CFDs on TIOmarkets with NovaStaris",
    bodyText:
      "Register with TIOmarkets through NovaStaris and connect your MT4/MT5 account to run Nova Forex Bot and Nova Forex Scalper on your own trades.",
    promoLabel: "NovaStaris partner offer",
    ctaLabel: "Register on TIOmarkets",
    showLogosInBanner: true,
    includeLogosInEmail: true,
    includeLogosInBroadcast: true,
  },
};

/** Site announcement presets for forex broker partnership launches (Admin → Banners). Fill in registerUrl before enabling. */
export const FOREX_BROKER_LAUNCH_BANNER: Record<ForexBrokerId, SiteAnnouncementBannerConfig> = {
  vantage: {
    enabled: true,
    title: "NovaStaris × Vantage Markets — forex trading is here",
    body: "Register on Vantage Markets through NovaStaris and connect your MT4/MT5 account to trade with Nova Forex Bot and Nova Forex Scalper.",
    ctaLabel: "Open Nova Forex",
    ctaHref: "/?tab=nova-forex",
    showPartnerLogos: true,
    partnerBrand: "vantage",
  },
  tiomarkets: {
    enabled: true,
    title: "NovaStaris × TIOmarkets — forex trading is here",
    body: "Register on TIOmarkets through NovaStaris and connect your MT4/MT5 account to trade with Nova Forex Bot and Nova Forex Scalper.",
    ctaLabel: "Open Nova Forex",
    ctaHref: "/?tab=nova-forex",
    showPartnerLogos: true,
    partnerBrand: "tiomarkets",
  },
};

/** Suggested customer email copy per broker (Admin → Banners → Email). Fill in the referral link before sending. */
export const FOREX_PARTNERSHIP_EMAIL: Record<ForexBrokerId, { subject: string; body: string }> = {
  vantage: {
    subject: "NovaStaris × Vantage Markets — trade forex with your MT4/MT5 account",
    body: `Hi there,

We partnered with Vantage Markets so NovaStaris members can trade forex, metals, and indices — and connect MT4/MT5 directly to our Nova Forex Bot and Nova Forex Scalper.

Register through our partner link, then link your MT4/MT5 login in NovaStaris to start trading with AI on your account.

Your referral link: [add Vantage affiliate link]

How to get started:
1. Sign in to NovaStaris → open Nova Forex.
2. Tap "Register on Vantage" in the partnership banner—or use the link above.
3. After your Vantage account is ready, connect your MT4/MT5 login in NovaStaris and start trading.

Questions? Reply to this email or use Need Help in the app.

— The NovaStaris team
https://novastaris.ai`,
  },
  tiomarkets: {
    subject: "NovaStaris × TIOmarkets — trade forex with your MT4/MT5 account",
    body: `Hi there,

We partnered with TIOmarkets so NovaStaris members can trade forex, metals, and indices — and connect MT4/MT5 directly to our Nova Forex Bot and Nova Forex Scalper.

Register through our partner link, then link your MT4/MT5 login in NovaStaris to start trading with AI on your account.

Your referral link: [add TIOmarkets affiliate link]

How to get started:
1. Sign in to NovaStaris → open Nova Forex.
2. Tap "Register on TIOmarkets" in the partnership banner—or use the link above.
3. After your TIOmarkets account is ready, connect your MT4/MT5 login in NovaStaris and start trading.

Questions? Reply to this email or use Need Help in the app.

— The NovaStaris team
https://novastaris.ai`,
  },
};

/** ForexBrokerPartnerPromo.id IS the broker id ("vantage" | "tiomarkets") — same pattern as BlofinPartnerPromo.id = "default". */
type Row = ForexBrokerPartnerPromoConfig & { id?: string; updatedAt?: Date };

type PromoDb = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: { id: string } & ForexBrokerPartnerPromoConfig;
    update: ForexBrokerPartnerPromoConfig;
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

type ClickDb = {
  count: (args?: { where?: { broker?: string } }) => Promise<number>;
  create: (args: { data: { broker: string; userId?: string | null; guestHash?: string | null } }) => Promise<unknown>;
  findMany: (args: {
    where?: { broker?: string };
    take?: number;
    orderBy?: { clickedAt: "desc" };
    include?: { user: { select: { email: true; name: true } } };
  }) => Promise<
    {
      id: string;
      broker: string;
      userId: string | null;
      guestHash: string | null;
      clickedAt: Date;
      user?: { email: string | null; name: string | null } | null;
    }[]
  >;
};

function promoDb(): PromoDb | null {
  return (prisma as unknown as { forexBrokerPartnerPromo?: PromoDb }).forexBrokerPartnerPromo ?? null;
}

function clickDb(): ClickDb | null {
  return (prisma as unknown as { forexBrokerPartnerLinkClick?: ClickDb }).forexBrokerPartnerLinkClick ?? null;
}

function normalize(broker: ForexBrokerId, row: Partial<Row>): ForexBrokerPartnerPromoConfig {
  const d = DEFAULT_FOREX_BROKER_PARTNER_PROMO[broker];
  return {
    enabled: row.enabled ?? d.enabled,
    registerUrl: (row.registerUrl ?? d.registerUrl).trim(),
    headline: (row.headline ?? d.headline).trim() || d.headline,
    bodyText: (row.bodyText ?? d.bodyText).trim() || d.bodyText,
    promoLabel: (row.promoLabel ?? d.promoLabel).trim() || d.promoLabel,
    ctaLabel: (row.ctaLabel ?? d.ctaLabel).trim() || d.ctaLabel,
    showLogosInBanner: row.showLogosInBanner ?? d.showLogosInBanner,
    includeLogosInEmail: row.includeLogosInEmail ?? d.includeLogosInEmail,
    includeLogosInBroadcast: row.includeLogosInBroadcast ?? d.includeLogosInBroadcast,
  };
}

function isActive(config: ForexBrokerPartnerPromoConfig): boolean {
  return config.enabled && !!config.registerUrl;
}

async function clickCount(broker: ForexBrokerId): Promise<number> {
  const db = clickDb();
  if (!db) return 0;
  try {
    return await db.count({ where: { broker } });
  } catch {
    return 0;
  }
}

function rowToAdmin(
  broker: ForexBrokerId,
  row: Row,
  usesDefault: boolean,
  count: number
): ForexBrokerPartnerPromoAdmin {
  const config = normalize(broker, row);
  return {
    ...config,
    broker,
    active: isActive(config),
    usesDefault,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    registerClickCount: count,
  };
}

export async function getForexBrokerPartnerPromoForPublic(
  broker: ForexBrokerId
): Promise<ForexBrokerPartnerPromoAdmin> {
  const db = promoDb();
  const count = await clickCount(broker);
  const fallback = normalize(broker, DEFAULT_FOREX_BROKER_PARTNER_PROMO[broker]);
  if (!db) return { ...fallback, broker, active: false, usesDefault: true, updatedAt: null, registerClickCount: count };
  const row = await db.findUnique({ where: { id: broker } });
  if (!row) {
    return { ...fallback, broker, active: false, usesDefault: true, updatedAt: null, registerClickCount: count };
  }
  return rowToAdmin(broker, row, false, count);
}

export async function getForexBrokerPartnerPromoForAdmin(
  broker: ForexBrokerId
): Promise<ForexBrokerPartnerPromoAdmin> {
  return getForexBrokerPartnerPromoForPublic(broker);
}

export async function getAllForexBrokerPartnerPromosForAdmin(): Promise<ForexBrokerPartnerPromoAdmin[]> {
  return Promise.all(FOREX_BROKER_PARTNER_IDS.map((broker) => getForexBrokerPartnerPromoForAdmin(broker)));
}

export async function setForexBrokerPartnerPromo(
  broker: ForexBrokerId,
  patch: Partial<ForexBrokerPartnerPromoConfig>
): Promise<ForexBrokerPartnerPromoAdmin> {
  const db = promoDb();
  if (!db) throw new Error("Forex broker partner promo storage unavailable.");
  const current = await getForexBrokerPartnerPromoForAdmin(broker);
  const next = normalize(broker, {
    enabled: patch.enabled ?? current.enabled,
    registerUrl: patch.registerUrl ?? current.registerUrl,
    headline: patch.headline ?? current.headline,
    bodyText: patch.bodyText ?? current.bodyText,
    promoLabel: patch.promoLabel ?? current.promoLabel,
    ctaLabel: patch.ctaLabel ?? current.ctaLabel,
    showLogosInBanner: patch.showLogosInBanner ?? current.showLogosInBanner,
    includeLogosInEmail: patch.includeLogosInEmail ?? current.includeLogosInEmail,
    includeLogosInBroadcast: patch.includeLogosInBroadcast ?? current.includeLogosInBroadcast,
  });
  await db.upsert({
    where: { id: broker },
    create: { id: broker, ...next },
    update: next,
  });
  return getForexBrokerPartnerPromoForAdmin(broker);
}

export async function resetForexBrokerPartnerPromoToDefault(
  broker: ForexBrokerId
): Promise<ForexBrokerPartnerPromoAdmin> {
  const db = promoDb();
  if (!db) throw new Error("Forex broker partner promo storage unavailable.");
  try {
    await db.delete({ where: { id: broker } });
  } catch {
    /* ignore */
  }
  return getForexBrokerPartnerPromoForAdmin(broker);
}

export function forexBrokerPartnerRegisterPath(broker: ForexBrokerId): string {
  return `/api/forex-broker-partner/register?broker=${broker}`;
}

export function forexBrokerLabel(broker: ForexBrokerId): string {
  return BROKER_LABEL[broker] ?? broker;
}

export function guestHashFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function recordForexBrokerPartnerLinkClick(input: {
  broker: ForexBrokerId;
  userId?: string | null;
  guestHash?: string | null;
}): Promise<void> {
  const db = clickDb();
  if (!db) return;
  try {
    await db.create({
      data: {
        broker: input.broker,
        userId: input.userId ?? null,
        guestHash: input.guestHash ?? null,
      },
    });
  } catch (e) {
    console.error("recordForexBrokerPartnerLinkClick:", e);
  }
}

export type ForexBrokerPartnerLinkClickRow = {
  id: string;
  broker: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  guestHash: string | null;
  clickedAt: string;
};

export async function listForexBrokerPartnerLinkClicks(
  broker?: ForexBrokerId,
  limit = 100
): Promise<ForexBrokerPartnerLinkClickRow[]> {
  const db = clickDb();
  if (!db) return [];
  const rows = await db.findMany({
    where: broker ? { broker } : undefined,
    take: limit,
    orderBy: { clickedAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    broker: r.broker,
    userId: r.userId,
    userEmail: r.user?.email ?? null,
    userName: r.user?.name ?? null,
    guestHash: r.guestHash,
    clickedAt: r.clickedAt.toISOString(),
  }));
}
