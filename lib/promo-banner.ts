/**
 * Owner-managed promo banner (giveaways, join-free campaigns).
 * Configured in Admin → Banners.
 */
import { prisma } from "@/lib/db";

export const PROMO_BANNER_ID = "default";

export type PromoBannerConfig = {
  enabled: boolean;
  headline: string;
  prizeLabel: string;
  drawAt: string | null;
  bodyText: string | null;
  ctaLabel: string;
  ctaHref: string;
  showOnDashboard: boolean;
  showOnRegister: boolean;
};

export type PromoBannerAdmin = PromoBannerConfig & {
  active: boolean;
  usesDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_PROMO_BANNER: PromoBannerConfig = {
  enabled: true,
  headline: "Sign up for free for a chance to win",
  prizeLabel: "1 SOL",
  drawAt: "2026-08-31T23:59:59.000Z",
  bodyText:
    "Create your free NovaStaris account — no credit card. One random eligible member wins after the draw.",
  ctaLabel: "Sign up free",
  ctaHref: "/register",
  showOnDashboard: true,
  showOnRegister: true,
};

type PrismaWithPromoBanner = typeof prisma & {
  promoBanner?: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      enabled: boolean;
      headline: string;
      prizeLabel: string;
      drawAt: Date | null;
      bodyText: string | null;
      ctaLabel: string;
      ctaHref: string;
      showOnDashboard: boolean;
      showOnRegister: boolean;
      updatedAt: Date;
    } | null>;
    upsert: (args: {
      where: { id: string };
      create: {
        id: string;
        enabled: boolean;
        headline: string;
        prizeLabel: string;
        drawAt: Date | null;
        bodyText: string | null;
        ctaLabel: string;
        ctaHref: string;
        showOnDashboard: boolean;
        showOnRegister: boolean;
      };
      update: {
        enabled: boolean;
        headline: string;
        prizeLabel: string;
        drawAt: Date | null;
        bodyText: string | null;
        ctaLabel: string;
        ctaHref: string;
        showOnDashboard: boolean;
        showOnRegister: boolean;
      };
    }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

function db() {
  return (prisma as unknown as PrismaWithPromoBanner).promoBanner ?? null;
}

function rowToConfig(
  row: {
    enabled: boolean;
    headline: string;
    prizeLabel: string;
    drawAt: Date | null;
    bodyText: string | null;
    ctaLabel: string;
    ctaHref: string;
    showOnDashboard: boolean;
    showOnRegister: boolean;
    updatedAt?: Date;
  },
  usesDefault: boolean
): PromoBannerAdmin {
  const drawAt = row.drawAt?.toISOString() ?? null;
  const config: PromoBannerConfig = {
    enabled: row.enabled,
    headline: row.headline,
    prizeLabel: row.prizeLabel,
    drawAt,
    bodyText: row.bodyText,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    showOnDashboard: row.showOnDashboard,
    showOnRegister: row.showOnRegister,
  };
  return {
    ...config,
    active: isPromoBannerActive(config, Date.now()),
    usesDefault,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export function isPromoBannerActive(
  config: Pick<PromoBannerConfig, "enabled" | "drawAt">,
  nowMs = Date.now()
): boolean {
  if (!config.enabled) return false;
  if (!config.drawAt) return true;
  const drawMs = Date.parse(config.drawAt);
  if (!Number.isFinite(drawMs)) return true;
  return nowMs <= drawMs;
}

export function formatPromoDrawDate(iso: string | null): string {
  if (!iso) return "TBA";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "TBA";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function getPromoBannerForPublic(): Promise<PromoBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) {
    return rowToConfig(
      {
        ...DEFAULT_PROMO_BANNER,
        drawAt: DEFAULT_PROMO_BANNER.drawAt ? new Date(DEFAULT_PROMO_BANNER.drawAt) : null,
      },
      true
    );
  }
  const row = await bannerDb.findUnique({ where: { id: PROMO_BANNER_ID } });
  if (!row) {
    return rowToConfig(
      {
        ...DEFAULT_PROMO_BANNER,
        drawAt: DEFAULT_PROMO_BANNER.drawAt ? new Date(DEFAULT_PROMO_BANNER.drawAt) : null,
      },
      true
    );
  }
  return rowToConfig(row, false);
}

export async function getPromoBannerForAdmin(): Promise<PromoBannerAdmin> {
  return getPromoBannerForPublic();
}

export async function setPromoBanner(patch: Partial<PromoBannerConfig>): Promise<PromoBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Promo banner storage unavailable.");

  const current = await getPromoBannerForAdmin();
  const next: PromoBannerConfig = {
    enabled: patch.enabled ?? current.enabled,
    headline: (patch.headline ?? current.headline).trim() || DEFAULT_PROMO_BANNER.headline,
    prizeLabel: (patch.prizeLabel ?? current.prizeLabel).trim() || DEFAULT_PROMO_BANNER.prizeLabel,
    drawAt: patch.drawAt !== undefined ? patch.drawAt : current.drawAt,
    bodyText:
      patch.bodyText !== undefined
        ? patch.bodyText?.trim() || null
        : current.bodyText,
    ctaLabel: (patch.ctaLabel ?? current.ctaLabel).trim() || DEFAULT_PROMO_BANNER.ctaLabel,
    ctaHref: (patch.ctaHref ?? current.ctaHref).trim() || DEFAULT_PROMO_BANNER.ctaHref,
    showOnDashboard: patch.showOnDashboard ?? current.showOnDashboard,
    showOnRegister: patch.showOnRegister ?? current.showOnRegister,
  };

  if (next.drawAt) {
    const ms = Date.parse(next.drawAt);
    if (!Number.isFinite(ms)) throw new Error("Invalid draw date.");
  }

  await bannerDb.upsert({
    where: { id: PROMO_BANNER_ID },
    create: {
      id: PROMO_BANNER_ID,
      enabled: next.enabled,
      headline: next.headline,
      prizeLabel: next.prizeLabel,
      drawAt: next.drawAt ? new Date(next.drawAt) : null,
      bodyText: next.bodyText,
      ctaLabel: next.ctaLabel,
      ctaHref: next.ctaHref,
      showOnDashboard: next.showOnDashboard,
      showOnRegister: next.showOnRegister,
    },
    update: {
      enabled: next.enabled,
      headline: next.headline,
      prizeLabel: next.prizeLabel,
      drawAt: next.drawAt ? new Date(next.drawAt) : null,
      bodyText: next.bodyText,
      ctaLabel: next.ctaLabel,
      ctaHref: next.ctaHref,
      showOnDashboard: next.showOnDashboard,
      showOnRegister: next.showOnRegister,
    },
  });

  return getPromoBannerForAdmin();
}

export async function resetPromoBannerToDefault(): Promise<PromoBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Promo banner storage unavailable.");
  try {
    await bannerDb.delete({ where: { id: PROMO_BANNER_ID } });
  } catch {
    // row may not exist
  }
  return getPromoBannerForAdmin();
}
