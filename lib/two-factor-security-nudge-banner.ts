import { prisma } from "@/lib/db";

export const TWO_FACTOR_SECURITY_NUDGE_ID = "default";

export type TwoFactorSecurityNudgeBannerConfig = {
  enabled: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  registerSuccessMessage: string;
};

export type TwoFactorSecurityNudgeBannerAdmin = TwoFactorSecurityNudgeBannerConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_TWO_FACTOR_SECURITY_NUDGE: TwoFactorSecurityNudgeBannerConfig = {
  enabled: true,
  title: "Secure your NovaStaris account",
  body: "Two-factor authentication is now available. Add Google Authenticator or email codes for an extra layer of protection when you sign in with email and password.",
  ctaLabel: "Set up 2FA",
  registerSuccessMessage:
    "Account created. Sign in to continue — then enable two-factor authentication in Account settings.",
};

type Row = TwoFactorSecurityNudgeBannerConfig & { updatedAt?: Date };

type Db = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: { id: string } & TwoFactorSecurityNudgeBannerConfig;
    update: TwoFactorSecurityNudgeBannerConfig;
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

function db(): Db | null {
  return (prisma as unknown as { twoFactorSecurityNudgeBanner?: Db }).twoFactorSecurityNudgeBanner ?? null;
}

function normalize(row: Partial<Row>): TwoFactorSecurityNudgeBannerConfig {
  const d = DEFAULT_TWO_FACTOR_SECURITY_NUDGE;
  return {
    enabled: row.enabled ?? d.enabled,
    title: (row.title ?? d.title).trim() || d.title,
    body: (row.body ?? d.body).trim() || d.body,
    ctaLabel: (row.ctaLabel ?? d.ctaLabel).trim() || d.ctaLabel,
    registerSuccessMessage: (row.registerSuccessMessage ?? d.registerSuccessMessage).trim() || d.registerSuccessMessage,
  };
}

function rowToAdmin(row: Row, usesDefault: boolean): TwoFactorSecurityNudgeBannerAdmin {
  return { ...normalize(row), usesDefault, updatedAt: row.updatedAt?.toISOString() ?? null };
}

export async function getTwoFactorSecurityNudgeBannerForPublic(): Promise<TwoFactorSecurityNudgeBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) return rowToAdmin(DEFAULT_TWO_FACTOR_SECURITY_NUDGE, true);
  const row = await bannerDb.findUnique({ where: { id: TWO_FACTOR_SECURITY_NUDGE_ID } });
  if (!row) return rowToAdmin(DEFAULT_TWO_FACTOR_SECURITY_NUDGE, true);
  return rowToAdmin(row, false);
}

export async function setTwoFactorSecurityNudgeBanner(
  patch: Partial<TwoFactorSecurityNudgeBannerConfig>
): Promise<TwoFactorSecurityNudgeBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("2FA security nudge banner storage unavailable.");
  const current = await getTwoFactorSecurityNudgeBannerForPublic();
  const next = normalize({
    enabled: patch.enabled ?? current.enabled,
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
    ctaLabel: patch.ctaLabel ?? current.ctaLabel,
    registerSuccessMessage: patch.registerSuccessMessage ?? current.registerSuccessMessage,
  });
  await bannerDb.upsert({
    where: { id: TWO_FACTOR_SECURITY_NUDGE_ID },
    create: { id: TWO_FACTOR_SECURITY_NUDGE_ID, ...next },
    update: next,
  });
  return getTwoFactorSecurityNudgeBannerForPublic();
}

export async function resetTwoFactorSecurityNudgeBannerToDefault(): Promise<TwoFactorSecurityNudgeBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("2FA security nudge banner storage unavailable.");
  try {
    await bannerDb.delete({ where: { id: TWO_FACTOR_SECURITY_NUDGE_ID } });
  } catch {
    /* ignore */
  }
  return getTwoFactorSecurityNudgeBannerForPublic();
}
