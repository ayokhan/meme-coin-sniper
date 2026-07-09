import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import type { SiteAnnouncementBannerConfig } from "@/lib/site-announcement-banner";

export const BLOFIN_PARTNER_PROMO_ID = "default";

export type BlofinPartnerPromoConfig = {
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

export type BlofinPartnerPromoAdmin = BlofinPartnerPromoConfig & {
  active: boolean;
  usesDefault: boolean;
  updatedAt: string | null;
  registerClickCount: number;
};

export const DEFAULT_BLOFIN_PARTNER_PROMO: BlofinPartnerPromoConfig = {
  enabled: false,
  registerUrl: "",
  headline: "Trade on Blofin with NovaStaris",
  bodyText:
    "Open a Blofin account through our partner link, then connect your API keys to run NovaStaris trading bots on your account.",
  promoLabel: "10% back on transfer fees",
  ctaLabel: "Register on Blofin",
  showLogosInBanner: true,
  includeLogosInEmail: true,
  includeLogosInBroadcast: true,
};

/** Site announcement preset for Blofin partnership launch (Admin → Banners). */
export const BLOFIN_PARTNERSHIP_LAUNCH_BANNER: SiteAnnouncementBannerConfig = {
  enabled: true,
  title: "NovaStaris × Blofin — partner rewards",
  body: "Register on Blofin through NovaStaris and get 10% back on transfer fees. Connect your API keys in Trading Bot or NovaScalper to trade with AI on your account.",
  ctaLabel: "Open Trading Bot",
  ctaHref: "/?tab=trading-bot",
  showPartnerLogos: true,
};

/** Suggested customer email copy (Admin → Banners → Email). */
export const BLOFIN_PARTNERSHIP_EMAIL = {
  subject: "NovaStaris × Blofin — 10% back on transfer fees",
  body: `Hi there,

We partnered with Blofin so NovaStaris members can trade futures on a top exchange and connect API keys directly to our Trading Bot and NovaScalper.

Register through our partner link and you'll get 10% back on transfer fees as a NovaStaris member perk.

How to get started:
1. Sign in to NovaStaris → open Trading Bot (Futures).
2. Tap "Register on Blofin" in the partnership banner.
3. After your Blofin account is ready, save your API keys in NovaStaris and start trading with AI on your account.

Questions? Reply to this email or use Need Help in the app.

— The NovaStaris team
https://novastaris.ai`,
} as const;

type Row = BlofinPartnerPromoConfig & { updatedAt?: Date };

type PromoDb = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: { id: string } & BlofinPartnerPromoConfig;
    update: BlofinPartnerPromoConfig;
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

type ClickDb = {
  count: (args?: { where?: { userId?: { not: null } } }) => Promise<number>;
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
  return (prisma as unknown as { blofinPartnerPromo?: PromoDb }).blofinPartnerPromo ?? null;
}

function clickDb(): ClickDb | null {
  return (prisma as unknown as { blofinPartnerLinkClick?: ClickDb }).blofinPartnerLinkClick ?? null;
}

function normalize(row: Partial<Row>): BlofinPartnerPromoConfig {
  const d = DEFAULT_BLOFIN_PARTNER_PROMO;
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

function isActive(config: BlofinPartnerPromoConfig): boolean {
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

function rowToAdmin(row: Row, usesDefault: boolean, count: number): BlofinPartnerPromoAdmin {
  const config = normalize(row);
  return {
    ...config,
    active: isActive(config),
    usesDefault,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    registerClickCount: count,
  };
}

export async function getBlofinPartnerPromoForPublic(): Promise<BlofinPartnerPromoAdmin> {
  const db = promoDb();
  const count = await clickCount();
  if (!db) return { ...normalize(DEFAULT_BLOFIN_PARTNER_PROMO), active: false, usesDefault: true, updatedAt: null, registerClickCount: count };
  const row = await db.findUnique({ where: { id: BLOFIN_PARTNER_PROMO_ID } });
  if (!row) {
    const config = normalize(DEFAULT_BLOFIN_PARTNER_PROMO);
    return { ...config, active: false, usesDefault: true, updatedAt: null, registerClickCount: count };
  }
  return rowToAdmin(row, false, count);
}

export async function getBlofinPartnerPromoForAdmin(): Promise<BlofinPartnerPromoAdmin> {
  return getBlofinPartnerPromoForPublic();
}

export async function setBlofinPartnerPromo(
  patch: Partial<BlofinPartnerPromoConfig>
): Promise<BlofinPartnerPromoAdmin> {
  const db = promoDb();
  if (!db) throw new Error("Blofin partner promo storage unavailable.");
  const current = await getBlofinPartnerPromoForAdmin();
  const next = normalize({
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
    where: { id: BLOFIN_PARTNER_PROMO_ID },
    create: { id: BLOFIN_PARTNER_PROMO_ID, ...next },
    update: next,
  });
  return getBlofinPartnerPromoForAdmin();
}

export async function resetBlofinPartnerPromoToDefault(): Promise<BlofinPartnerPromoAdmin> {
  const db = promoDb();
  if (!db) throw new Error("Blofin partner promo storage unavailable.");
  try {
    await db.delete({ where: { id: BLOFIN_PARTNER_PROMO_ID } });
  } catch {
    /* ignore */
  }
  return getBlofinPartnerPromoForAdmin();
}

export function blofinPartnerRegisterPath(): string {
  return "/api/blofin-partner/register";
}

export function guestHashFromRequest(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function recordBlofinPartnerLinkClick(input: {
  userId?: string | null;
  guestHash?: string | null;
}): Promise<void> {
  const db = clickDb();
  if (!db) return;
  try {
    await db.create({
      data: {
        userId: input.userId ?? null,
        guestHash: input.guestHash ?? null,
      },
    });
  } catch (e) {
    console.error("recordBlofinPartnerLinkClick:", e);
  }
}

export type BlofinPartnerLinkClickRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  guestHash: string | null;
  clickedAt: string;
};

export async function listBlofinPartnerLinkClicks(limit = 100): Promise<BlofinPartnerLinkClickRow[]> {
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
