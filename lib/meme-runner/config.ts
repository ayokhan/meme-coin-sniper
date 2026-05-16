import { prisma } from "@/lib/db";
import {
  defaultMemeRunnerConfig,
  parseMemeRunnerConfig,
  parseMemeRunnerSolConfig,
} from "@/lib/meme-runner/defaults";
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

async function loadConfig(chain: MemeRunnerChain): Promise<MemeRunnerSolConfig> {
  const fallback = defaultMemeRunnerConfig(chain);
  try {
    const db = prisma as unknown as PrismaWithMemeRunner;
    if (!db.memeRunnerSettings) return { ...fallback };
    const row = await db.memeRunnerSettings.findUnique({ where: { chain } });
    if (!row?.config) return { ...fallback };
    return parseMemeRunnerConfig(chain, row.config);
  } catch {
    return { ...fallback };
  }
}

async function saveConfig(chain: MemeRunnerChain, config: MemeRunnerSolConfig): Promise<MemeRunnerSolConfig> {
  const parsed = parseMemeRunnerConfig(chain, config);
  const db = prisma as unknown as PrismaWithMemeRunner;
  if (!db.memeRunnerSettings) return parsed;
  await db.memeRunnerSettings.upsert({
    where: { chain },
    create: { chain, config: parsed },
    update: { config: parsed },
  });
  return parsed;
}

export async function getMemeRunnerConfig(chain: MemeRunnerChain): Promise<MemeRunnerSolConfig> {
  return loadConfig(chain);
}

export async function saveMemeRunnerConfig(
  chain: MemeRunnerChain,
  config: MemeRunnerSolConfig
): Promise<MemeRunnerSolConfig> {
  return saveConfig(chain, config);
}

/** @deprecated use getMemeRunnerConfig('sol') */
export async function getMemeRunnerSolConfig(): Promise<MemeRunnerSolConfig> {
  return getMemeRunnerConfig("sol");
}

/** @deprecated use saveMemeRunnerConfig('sol', config) */
export async function saveMemeRunnerSolConfig(config: MemeRunnerSolConfig): Promise<MemeRunnerSolConfig> {
  return saveMemeRunnerConfig("sol", config);
}

export async function getMemeRunnerConfigForChain(chain: MemeRunnerChain): Promise<MemeRunnerSolConfig> {
  return getMemeRunnerConfig(chain);
}
