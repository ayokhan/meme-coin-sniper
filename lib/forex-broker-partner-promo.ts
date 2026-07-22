import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { SiteAnnouncementBannerConfig } from "@/lib/site-announcement-banner";
import type { ForexPartnerBrokerId } from "@/lib/forex-broker-user-config";
import { FOREX_PARTNER_BROKER_IDS, FOREX_BROKER_LABELS } from "@/lib/forex-broker-user-config";

export const FOREX_BROKER_PARTNER_IDS = FOREX_PARTNER_BROKER_IDS;

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
  broker: ForexPartnerBrokerId;
  active: boolean;
  usesDefault: boolean;
  updatedAt: string | null;
  registerClickCount: number;
};

const BROKER_LABEL: Record<ForexPartnerBrokerId, string> = {
  vantage: FOREX_BROKER_LABELS.vantage,
  tiomarkets: FOREX_BROKER_LABELS.tiomarkets,
  assexmarkets: FOREX_BROKER_LABELS.assexmarkets,
};

/** Placeholder affiliate URLs — edit in Admin → Banners → Forex Broker Partners before enabling. */
export const DEFAULT_FOREX_BROKER_PARTNER_PROMO: Record<ForexPartnerBrokerId, ForexBrokerPartnerPromoConfig> = {
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
  assexmarkets: {
    enabled: false,
    registerUrl: "https://www.assexmarkets.com/",
    headline: "Trade Forex & CFDs on Assexmarkets with NovaStaris",
    bodyText:
      "Register with Assexmarkets through NovaStaris and connect your MT4/MT5 account to run Nova Forex Bot and Nova Forex Scalper on your own trades.",
    promoLabel: "NovaStaris partner offer",
    ctaLabel: "Register on Assexmarkets",
    showLogosInBanner: true,
    includeLogosInEmail: true,
    includeLogosInBroadcast: true,
  },
};

/** Site announcement presets for forex broker partnership launches (Admin → Banners). */
export const FOREX_BROKER_LAUNCH_BANNER: Record<ForexPartnerBrokerId, SiteAnnouncementBannerConfig> = {
  vantage: {
    enabled: true,
    title: "NovaStaris × Vantage Markets — forex trading is here",
    body: "Register on Vantage Markets through NovaStaris and connect your MT4/MT5 account to trade with Nova Forex Bot and Nova Forex Scalper.",
    ctaLabel: "Open Nova Forex Bots",
    ctaHref: "/?tab=nova-forex-bot",
    showPartnerLogos: true,
    partnerBrand: "vantage",
  },
  tiomarkets: {
    enabled: true,
    title: "NovaStaris × TIOmarkets — forex trading is here",
    body: "Register on TIOmarkets through NovaStaris and connect your MT4/MT5 account to trade with Nova Forex Bot and Nova Forex Scalper.",
    ctaLabel: "Open Nova Forex Bots",
    ctaHref: "/?tab=nova-forex-bot",
    showPartnerLogos: true,
    partnerBrand: "tiomarkets",
  },
  assexmarkets: {
    enabled: true,
    title: "NovaStaris × Assexmarkets — forex trading is here",
    body: "Register on Assexmarkets through NovaStaris and connect your MT4/MT5 account to trade with Nova Forex Bot and Nova Forex Scalper.",
    ctaLabel: "Open Nova Forex Bots",
    ctaHref: "/?tab=nova-forex-bot",
    showPartnerLogos: true,
    partnerBrand: "assexmarkets",
  },
};

/** Suggested customer email copy per broker (Admin → Banners → Email). */
export const FOREX_PARTNERSHIP_EMAIL: Record<ForexPartnerBrokerId, { subject: string; body: string }> = {
  vantage: {
    subject: "NovaStaris × Vantage Markets — trade forex with your MT4/MT5 account",
    body: `Hi there,

We partnered with Vantage Markets so NovaStaris members can trade forex, metals, and indices — and connect MT4/MT5 directly to our Nova Forex Bot and Nova Forex Scalper.

Register through our partner link, then link your MT4/MT5 login in NovaStaris to start trading with AI on your account.

Your referral link: [add Vantage affiliate link]

How to get started:
1. Sign in to NovaStaris → Focus → Bots → Nova Forex Bots.
2. Tap "Register on Vantage Markets" in the partnership banner—or use the link above.
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
1. Sign in to NovaStaris → Focus → Bots → Nova Forex Bots.
2. Tap "Register on TIOmarkets" in the partnership banner—or use the link above.
3. After your TIOmarkets account is ready, connect your MT4/MT5 login in NovaStaris and start trading.

Questions? Reply to this email or use Need Help in the app.

— The NovaStaris team
https://novastaris.ai`,
  },
  assexmarkets: {
    subject: "NovaStaris × Assexmarkets — trade forex with your MT4/MT5 account",
    body: `Hi there,

We partnered with Assexmarkets so NovaStaris members can trade forex, metals, and indices — and connect MT4/MT5 directly to our Nova Forex Bot and Nova Forex Scalper.

Register through our partner link, then link your MT4/MT5 login in NovaStaris to start trading with AI on your account.

Your referral link: https://www.assexmarkets.com/

How to get started:
1. Sign in to NovaStaris → Focus → Bots → Nova Forex Bots.
2. Tap "Register on Assexmarkets" in the partnership banner—or use the link above.
3. After your Assexmarkets account is ready, connect your MT4/MT5 login in NovaStaris and start trading.

Questions? Reply to this email or use Need Help in the app.

— The NovaStaris team
https://novastaris.ai`,
  },
};

/** Customer announcement: Nova Forex Bot + Scalper launch (Admin → Banners → Email). */
export const NOVA_FOREX_BOTS_LAUNCH_EMAIL = {
  subject: "NovaStaris Forex Bots are here — trade on your own MT4/MT5 account",
  body: `Hi there,

Nova Forex Bots are live on NovaStaris.

You can now run AI-assisted trades in forex, metals, and indices on your own MT4/MT5 account — not signals only.

What's new
• Nova Forex Bot — MA crossover strategy on your connected account
• Nova Forex Scalper — entry → exit scalps, with "Scalp this trade" from Nova Forex Scalp Agent

Supported brokers (when enabled for your account)
• Vantage Markets
• TIOmarkets
• Assexmarkets (when turned on)

How to get started
1. Sign in to NovaStaris → Focus → Bots → Nova Forex Bots
2. Connect your MT4/MT5 login (use the exact server name from your terminal)
3. Choose Nova Forex Bot or Nova Forex Scalper, set your symbol and size, then Save
4. From Nova Forex Agent → Scalp, use "Scalp this trade" to hand levels to the Scalper

Tips
• Covers FX pairs, metals (e.g. XAUUSD), and indices — whatever your broker lists
• Leverage is set in MT5 / your broker — NovaStaris shows it and uses it for sizing
• Use the exact symbol name your broker lists
• Start in demo mode if you want to test first

Questions? Reply to this email or use Need Help in the app.

— The NovaStaris team
https://novastaris.ai`,
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

function normalize(broker: ForexPartnerBrokerId, row: Partial<Row>): ForexBrokerPartnerPromoConfig {
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

async function clickCount(broker: ForexPartnerBrokerId): Promise<number> {
  const db = clickDb();
  if (!db) return 0;
  try {
    return await db.count({ where: { broker } });
  } catch {
    return 0;
  }
}

function rowToAdmin(
  broker: ForexPartnerBrokerId,
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
  broker: ForexPartnerBrokerId
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
  broker: ForexPartnerBrokerId
): Promise<ForexBrokerPartnerPromoAdmin> {
  return getForexBrokerPartnerPromoForPublic(broker);
}

export async function getAllForexBrokerPartnerPromosForAdmin(): Promise<ForexBrokerPartnerPromoAdmin[]> {
  return Promise.all(FOREX_BROKER_PARTNER_IDS.map((broker) => getForexBrokerPartnerPromoForAdmin(broker)));
}

export async function setForexBrokerPartnerPromo(
  broker: ForexPartnerBrokerId,
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
  broker: ForexPartnerBrokerId
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

export function forexBrokerPartnerRegisterPath(broker: ForexPartnerBrokerId): string {
  return `/api/forex-broker-partner/register?broker=${broker}`;
}

export function forexBrokerLabel(broker: ForexPartnerBrokerId): string {
  return BROKER_LABEL[broker] ?? broker;
}

export function guestHashFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function recordForexBrokerPartnerLinkClick(input: {
  broker: ForexPartnerBrokerId;
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
  broker?: ForexPartnerBrokerId,
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
