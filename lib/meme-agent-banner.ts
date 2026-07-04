import { prisma } from "@/lib/db";

export const MEME_AGENT_BANNER_ID = "default";

export type MemeAgentTitleSize = "lg" | "xl" | "2xl" | "3xl";
export type MemeAgentTitleFont = "display" | "sans";

export type MemeAgentBannerConfig = {
  enabled: boolean;
  title: string;
  message: string;
  titleColor: string;
  titleSize: MemeAgentTitleSize;
  titleFont: MemeAgentTitleFont;
};

export type MemeAgentBannerAdmin = MemeAgentBannerConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_MEME_AGENT_BANNER: MemeAgentBannerConfig = {
  enabled: true,
  title: "Don't Get Rugged",
  message:
    "Before you enter a trade on Dex Screener, GMGN, Pump.fun, Axiom, or Padre, analyze the token here with Nova AI Agent first — so you trade with a clearer plan to take profit.",
  titleColor: "#f472b6",
  titleSize: "2xl",
  titleFont: "display",
};

const TITLE_SIZES = new Set<string>(["lg", "xl", "2xl", "3xl"]);
const TITLE_FONTS = new Set<string>(["display", "sans"]);

type MemeAgentBannerRow = {
  enabled: boolean;
  title?: string | null;
  message: string;
  titleColor?: string | null;
  titleSize?: string | null;
  titleFont?: string | null;
  updatedAt?: Date;
};

type PrismaWithMemeAgentBanner = typeof prisma & {
  memeAgentBanner?: {
    findUnique: (args: { where: { id: string } }) => Promise<MemeAgentBannerRow | null>;
    upsert: (args: {
      where: { id: string };
      create: {
        id: string;
        enabled: boolean;
        title: string;
        message: string;
        titleColor: string;
        titleSize: string;
        titleFont: string;
      };
      update: {
        enabled: boolean;
        title: string;
        message: string;
        titleColor: string;
        titleSize: string;
        titleFont: string;
      };
    }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

function db() {
  return (prisma as unknown as PrismaWithMemeAgentBanner).memeAgentBanner ?? null;
}

function normalizeTitleSize(value: string | null | undefined): MemeAgentTitleSize {
  const v = (value ?? "").trim();
  return TITLE_SIZES.has(v) ? (v as MemeAgentTitleSize) : DEFAULT_MEME_AGENT_BANNER.titleSize;
}

function normalizeTitleFont(value: string | null | undefined): MemeAgentTitleFont {
  const v = (value ?? "").trim();
  return TITLE_FONTS.has(v) ? (v as MemeAgentTitleFont) : DEFAULT_MEME_AGENT_BANNER.titleFont;
}

function normalizeTitleColor(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (/^#[0-9A-Fa-f]{3,8}$/.test(v)) return v;
  return DEFAULT_MEME_AGENT_BANNER.titleColor;
}

function normalizeRow(row: MemeAgentBannerRow): MemeAgentBannerConfig {
  return {
    enabled: row.enabled,
    title: (row.title ?? DEFAULT_MEME_AGENT_BANNER.title).trim() || DEFAULT_MEME_AGENT_BANNER.title,
    message: row.message.trim() || DEFAULT_MEME_AGENT_BANNER.message,
    titleColor: normalizeTitleColor(row.titleColor),
    titleSize: normalizeTitleSize(row.titleSize),
    titleFont: normalizeTitleFont(row.titleFont),
  };
}

function rowToAdmin(row: MemeAgentBannerRow, usesDefault: boolean): MemeAgentBannerAdmin {
  const normalized = normalizeRow(row);
  return {
    ...normalized,
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
    title: (patch.title ?? current.title).trim() || DEFAULT_MEME_AGENT_BANNER.title,
    message: (patch.message ?? current.message).trim() || DEFAULT_MEME_AGENT_BANNER.message,
    titleColor: patch.titleColor !== undefined ? normalizeTitleColor(patch.titleColor) : current.titleColor,
    titleSize: patch.titleSize !== undefined ? normalizeTitleSize(patch.titleSize) : current.titleSize,
    titleFont: patch.titleFont !== undefined ? normalizeTitleFont(patch.titleFont) : current.titleFont,
  };
  await bannerDb.upsert({
    where: { id: MEME_AGENT_BANNER_ID },
    create: {
      id: MEME_AGENT_BANNER_ID,
      enabled: next.enabled,
      title: next.title,
      message: next.message,
      titleColor: next.titleColor,
      titleSize: next.titleSize,
      titleFont: next.titleFont,
    },
    update: {
      enabled: next.enabled,
      title: next.title,
      message: next.message,
      titleColor: next.titleColor,
      titleSize: next.titleSize,
      titleFont: next.titleFont,
    },
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

export const MEME_AGENT_TITLE_SIZE_OPTIONS: { value: MemeAgentTitleSize; label: string }[] = [
  { value: "lg", label: "Small" },
  { value: "xl", label: "Medium" },
  { value: "2xl", label: "Large (default)" },
  { value: "3xl", label: "Extra large" },
];

export const MEME_AGENT_TITLE_FONT_OPTIONS: { value: MemeAgentTitleFont; label: string }[] = [
  { value: "display", label: "Space Grotesk (display)" },
  { value: "sans", label: "Geist (site default)" },
];
