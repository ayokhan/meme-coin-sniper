import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { SiteAnnouncementBannerConfig } from "@/lib/site-announcement-banner";

export const COINBASE_PARTNER_PROMO_ID = "default";

export type CoinbasePartnerPromoConfig = {
  enabled: boolean;
  registerUrl: string;
  headline: string;
  bodyText: string;
  promoLabel: string;
  ctaLabel: string;
  referralCode: string;
  showLogosInBanner: boolean;
  includeLogosInEmail: boolean;
  includeLogosInBroadcast: boolean;
};

export type CoinbasePartnerPromoAdmin = CoinbasePartnerPromoConfig & {
  active: boolean;
  usesDefault: boolean;
  updatedAt: string | null;
  registerClickCount: number;
};

export const DEFAULT_COINBASE_PARTNER_PROMO: CoinbasePartnerPromoConfig = {
  enabled: true,
  registerUrl: "https://coinbase.com/join/WGVMDA2?src=referral-link",
  headline: "Trade Futures & Spot on Coinbase with NovaStaris",
  bodyText:
    "Register with Coinbase through NovaStaris, then connect your CDP API keys. VIP members can run the AI Trading Bot and NovaScalper on Coinbase — same PNL, positions, and automation as Blofin.",
  promoLabel: "Coinbase referral",
  ctaLabel: "Register on Coinbase",
  referralCode: "WGVMDA2",
  showLogosInBanner: true,
  includeLogosInEmail: true,
  includeLogosInBroadcast: true,
};

export const COINBASE_PARTNERSHIP_LAUNCH_BANNER: SiteAnnouncementBannerConfig = {
  enabled: true,
  title: "NovaStaris × Coinbase — Futures trading",
  body: "Trade Coinbase Futures from NovaStaris (VIP). Register with our referral link if you need an account, then connect your CDP API keys in AI Trading Bot or NovaScalper.",
  ctaLabel: "Open Trading Bot",
  ctaHref: "/?tab=trading-bot",
  showPartnerLogos: true,
  partnerBrand: "coinbase",
};

export const COINBASE_PARTNERSHIP_EMAIL = {
  subject: "NovaStaris now supports Coinbase Futures",
  body: `Hi there,

NovaStaris now supports Coinbase Futures alongside Blofin.

Don't have a Coinbase account yet?
Register with our referral link — when you sign up and make your first eligible purchase, you get Coinbase's invite reward (terms apply):
https://coinbase.com/join/WGVMDA2?src=referral-link

What you can do (VIP)
• Connect your Coinbase CDP API keys in AI Trading Bot or NovaScalper
• Choose Blofin or Coinbase (or use both with separate keys)
• Same features: open positions, closed-trade PNL, share cards, and bot automation

Coinbase bot trading on NovaStaris is a VIP feature. Free users can still open a Coinbase account with the link above.

How to get started
1. Create or sign in to Coinbase (link above if you're new)
2. Sign in to NovaStaris → AI Trading Bot (VIP)
3. Save your Coinbase API keys (CDP portal — view + trade permissions)
4. Set Provider to Coinbase Futures in Config
5. Run the bot or open NovaScalper with Exchange = Coinbase

Create API keys: https://portal.cdp.coinbase.com

Questions? Use Chat, Support, or Need Help in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
https://novastaris.ai`,
} as const;

export const COINBASE_REFERRAL_EMAIL = {
  subject: "Your Coinbase referral — trade Futures with NovaStaris",
  body: `Hi there,

You're invited to trade Coinbase Futures through NovaStaris.

Your referral link: {{REFERRAL_URL}}
Referral code: {{REFERRAL_CODE}}

Steps
1. Open the link above and create or sign in to your Coinbase account
2. Enable Futures / derivatives if prompted
3. Create a CDP API key (view + trade) at portal.cdp.coinbase.com
4. In NovaStaris → AI Trading Bot (VIP), save your Coinbase keys and set Provider to Coinbase Futures

Coinbase bot trading on NovaStaris is a VIP feature. Anyone can still open a Coinbase account with the referral link.

NovaStaris connects to your account — we never hold your funds.

Questions? Use Chat, Support, or Need Help in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
https://novastaris.ai`,
} as const;

type Row = CoinbasePartnerPromoConfig & { updatedAt?: Date };

type PromoDb = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: { id: string } & CoinbasePartnerPromoConfig;
    update: CoinbasePartnerPromoConfig;
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

type ClickDb = {
  count: () => Promise<number>;
  create: (args: { data: { userId?: string | null; guestHash?: string | null } }) => Promise<unknown>;
  findMany: (args: {
    take?: number;
    orderBy?: { clickedAt: "desc" };
    include?: { user: { select: { email: true; name: true } } };
  }) => Promise<
    {
      id: string;
      userId: string | null;
      guestHash: string | null;
      clickedAt: Date;
      user?: { email: string | null; name: string | null } | null;
    }[]
  >;
};

function promoDb(): PromoDb | null {
  return (prisma as unknown as { coinbasePartnerPromo?: PromoDb }).coinbasePartnerPromo ?? null;
}

function clickDb(): ClickDb | null {
  return (prisma as unknown as { coinbasePartnerLinkClick?: ClickDb }).coinbasePartnerLinkClick ?? null;
}

function normalize(row: Partial<Row>): CoinbasePartnerPromoConfig {
  const d = DEFAULT_COINBASE_PARTNER_PROMO;
  return {
    enabled: row.enabled ?? d.enabled,
    registerUrl: (row.registerUrl ?? d.registerUrl).trim(),
    headline: (row.headline ?? d.headline).trim() || d.headline,
    bodyText: (row.bodyText ?? d.bodyText).trim() || d.bodyText,
    promoLabel: (row.promoLabel ?? d.promoLabel).trim() || d.promoLabel,
    ctaLabel: (row.ctaLabel ?? d.ctaLabel).trim() || d.ctaLabel,
    referralCode: (row.referralCode ?? d.referralCode).trim(),
    showLogosInBanner: row.showLogosInBanner ?? d.showLogosInBanner,
    includeLogosInEmail: row.includeLogosInEmail ?? d.includeLogosInEmail,
    includeLogosInBroadcast: row.includeLogosInBroadcast ?? d.includeLogosInBroadcast,
  };
}

function isActive(config: CoinbasePartnerPromoConfig): boolean {
  return config.enabled && !!config.registerUrl;
}

async function clickCount(): Promise<number> {
  const db = clickDb();
  if (!db) return 0;
  try {
    return await db.count();
  } catch {
    return 0;
  }
}

function rowToAdmin(row: Row, usesDefault: boolean, count: number): CoinbasePartnerPromoAdmin {
  const config = normalize(row);
  return {
    ...config,
    active: isActive(config),
    usesDefault,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    registerClickCount: count,
  };
}

export async function getCoinbasePartnerPromoForPublic(): Promise<CoinbasePartnerPromoAdmin> {
  const db = promoDb();
  const count = await clickCount();
  if (!db) {
    return { ...normalize(DEFAULT_COINBASE_PARTNER_PROMO), active: false, usesDefault: true, updatedAt: null, registerClickCount: count };
  }
  const row = await db.findUnique({ where: { id: COINBASE_PARTNER_PROMO_ID } });
  if (!row) {
    return { ...normalize(DEFAULT_COINBASE_PARTNER_PROMO), active: false, usesDefault: true, updatedAt: null, registerClickCount: count };
  }
  return rowToAdmin(row, false, count);
}

export async function getCoinbasePartnerPromoForAdmin(): Promise<CoinbasePartnerPromoAdmin> {
  return getCoinbasePartnerPromoForPublic();
}

export async function setCoinbasePartnerPromo(
  patch: Partial<CoinbasePartnerPromoConfig>
): Promise<CoinbasePartnerPromoAdmin> {
  const db = promoDb();
  if (!db) throw new Error("Coinbase partner promo storage unavailable.");
  const current = await getCoinbasePartnerPromoForAdmin();
  const {
    active: _a,
    usesDefault: _u,
    updatedAt: _t,
    registerClickCount: _c,
    ...base
  } = current;
  const next = normalize({ ...base, ...patch });
  await db.upsert({
    where: { id: COINBASE_PARTNER_PROMO_ID },
    create: { id: COINBASE_PARTNER_PROMO_ID, ...next },
    update: next,
  });
  return getCoinbasePartnerPromoForAdmin();
}

export function coinbasePartnerRegisterPath(): string {
  return "/api/coinbase-partner/register";
}

export function guestHashFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function recordCoinbasePartnerLinkClick(input: {
  userId?: string | null;
  guestHash?: string | null;
}): Promise<void> {
  const db = clickDb();
  if (!db) return;
  try {
    await db.create({ data: { userId: input.userId ?? null, guestHash: input.guestHash ?? null } });
  } catch (e) {
    console.error("recordCoinbasePartnerLinkClick:", e);
  }
}

export type CoinbasePartnerLinkClickRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  guestHash: string | null;
  clickedAt: string;
};

export async function listCoinbasePartnerLinkClicks(limit = 100): Promise<CoinbasePartnerLinkClickRow[]> {
  const db = clickDb();
  if (!db) return [];
  const rows = await db.findMany({
    take: limit,
    orderBy: { clickedAt: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.user?.email ?? null,
    userName: r.user?.name ?? null,
    guestHash: r.guestHash,
    clickedAt: r.clickedAt.toISOString(),
  }));
}

export function fillCoinbaseReferralEmail(body: string, registerUrl: string, referralCode: string): string {
  return body
    .replace(/\{\{REFERRAL_URL\}\}/g, registerUrl.trim())
    .replace(/\{\{REFERRAL_CODE\}\}/g, referralCode.trim() || "—");
}
