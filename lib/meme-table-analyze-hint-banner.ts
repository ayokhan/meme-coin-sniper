import { prisma } from "@/lib/db";

export const MEME_TABLE_HINT_BANNER_ID = "default";

export type MemeTableAnalyzeHintBannerConfig = {
  enabled: boolean;
  headline: string;
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
  headline: "Don't get rugged",
  guestTitle: "Analyze before you ape",
  guestBody:
    "Sign in, then tap the purple Analyze button on any row — works on Solana, BSC, ETH, Robinhood, and HyperEVM meme coins.",
  freeTitle: "Scan a row, then Analyze",
  freeBody:
    "Tap the purple Analyze button on any pair — Solana, BSC, ETH, Robinhood, and HyperEVM. Or open AI Agent to paste a contract.",
  vipTitle: "Unlimited AI on every row",
  vipBody:
    "Tap the purple Analyze button on any row — unlimited Meme Agent. Or open AI Agent to paste a Solana, BSC, ETH, Robinhood, or HyperEVM contract.",
};

const SUPPORTED_MEME_CHAINS =
  "Solana, BSC, ETH, Robinhood, or HyperEVM";

const SUPPORTED_MEME_CHAINS_AND =
  "Solana, BSC, ETH, Robinhood, and HyperEVM";

/** Refresh admin-saved copy that still lists older chain sets. */
function withSupportedChainCopy(text: string): string {
  return text
    .replace(
      /\bNovaStaris AI Analysis works on Solana and BSC meme coins\b/gi,
      `NovaStaris AI Analysis works on ${SUPPORTED_MEME_CHAINS_AND} meme coins`
    )
    .replace(
      /\bworks on Solana and BSC meme coins\b/gi,
      `works on ${SUPPORTED_MEME_CHAINS_AND} meme coins`
    )
    .replace(/\bSolana and BSC meme coins\b/gi, `${SUPPORTED_MEME_CHAINS_AND} meme coins`)
    .replace(/\bSolana or BSC\b/gi, SUPPORTED_MEME_CHAINS)
    .replace(/\bSolana \+ BSC\b/g, SUPPORTED_MEME_CHAINS)
    .replace(/\bSolana, BSC, or ETH\b/gi, SUPPORTED_MEME_CHAINS)
    .replace(/\bSolana, BSC, ETH\b/g, SUPPORTED_MEME_CHAINS)
    .replace(/\bSolana and BSC\b/gi, SUPPORTED_MEME_CHAINS_AND)
    .replace(
      /\bon any Solana, BSC, or ETH meme coin\b/gi,
      `on any ${SUPPORTED_MEME_CHAINS_AND} meme coin`
    );
}

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
    headline: (row.headline ?? d.headline).trim() || d.headline,
    guestTitle: (row.guestTitle ?? d.guestTitle).trim() || d.guestTitle,
    guestBody: withSupportedChainCopy((row.guestBody ?? d.guestBody).trim() || d.guestBody),
    freeTitle: (row.freeTitle ?? d.freeTitle).trim() || d.freeTitle,
    freeBody: withSupportedChainCopy((row.freeBody ?? d.freeBody).trim() || d.freeBody),
    vipTitle: (row.vipTitle ?? d.vipTitle).trim() || d.vipTitle,
    vipBody: withSupportedChainCopy((row.vipBody ?? d.vipBody).trim() || d.vipBody),
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
    headline: patch.headline ?? current.headline,
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
