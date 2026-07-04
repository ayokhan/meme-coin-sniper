import { prisma } from "@/lib/db";

export const GUEST_NUDGE_BANNER_ID = "default";

export type GuestRegistrationNudgeBannerConfig = {
  enabled: boolean;
  title: string;
  titleEngaged: string;
  body: string;
  bodyEngaged: string;
};

export type GuestRegistrationNudgeBannerAdmin = GuestRegistrationNudgeBannerConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_GUEST_NUDGE_BANNER: GuestRegistrationNudgeBannerConfig = {
  enabled: true,
  title: "Create a free NovaStaris account",
  titleEngaged: "Enjoying NovaStaris? Save your progress with a free account.",
  body: "Free to join · no credit card · save watchlists and get ready to upgrade when you want VIP tools.",
  bodyEngaged:
    "Sign up free in under a minute — save watchlists, track wallets, and unlock member features. No credit card required.",
};

type Row = GuestRegistrationNudgeBannerConfig & { updatedAt?: Date };

type Db = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: { id: string } & GuestRegistrationNudgeBannerConfig;
    update: GuestRegistrationNudgeBannerConfig;
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

function db(): Db | null {
  return (prisma as unknown as { guestRegistrationNudgeBanner?: Db }).guestRegistrationNudgeBanner ?? null;
}

function normalize(row: Partial<Row>): GuestRegistrationNudgeBannerConfig {
  const d = DEFAULT_GUEST_NUDGE_BANNER;
  return {
    enabled: row.enabled ?? d.enabled,
    title: (row.title ?? d.title).trim() || d.title,
    titleEngaged: (row.titleEngaged ?? d.titleEngaged).trim() || d.titleEngaged,
    body: (row.body ?? d.body).trim() || d.body,
    bodyEngaged: (row.bodyEngaged ?? d.bodyEngaged).trim() || d.bodyEngaged,
  };
}

function rowToAdmin(row: Row, usesDefault: boolean): GuestRegistrationNudgeBannerAdmin {
  return { ...normalize(row), usesDefault, updatedAt: row.updatedAt?.toISOString() ?? null };
}

export async function getGuestRegistrationNudgeBannerForPublic(): Promise<GuestRegistrationNudgeBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) return rowToAdmin(DEFAULT_GUEST_NUDGE_BANNER, true);
  const row = await bannerDb.findUnique({ where: { id: GUEST_NUDGE_BANNER_ID } });
  if (!row) return rowToAdmin(DEFAULT_GUEST_NUDGE_BANNER, true);
  return rowToAdmin(row, false);
}

export async function setGuestRegistrationNudgeBanner(
  patch: Partial<GuestRegistrationNudgeBannerConfig>
): Promise<GuestRegistrationNudgeBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Guest nudge banner storage unavailable.");
  const current = await getGuestRegistrationNudgeBannerForPublic();
  const next = normalize({
    enabled: patch.enabled ?? current.enabled,
    title: patch.title ?? current.title,
    titleEngaged: patch.titleEngaged ?? current.titleEngaged,
    body: patch.body ?? current.body,
    bodyEngaged: patch.bodyEngaged ?? current.bodyEngaged,
  });
  await bannerDb.upsert({
    where: { id: GUEST_NUDGE_BANNER_ID },
    create: { id: GUEST_NUDGE_BANNER_ID, ...next },
    update: next,
  });
  return getGuestRegistrationNudgeBannerForPublic();
}

export async function resetGuestRegistrationNudgeBannerToDefault(): Promise<GuestRegistrationNudgeBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Guest nudge banner storage unavailable.");
  try {
    await bannerDb.delete({ where: { id: GUEST_NUDGE_BANNER_ID } });
  } catch {
    /* ignore */
  }
  return getGuestRegistrationNudgeBannerForPublic();
}
