import { prisma } from "@/lib/db";

export const MEME_AGENT_BANNER_ID = "default";

export type MemeAgentBannerConfig = {
  enabled: boolean;
  message: string;
};

export type MemeAgentBannerAdmin = MemeAgentBannerConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_MEME_AGENT_BANNER: MemeAgentBannerConfig = {
  enabled: true,
  message:
    "Before entering a trade on Dex Screener, GMGN, Pump.fun, Axiom or Padre, analyze the coin first here with Nova AI Analysis.",
};

type PrismaWithMemeAgentBanner = typeof prisma & {
  memeAgentBanner?: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      enabled: boolean;
      message: string;
      updatedAt: Date;
    } | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; enabled: boolean; message: string };
      update: { enabled: boolean; message: string };
    }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

function db() {
  return (prisma as unknown as PrismaWithMemeAgentBanner).memeAgentBanner ?? null;
}

function rowToAdmin(row: { enabled: boolean; message: string; updatedAt?: Date }, usesDefault: boolean): MemeAgentBannerAdmin {
  return {
    enabled: row.enabled,
    message: row.message,
    usesDefault,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getMemeAgentBannerForPublic(): Promise<MemeAgentBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) return rowToAdmin(DEFAULT_MEME_AGENT_BANNER, true);
  const row = await bannerDb.findUnique({ where: { id: MEME_AGENT_BANNER_ID } });
  if (!row) return rowToAdmin(DEFAULT_MEME_AGENT_BANNER, true);
  return rowToAdmin(row, false);
}

export async function getMemeAgentBannerForAdmin(): Promise<MemeAgentBannerAdmin> {
  return getMemeAgentBannerForPublic();
}

export async function setMemeAgentBanner(patch: Partial<MemeAgentBannerConfig>): Promise<MemeAgentBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Meme agent banner storage unavailable.");
  const current = await getMemeAgentBannerForAdmin();
  const next: MemeAgentBannerConfig = {
    enabled: patch.enabled ?? current.enabled,
    message: (patch.message ?? current.message).trim() || DEFAULT_MEME_AGENT_BANNER.message,
  };
  await bannerDb.upsert({
    where: { id: MEME_AGENT_BANNER_ID },
    create: { id: MEME_AGENT_BANNER_ID, enabled: next.enabled, message: next.message },
    update: { enabled: next.enabled, message: next.message },
  });
  return getMemeAgentBannerForAdmin();
}

export async function resetMemeAgentBannerToDefault(): Promise<MemeAgentBannerAdmin> {
  const bannerDb = db();
  if (!bannerDb) throw new Error("Meme agent banner storage unavailable.");
  try {
    await bannerDb.delete({ where: { id: MEME_AGENT_BANNER_ID } });
  } catch {
    /* row may not exist */
  }
  return getMemeAgentBannerForAdmin();
}
