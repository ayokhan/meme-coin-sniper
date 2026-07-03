import { prisma } from "@/lib/db";
import { getGlobalAiAgentQuotas, getUserQuotaOverrides, resolveLimit } from "@/lib/ai-agent-quota";

const AI_SOURCES = ["meme_agent", "chart_analysis"] as const;

function getDayKey(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export type AiAgentFunnelStats = {
  periodDays: number;
  periodStart: string;
  registered: number;
  activated: number;
  limited: number;
  subscribed: number;
  activatedPct: number;
  limitedPct: number;
  subscribedPct: number;
  /** Among activated free users who hit quota at least once */
  limitedOfActivatedPct: number;
};

export async function getAiAgentFunnelStats(periodDays = 30): Promise<AiAgentFunnelStats> {
  const days = Math.max(1, Math.min(365, Math.round(periodDays)));
  const periodStart = new Date();
  periodStart.setUTCHours(0, 0, 0, 0);
  periodStart.setUTCDate(periodStart.getUTCDate() - (days - 1));

  const users = (await (prisma as unknown as {
    user: { findMany: (args: { where: { createdAt: { gte: Date } } }) => Promise<Array<{ id: string; createdAt: Date }>> };
  }).user.findMany({
    where: { createdAt: { gte: periodStart } },
  }));

  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    return {
      periodDays: days,
      periodStart: periodStart.toISOString(),
      registered: 0,
      activated: 0,
      limited: 0,
      subscribed: 0,
      activatedPct: 0,
      limitedPct: 0,
      subscribedPct: 0,
      limitedOfActivatedPct: 0,
    };
  }

  const now = new Date();
  const [events, activeSubs, global] = await Promise.all([
    (prisma as unknown as {
      usageAnalysisEvent: {
        findMany: (args: unknown) => Promise<Array<{ userId: string; source: string; createdAt: Date }>>;
      };
    }).usageAnalysisEvent.findMany({
      where: {
        userId: { in: userIds },
        source: { in: [...AI_SOURCES] },
      },
      select: { userId: true, source: true, createdAt: true },
    }),
    (prisma as unknown as {
      subscription: {
        findMany: (args: unknown) => Promise<Array<{ userId: string }>>;
      };
    }).subscription.findMany({
      where: { userId: { in: userIds }, expiresAt: { gt: now } },
      select: { userId: true },
    }),
    getGlobalAiAgentQuotas(),
  ]);

  const activeSubUserIds = new Set(activeSubs.map((s) => s.userId as string));
  const activatedUserIds = new Set<string>();
  const dailyCountsByUser = new Map<string, Map<string, number>>();

  for (const ev of events) {
    activatedUserIds.add(ev.userId);
    const day = getDayKey(ev.createdAt);
    if (!dailyCountsByUser.has(ev.userId)) dailyCountsByUser.set(ev.userId, new Map());
    const byDay = dailyCountsByUser.get(ev.userId)!;
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const limitedUserIds = new Set<string>();
  for (const userId of activatedUserIds) {
    if (activeSubUserIds.has(userId)) continue;
    const overrides = await getUserQuotaOverrides(userId);
    const dailyLimit = resolveLimit(global, overrides, "meme_agent", "daily")!;
    const byDay = dailyCountsByUser.get(userId);
    if (!byDay) continue;
    for (const count of byDay.values()) {
      if (count >= dailyLimit) {
        limitedUserIds.add(userId);
        break;
      }
    }
  }

  const registered = users.length;
  const activated = activatedUserIds.size;
  const limited = limitedUserIds.size;
  const subscribed = activeSubUserIds.size;

  const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  return {
    periodDays: days,
    periodStart: periodStart.toISOString(),
    registered,
    activated,
    limited,
    subscribed,
    activatedPct: pct(activated, registered),
    limitedPct: pct(limited, registered),
    subscribedPct: pct(subscribed, registered),
    limitedOfActivatedPct: pct(limited, activated),
  };
}
