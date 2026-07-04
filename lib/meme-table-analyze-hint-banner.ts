import { prisma } from "@/lib/db";

export const MEME_TABLE_HINT_BANNER_ID = "default";

export type MemeTableAnalyzeHintBannerConfig = {
  enabled: boolean;
  guestTitle: string;
  guestBody: string;
  freeTitle: string;
  freeBody: string;
  vipTitle: string;
  vipBody: string;
};

export type MemeTableAnalyzeHintBannerAdmin = MemeTableAnalyzeHintBannerConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_MEME_TABLE_HINT_BANNER: MemeTableAnalyzeHintBannerConfig = {
  enabled: true,
  guestTitle: "Analyze any coin with Nova AI Analysis",
  guestBody:
    "Sign in or register free, then tap the purple Analyze button on any row. Nova AI Analysis works on Solana and BSC meme coins.",
  freeTitle: "Tap Analyze for Nova AI Analysis",
  freeBody: "Tap the purple Analyze button on any row to run Nova AI Analysis on any Solana or BSC meme coin.",
  vipTitle: "Unlimited Nova AI Analysis",
  vipBody:
    "Tap the purple Analyze button on any row to run Nova AI Analysis on any Solana or BSC meme coin — unlimited Meme Agent uses.",
};

type Row = MemeTableAnalyzeHintBannerConfig & { updatedAt?: Date };

type Db = {
  findUnique: (args: { where: { id: string } }) => Promise<Row | null>;
  upsert: (args: {
    where: { id: string };
    create: { id: string } & MemeTableAnalyzeHintBannerConfig;
    update: MemeTableAnalyzeHintBannerConfig;
  }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

function db(): Db | null {
  return (prisma as unknown as { memeTableAnalyzeHintBanner?: Db }).memeTableAnalyzeHintBanner ?? null;
}

function normalize(row: Partial<Row>): MemeTableAnalyzeHintBannerConfig {
  const d = DEFAULT_MEME_TABLE_HINT_BANNER;
  return {
    enabled: row.enabled ?? d.enabled,
    guestTitle: (row.guestTitle ?? d.guestTitle).trim() || d.guestTitle,
    guestBody: (row.guestBody ?? d.guestBody).trim() || d.guestBody,
    freeTitle: (row.freeTitle ?? d.freeTitle).trim() || d.freeTitle,
    freeBody: (row.freeBody ?? d.freeBody).trim() || d.freeBody,
    vipTitle: (row.vipTitle ?? d.vipTitle).trim() || d.vipTitle,
    vipBody: (row.vipBody ?? d.vipBody).trim() || d.vipBody,
  };
}

function rowToAdmin(row: Row, usesDefault: boolean): MemeTableAnalyzeHintBannerAdmin {
  return { ...normalize(row), usesDefault, updatedAt: row.updatedAt?.toISOString() ?? null };
}

export async function getMemeTableAnalyzeHintBannerForPublic(): Promise<MemeTableAnalyzeHintBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) return rowToAdmin(DEFAULT_MEME_TABLE_HINT_BANNER, true);
  const row = await bannerDb.findUnique({ where: { id: MEME_TABLE_HINT_BANNER_ID } });
  if (!row) return rowToAdmin(DEFAULT_MEME_TABLE_HINT_BANNER, true);
  return rowToAdmin(row, false);
}

export async function setMemeTableAnalyzeHintBanner(
  patch: Partial<MemeTableAnalyzeHintBannerConfig>
): Promise<MemeTableAnalyzeHintBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Meme table hint banner storage unavailable.");
  const current = await getMemeTableAnalyzeHintBannerForPublic();
  const next = normalize({
    enabled: patch.enabled ?? current.enabled,
    guestTitle: patch.guestTitle ?? current.guestTitle,
    guestBody: patch.guestBody ?? current.guestBody,
    freeTitle: patch.freeTitle ?? current.freeTitle,
    freeBody: patch.freeBody ?? current.freeBody,
    vipTitle: patch.vipTitle ?? current.vipTitle,
    vipBody: patch.vipBody ?? current.vipBody,
  });
  await bannerDb.upsert({
    where: { id: MEME_TABLE_HINT_BANNER_ID },
    create: { id: MEME_TABLE_HINT_BANNER_ID, ...next },
    update: next,
  });
  return getMemeTableAnalyzeHintBannerForPublic();
}

export async function resetMemeTableAnalyzeHintBannerToDefault(): Promise<MemeTableAnalyzeHintBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Meme table hint banner storage unavailable.");
  try {
    await bannerDb.delete({ where: { id: MEME_TABLE_HINT_BANNER_ID } });
  } catch {
    /* ignore */
  }
  return getMemeTableAnalyzeHintBannerForPublic();
}
