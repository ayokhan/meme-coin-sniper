import { isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { recordAiAnalysis } from "@/lib/usage";

export type AiAgentFeature = "meme_agent" | "chart_analysis";

const FEATURE_FLAG_BY_TYPE: Record<AiAgentFeature, string> = {
  meme_agent: FEATURE_FLAG_KEYS.NOVA_AI_AGENT_MEME,
  chart_analysis: FEATURE_FLAG_KEYS.NOVA_AI_AGENT_CHART,
};

const FEATURE_LABEL: Record<AiAgentFeature, string> = {
  meme_agent: "Meme Coins Agent (Solana + BSC)",
  chart_analysis: "NovaStaris AI Chart Analysis",
};

function getDayBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getGlobalAiAgentQuotas(): Promise<{
  memeAgentFreeDailyLimit: number;
  chartAnalysisFreeDailyLimit: number;
}> {
  const row = await prisma.aiAgentQuotaConfig.findUnique({ where: { id: "default" } });

  return {
    memeAgentFreeDailyLimit: row?.memeAgentFreeDailyLimit ?? 2,
    chartAnalysisFreeDailyLimit: row?.chartAnalysisFreeDailyLimit ?? 2,
  };
}

export async function setGlobalAiAgentQuotas(input: {
  memeAgentFreeDailyLimit: number;
  chartAnalysisFreeDailyLimit: number;
}): Promise<void> {
  const meme = Math.max(0, Math.min(1000, Math.round(input.memeAgentFreeDailyLimit)));
  const chart = Math.max(0, Math.min(1000, Math.round(input.chartAnalysisFreeDailyLimit)));
  await prisma.aiAgentQuotaConfig.upsert({
    where: { id: "default" },
    create: { id: "default", memeAgentFreeDailyLimit: meme, chartAnalysisFreeDailyLimit: chart },
    update: { memeAgentFreeDailyLimit: meme, chartAnalysisFreeDailyLimit: chart },
  });
}

async function getUserLimitOverride(
  userId: string,
  feature: AiAgentFeature
): Promise<number | null> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
  })) as {
    aiAgentDailyLimitOverride?: number | null;
    aiChartAnalysisDailyLimitOverride?: number | null;
  } | null;
  if (!user) return null;
  const val =
    feature === "meme_agent"
      ? user.aiAgentDailyLimitOverride
      : user.aiChartAnalysisDailyLimitOverride;
  return typeof val === "number" && Number.isFinite(val) ? Math.max(0, Math.round(val)) : null;
}

export async function resolveDailyLimit(userId: string, feature: AiAgentFeature): Promise<number> {
  const override = await getUserLimitOverride(userId, feature);
  if (override != null) return override;
  const global = await getGlobalAiAgentQuotas();
  return feature === "meme_agent" ? global.memeAgentFreeDailyLimit : global.chartAnalysisFreeDailyLimit;
}

export async function getDailyUsageCount(userId: string, feature: AiAgentFeature): Promise<number> {
  const { start, end } = getDayBounds();
  return prisma.usageAnalysisEvent.count({
    where: {
      userId,
      source: feature,
      createdAt: { gte: start, lt: end },
    },
  });
}

export type AiAgentUsageSnapshot = {
  feature: AiAgentFeature;
  label: string;
  enabled: boolean;
  unlimited: boolean;
  used: number;
  limit: number;
  remaining: number;
};

export async function getAiAgentUsageForUser(
  session: { user?: { id?: string; isOwner?: boolean } } | null,
  isPaid: boolean
): Promise<{
  authenticated: boolean;
  memeAgent: AiAgentUsageSnapshot;
  chartAnalysis: AiAgentUsageSnapshot;
}> {
  const userId = session?.user?.id;
  const unlimited = isPaid || isOwnerSession(session as Parameters<typeof isOwnerSession>[0]);
  const [memeEnabled, chartEnabled, global] = await Promise.all([
    getFeatureFlag(FEATURE_FLAG_BY_TYPE.meme_agent),
    getFeatureFlag(FEATURE_FLAG_BY_TYPE.chart_analysis),
    getGlobalAiAgentQuotas(),
  ]);

  const build = async (feature: AiAgentFeature, enabled: boolean): Promise<AiAgentUsageSnapshot> => {
    const label = FEATURE_LABEL[feature];
    if (!userId) {
      const limit =
        feature === "meme_agent" ? global.memeAgentFreeDailyLimit : global.chartAnalysisFreeDailyLimit;
      return { feature, label, enabled, unlimited: false, used: 0, limit, remaining: limit };
    }
    const limit = await resolveDailyLimit(userId, feature);
    const used = await getDailyUsageCount(userId, feature);
    const isUnlimited = unlimited;
    return {
      feature,
      label,
      enabled,
      unlimited: isUnlimited,
      used,
      limit: isUnlimited ? -1 : limit,
      remaining: isUnlimited ? -1 : Math.max(0, limit - used),
    };
  };

  return {
    authenticated: !!userId,
    memeAgent: await build("meme_agent", memeEnabled),
    chartAnalysis: await build("chart_analysis", chartEnabled),
  };
}

export type AiAgentAccessResult =
  | { ok: true; unlimited: boolean }
  | {
      ok: false;
      status: number;
      error: string;
      locked?: boolean;
      limitReached?: boolean;
      used?: number;
      limit?: number;
    };

export async function assertAiAgentAccess(
  session: { user?: { id?: string; isOwner?: boolean } } | null,
  isPaid: boolean,
  feature: AiAgentFeature
): Promise<AiAgentAccessResult> {
  const enabled = await getFeatureFlag(FEATURE_FLAG_BY_TYPE[feature]);
  if (!enabled) {
    return {
      ok: false,
      status: 503,
      error: `${FEATURE_LABEL[feature]} is temporarily unavailable.`,
    };
  }

  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      status: 401,
      error: "Sign in or register to use NovaStaris AI Agent.",
      locked: true,
    };
  }

  if (isPaid || isOwnerSession(session as Parameters<typeof isOwnerSession>[0])) {
    return { ok: true, unlimited: true };
  }

  const limit = await resolveDailyLimit(userId, feature);
  const used = await getDailyUsageCount(userId, feature);
  if (used >= limit) {
    const limitMsg =
      feature === "meme_agent"
        ? `Daily limit reached (${limit} Meme Coins Agent uses per day on the free plan — Solana and BSC combined). Upgrade to VIP for unlimited access.`
        : `Daily limit reached (${limit} Chart Analysis uses per day on the free plan). Upgrade to VIP for unlimited Chart Analysis.`;
    return {
      ok: false,
      status: 429,
      error: limitMsg,
      locked: true,
      limitReached: true,
      used,
      limit,
    };
  }

  return { ok: true, unlimited: false };
}

export async function recordAiAgentUsage(userId: string, feature: AiAgentFeature): Promise<void> {
  await recordAiAnalysis(userId, feature);
}
