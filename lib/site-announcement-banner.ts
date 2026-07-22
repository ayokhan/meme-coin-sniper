import { prisma } from "@/lib/db";
import { normalizePartnerBrand, type PartnerBrand } from "@/lib/partner-brand";

export const SITE_ANNOUNCEMENT_ID = "default";

export type SiteAnnouncementBannerConfig = {
  enabled: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  showPartnerLogos: boolean;
  /** Which partner logo to show when showPartnerLogos is true. */
  partnerBrand: PartnerBrand;
};

export type SiteAnnouncementBannerAdmin = SiteAnnouncementBannerConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_SITE_ANNOUNCEMENT: SiteAnnouncementBannerConfig = {
  enabled: false,
  title: "What's new on NovaStaris",
  body: "We have product updates for you. Check your account settings and explore the latest tools on the dashboard.",
  ctaLabel: "",
  ctaHref: "",
  showPartnerLogos: false,
  partnerBrand: "blofin",
};

type Row = SiteAnnouncementBannerConfig & { updatedAt?: Date };

type Db = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: { id: string } & SiteAnnouncementBannerConfig;
    update: SiteAnnouncementBannerConfig;
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

function db(): Db | null {
  return (prisma as unknown as { siteAnnouncementBanner?: Db }).siteAnnouncementBanner ?? null;
}

function normalize(row: Partial<Row>): SiteAnnouncementBannerConfig {
  const d = DEFAULT_SITE_ANNOUNCEMENT;
  return {
    enabled: row.enabled ?? d.enabled,
    title: (row.title ?? d.title).trim() || d.title,
    body: (row.body ?? d.body).trim() || d.body,
    ctaLabel: (row.ctaLabel ?? d.ctaLabel).trim(),
    ctaHref: (row.ctaHref ?? d.ctaHref).trim(),
    showPartnerLogos: row.showPartnerLogos ?? d.showPartnerLogos,
    partnerBrand: normalizePartnerBrand(row.partnerBrand ?? d.partnerBrand),
  };
}

function rowToAdmin(row: Row, usesDefault: boolean): SiteAnnouncementBannerAdmin {
  return { ...normalize(row), usesDefault, updatedAt: row.updatedAt?.toISOString() ?? null };
}

export async function getSiteAnnouncementBannerForPublic(): Promise<SiteAnnouncementBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) return rowToAdmin(DEFAULT_SITE_ANNOUNCEMENT, true);
  const row = await bannerDb.findUnique({ where: { id: SITE_ANNOUNCEMENT_ID } });
  if (!row) return rowToAdmin(DEFAULT_SITE_ANNOUNCEMENT, true);
  return rowToAdmin(row, false);
}

export async function setSiteAnnouncementBanner(
  patch: Partial<SiteAnnouncementBannerConfig>
): Promise<SiteAnnouncementBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Site announcement storage unavailable.");
  const current = await getSiteAnnouncementBannerForPublic();
  const next = normalize({
    enabled: patch.enabled ?? current.enabled,
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
    ctaLabel: patch.ctaLabel ?? current.ctaLabel,
    ctaHref: patch.ctaHref ?? current.ctaHref,
    showPartnerLogos: patch.showPartnerLogos ?? current.showPartnerLogos,
    partnerBrand: patch.partnerBrand ?? current.partnerBrand,
  });
  await bannerDb.upsert({
    where: { id: SITE_ANNOUNCEMENT_ID },
    create: { id: SITE_ANNOUNCEMENT_ID, ...next },
    update: next,
  });
  return getSiteAnnouncementBannerForPublic();
}

export async function resetSiteAnnouncementBannerToDefault(): Promise<SiteAnnouncementBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Site announcement storage unavailable.");
  try {
    await bannerDb.delete({ where: { id: SITE_ANNOUNCEMENT_ID } });
  } catch {
    /* ignore */
  }
  return getSiteAnnouncementBannerForPublic();
}
