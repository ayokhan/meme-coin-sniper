import { isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { recordAiAnalysis } from "@/lib/usage";

export type AiAgentFeature = "meme_agent" | "chart_analysis";
export type QuotaWindow = "daily" | "weekly" | "monthly";

const FEATURE_FLAG_BY_TYPE: Record<AiAgentFeature, string> = {
  meme_agent: FEATURE_FLAG_KEYS.NOVA_AI_AGENT_MEME,
  chart_analysis: FEATURE_FLAG_KEYS.NOVA_AI_AGENT_CHART,
};

const FEATURE_LABEL: Record<AiAgentFeature, string> = {
  meme_agent: "Meme Coins Agent (Solana + BSC)",
  chart_analysis: "NovaStaris AI Chart Analysis",
};

export type GlobalAiAgentQuotas = {
  memeAgentFreeDailyLimit: number;
  memeAgentFreeWeeklyLimit: number | null;
  memeAgentFreeMonthlyLimit: number | null;
  chartAnalysisFreeDailyLimit: number;
  chartAnalysisFreeWeeklyLimit: number | null;
  chartAnalysisFreeMonthlyLimit: number | null;
};

type QuotaConfigRow = {
  memeAgentFreeDailyLimit?: number;
  memeAgentFreeWeeklyLimit?: number | null;
  memeAgentFreeMonthlyLimit?: number | null;
  chartAnalysisFreeDailyLimit?: number;
  chartAnalysisFreeWeeklyLimit?: number | null;
  chartAnalysisFreeMonthlyLimit?: number | null;
};

function clampLimit(n: number): number {
  return Math.max(0, Math.min(1000, Math.round(n)));
}

function normalizeOptionalLimit(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return clampLimit(n);
}

function getDayBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

/** Week starts Monday 00:00 UTC (aligned with server daily reset). */
function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - diffToMonday);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}

function getMonthBounds(date: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { start, end };
}

function boundsForWindow(window: QuotaWindow, date?: Date): { start: Date; end: Date } {
  if (window === "weekly") return getWeekBounds(date);
  if (window === "monthly") return getMonthBounds(date);
  return getDayBounds(date);
}

function rowToGlobalQuotas(row: QuotaConfigRow | null): GlobalAiAgentQuotas {
  return {
    memeAgentFreeDailyLimit: row?.memeAgentFreeDailyLimit ?? 2,
    memeAgentFreeWeeklyLimit: row?.memeAgentFreeWeeklyLimit ?? null,
    memeAgentFreeMonthlyLimit: row?.memeAgentFreeMonthlyLimit ?? null,
    chartAnalysisFreeDailyLimit: row?.chartAnalysisFreeDailyLimit ?? 2,
    chartAnalysisFreeWeeklyLimit: row?.chartAnalysisFreeWeeklyLimit ?? null,
    chartAnalysisFreeMonthlyLimit: row?.chartAnalysisFreeMonthlyLimit ?? null,
  };
}

export async function getGlobalAiAgentQuotas(): Promise<GlobalAiAgentQuotas> {
  const row = await prisma.aiAgentQuotaConfig.findUnique({ where: { id: "default" } });
  return rowToGlobalQuotas(row as QuotaConfigRow | null);
}

export async function setGlobalAiAgentQuotas(input: {
  memeAgentFreeDailyLimit: number;
  memeAgentFreeWeeklyLimit?: number | null;
  memeAgentFreeMonthlyLimit?: number | null;
  chartAnalysisFreeDailyLimit: number;
  chartAnalysisFreeWeeklyLimit?: number | null;
  chartAnalysisFreeMonthlyLimit?: number | null;
}): Promise<void> {
  const memeDaily = clampLimit(input.memeAgentFreeDailyLimit);
  const chartDaily = clampLimit(input.chartAnalysisFreeDailyLimit);
  const memeWeekly =
    input.memeAgentFreeWeeklyLimit === undefined
      ? undefined
      : normalizeOptionalLimit(input.memeAgentFreeWeeklyLimit);
  const memeMonthly =
    input.memeAgentFreeMonthlyLimit === undefined
      ? undefined
      : normalizeOptionalLimit(input.memeAgentFreeMonthlyLimit);
  const chartWeekly =
    input.chartAnalysisFreeWeeklyLimit === undefined
      ? undefined
      : normalizeOptionalLimit(input.chartAnalysisFreeWeeklyLimit);
  const chartMonthly =
    input.chartAnalysisFreeMonthlyLimit === undefined
      ? undefined
      : normalizeOptionalLimit(input.chartAnalysisFreeMonthlyLimit);

  await prisma.aiAgentQuotaConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      memeAgentFreeDailyLimit: memeDaily,
      memeAgentFreeWeeklyLimit: memeWeekly ?? null,
      memeAgentFreeMonthlyLimit: memeMonthly ?? null,
      chartAnalysisFreeDailyLimit: chartDaily,
      chartAnalysisFreeWeeklyLimit: chartWeekly ?? null,
      chartAnalysisFreeMonthlyLimit: chartMonthly ?? null,
    },
    update: {
      memeAgentFreeDailyLimit: memeDaily,
      chartAnalysisFreeDailyLimit: chartDaily,
      ...(memeWeekly !== undefined ? { memeAgentFreeWeeklyLimit: memeWeekly } : {}),
      ...(memeMonthly !== undefined ? { memeAgentFreeMonthlyLimit: memeMonthly } : {}),
      ...(chartWeekly !== undefined ? { chartAnalysisFreeWeeklyLimit: chartWeekly } : {}),
      ...(chartMonthly !== undefined ? { chartAnalysisFreeMonthlyLimit: chartMonthly } : {}),
    },
  });
}


export type UserQuotaOverrides = {
  memeDaily?: number;
  memeWeekly?: number;
  memeMonthly?: number;
  chartDaily?: number;
  chartWeekly?: number;
  chartMonthly?: number;
};

type UserQuotaRow = {
  aiAgentDailyLimitOverride?: number | null;
  aiAgentWeeklyLimitOverride?: number | null;
  aiAgentMonthlyLimitOverride?: number | null;
  aiChartAnalysisDailyLimitOverride?: number | null;
  aiChartAnalysisWeeklyLimitOverride?: number | null;
  aiChartAnalysisMonthlyLimitOverride?: number | null;
};

function readOverrideField(val: number | null | undefined): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return clampLimit(val);
  return undefined;
}

export async function getUserQuotaOverrides(userId: string): Promise<UserQuotaOverrides> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
  })) as UserQuotaRow | null;
  if (!user) return {};
  return {
    memeDaily: readOverrideField(user.aiAgentDailyLimitOverride),
    memeWeekly: readOverrideField(user.aiAgentWeeklyLimitOverride),
    memeMonthly: readOverrideField(user.aiAgentMonthlyLimitOverride),
    chartDaily: readOverrideField(user.aiChartAnalysisDailyLimitOverride),
    chartWeekly: readOverrideField(user.aiChartAnalysisWeeklyLimitOverride),
    chartMonthly: readOverrideField(user.aiChartAnalysisMonthlyLimitOverride),
  };
}

function getUserOverride(
  overrides: UserQuotaOverrides | null,
  feature: AiAgentFeature,
  window: QuotaWindow
): number | undefined {
  if (!overrides) return undefined;
  const key =
    feature === "meme_agent"
      ? window === "daily"
        ? "memeDaily"
        : window === "weekly"
          ? "memeWeekly"
          : "memeMonthly"
      : window === "daily"
        ? "chartDaily"
        : window === "weekly"
          ? "chartWeekly"
          : "chartMonthly";
  return overrides[key as keyof UserQuotaOverrides];
}

export function resolveLimit(
  global: GlobalAiAgentQuotas,
  overrides: UserQuotaOverrides | null,
  feature: AiAgentFeature,
  window: QuotaWindow
): number | null {
  const userOverride = getUserOverride(overrides, feature, window);
  if (userOverride !== undefined) return userOverride;
  if (window === "daily") {
    return feature === "meme_agent" ? global.memeAgentFreeDailyLimit : global.chartAnalysisFreeDailyLimit;
  }
  return resolveWindowLimit(global, feature, window);
}

export async function resolveDailyLimit(userId: string, feature: AiAgentFeature): Promise<number> {
  const [global, overrides] = await Promise.all([
    getGlobalAiAgentQuotas(),
    getUserQuotaOverrides(userId),
  ]);
  return resolveLimit(global, overrides, feature, "daily")!;
}

function resolveWindowLimit(
  global: GlobalAiAgentQuotas,
  feature: AiAgentFeature,
  window: QuotaWindow
): number | null {
  if (window === "daily") return null;
  if (feature === "meme_agent") {
    return window === "weekly" ? global.memeAgentFreeWeeklyLimit : global.memeAgentFreeMonthlyLimit;
  }
  return window === "weekly" ? global.chartAnalysisFreeWeeklyLimit : global.chartAnalysisFreeMonthlyLimit;
}

export async function getUsageCount(
  userId: string,
  feature: AiAgentFeature,
  window: QuotaWindow
): Promise<number> {
  const { start, end } = boundsForWindow(window);
  return prisma.usageAnalysisEvent.count({
    where: {
      userId,
      source: feature,
      createdAt: { gte: start, lt: end },
    },
  });
}

export type QuotaWindowSnapshot = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

function buildWindowSnapshot(used: number, limit: number | null): QuotaWindowSnapshot {
  if (limit == null) return { used, limit: null, remaining: null };
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export type AiAgentUsageSnapshot = {
  feature: AiAgentFeature;
  label: string;
  enabled: boolean;
  unlimited: boolean;
  daily: QuotaWindowSnapshot;
  weekly: QuotaWindowSnapshot;
  monthly: QuotaWindowSnapshot;
  /** Longest window that currently blocks access (monthly → weekly → daily). */
  blockingWindow: QuotaWindow | null;
  canUse: boolean;
  /** Daily fields kept for backward compatibility. */
  used: number;
  limit: number;
  remaining: number;
};

type WindowCheck = {
  window: QuotaWindow;
  used: number;
  limit: number;
};

function findBlockingWindow(checks: WindowCheck[]): QuotaWindow | null {
  const order: QuotaWindow[] = ["monthly", "weekly", "daily"];
  for (const w of order) {
    const c = checks.find((x) => x.window === w);
    if (c && c.used >= c.limit) return w;
  }
  return null;
}

function limitReachedMessage(feature: AiAgentFeature, window: QuotaWindow, limit: number): string {
  const label = FEATURE_LABEL[feature];
  const upgrade = "Upgrade to VIP for unlimited access.";
  if (window === "monthly") {
    return `Monthly limit reached (${limit} free ${label} uses this month on the free plan — resets on the 1st). ${upgrade}`;
  }
  if (window === "weekly") {
    return `Weekly limit reached (${limit} free ${label} uses this week on the free plan — resets Monday UTC). ${upgrade}`;
  }
  const extra =
    feature === "meme_agent" ? " — Solana and BSC combined" : "";
  return `Daily limit reached (${limit} free ${label} uses today on the free plan${extra} — resets at midnight UTC). ${upgrade}`;
}

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
    const overrides = userId ? await getUserQuotaOverrides(userId) : null;
    const dailyLimit = resolveLimit(global, overrides, feature, "daily")!;
    const weeklyLimit = resolveLimit(global, overrides, feature, "weekly");
    const monthlyLimit = resolveLimit(global, overrides, feature, "monthly");

    if (!userId) {
      const daily = buildWindowSnapshot(0, dailyLimit);
      const weekly = buildWindowSnapshot(0, weeklyLimit);
      const monthly = buildWindowSnapshot(0, monthlyLimit);
      return {
        feature,
        label,
        enabled,
        unlimited: false,
        daily,
        weekly,
        monthly,
        blockingWindow: null,
        canUse: true,
        used: 0,
        limit: dailyLimit,
        remaining: dailyLimit,
      };
    }

    const [dailyUsed, weeklyUsed, monthlyUsed] = await Promise.all([
      getUsageCount(userId, feature, "daily"),
      getUsageCount(userId, feature, "weekly"),
      getUsageCount(userId, feature, "monthly"),
    ]);

    const daily = buildWindowSnapshot(dailyUsed, dailyLimit);
    const weekly = buildWindowSnapshot(weeklyUsed, weeklyLimit);
    const monthly = buildWindowSnapshot(monthlyUsed, monthlyLimit);

    const checks: WindowCheck[] = [{ window: "daily", used: dailyUsed, limit: dailyLimit }];
    if (weeklyLimit != null) checks.push({ window: "weekly", used: weeklyUsed, limit: weeklyLimit });
    if (monthlyLimit != null) checks.push({ window: "monthly", used: monthlyUsed, limit: monthlyLimit });

    const isUnlimited = unlimited;
    const blockingWindow = isUnlimited ? null : findBlockingWindow(checks);

    return {
      feature,
      label,
      enabled,
      unlimited: isUnlimited,
      daily,
      weekly,
      monthly,
      blockingWindow,
      canUse: isUnlimited || blockingWindow == null,
      used: dailyUsed,
      limit: isUnlimited ? -1 : dailyLimit,
      remaining: isUnlimited ? -1 : Math.max(0, dailyLimit - dailyUsed),
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
      limitWindow?: QuotaWindow;
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

  const [global, overrides] = await Promise.all([
    getGlobalAiAgentQuotas(),
    getUserQuotaOverrides(userId),
  ]);
  const dailyLimit = resolveLimit(global, overrides, feature, "daily")!;
  const weeklyLimit = resolveLimit(global, overrides, feature, "weekly");
  const monthlyLimit = resolveLimit(global, overrides, feature, "monthly");

  const [dailyUsed, weeklyUsed, monthlyUsed] = await Promise.all([
    getUsageCount(userId, feature, "daily"),
    getUsageCount(userId, feature, "weekly"),
    getUsageCount(userId, feature, "monthly"),
  ]);

  const checks: WindowCheck[] = [{ window: "daily", used: dailyUsed, limit: dailyLimit }];
  if (weeklyLimit != null) checks.push({ window: "weekly", used: weeklyUsed, limit: weeklyLimit });
  if (monthlyLimit != null) checks.push({ window: "monthly", used: monthlyUsed, limit: monthlyLimit });

  const blocking = findBlockingWindow(checks);
  if (blocking) {
    const blocked = checks.find((c) => c.window === blocking)!;
    return {
      ok: false,
      status: 429,
      error: limitReachedMessage(feature, blocking, blocked.limit),
      locked: true,
      limitReached: true,
      limitWindow: blocking,
      used: blocked.used,
      limit: blocked.limit,
    };
  }

  return { ok: true, unlimited: false };
}

export async function recordAiAgentUsage(userId: string, feature: AiAgentFeature): Promise<void> {
  await recordAiAnalysis(userId, feature);
}
