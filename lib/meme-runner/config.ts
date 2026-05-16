import { prisma } from "@/lib/db";
import { DEFAULT_MEME_RUNNER_SOL_CONFIG, parseMemeRunnerSolConfig } from "@/lib/meme-runner/defaults";
import type { MemeRunnerChain, MemeRunnerSolConfig } from "@/lib/meme-runner/types";

type PrismaWithMemeRunner = typeof prisma & {
  memeRunnerSettings?: {
    findUnique: (args: { where: { chain: string } }) => Promise<{ config: unknown } | null>;
    upsert: (args: {
      where: { chain: string };
      create: { chain: string; config: unknown };
      update: { config: unknown };
    }) => Promise<unknown>;
  };
};

export async function getMemeRunnerSolConfig(): Promise<MemeRunnerSolConfig> {
  try {
    const db = prisma as unknown as PrismaWithMemeRunner;
    if (!db.memeRunnerSettings) return { ...DEFAULT_MEME_RUNNER_SOL_CONFIG };
    const row = await db.memeRunnerSettings.findUnique({ where: { chain: "sol" } });
    if (!row?.config) return { ...DEFAULT_MEME_RUNNER_SOL_CONFIG };
    return parseMemeRunnerSolConfig(row.config);
  } catch {
    return { ...DEFAULT_MEME_RUNNER_SOL_CONFIG };
  }
}

export async function saveMemeRunnerSolConfig(config: MemeRunnerSolConfig): Promise<MemeRunnerSolConfig> {
  const parsed = parseMemeRunnerSolConfig(config);
  const db = prisma as unknown as PrismaWithMemeRunner;
  if (!db.memeRunnerSettings) return parsed;
  await db.memeRunnerSettings.upsert({
    where: { chain: "sol" },
    create: { chain: "sol", config: parsed },
    update: { config: parsed },
  });
  return parsed;
}

export async function getMemeRunnerConfigForChain(chain: MemeRunnerChain): Promise<MemeRunnerSolConfig | null> {
  if (chain === "sol") return getMemeRunnerSolConfig();
  return null;
}
