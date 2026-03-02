import { prisma } from "@/lib/db";

function getMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Record one AI analysis for the current month (call after successful analysis). */
export async function recordAiAnalysis(userId: string): Promise<void> {
  const monthKey = getMonthKey();
  await prisma.usageThisMonth.upsert({
    where: {
      userId_monthKey: { userId, monthKey },
    },
    create: { userId, monthKey, aiAnalyses: 1 },
    update: { aiAnalyses: { increment: 1 } },
  });
}

/** Get usage counts for the current month: AI analyses (from UsageThisMonth) and alerts (UserMemeCoinAlert + LeverageAlert this month). */
export async function getUsageThisMonth(userId: string): Promise<{ aiAnalyses: number; alerts: number }> {
  const monthKey = getMonthKey();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [row, memeAlerts, leverageAlerts] = await Promise.all([
    prisma.usageThisMonth.findUnique({
      where: { userId_monthKey: { userId, monthKey } },
      select: { aiAnalyses: true },
    }),
    prisma.userMemeCoinAlert.count({
      where: { userId, createdAt: { gte: startOfMonth } },
    }),
    prisma.leverageAlert.count({
      where: { userId, createdAt: { gte: startOfMonth } },
    }),
  ]);

  const aiAnalyses = row?.aiAnalyses ?? 0;
  const alerts = memeAlerts + leverageAlerts;
  return { aiAnalyses, alerts };
}

export type UsageReportUser = {
  userId: string;
  email: string | null;
  name: string | null;
  aiAnalyses: number;
  alerts: number;
};

export type UsageReport = {
  monthKey: string;
  startOfMonth: string;
  totalAiAnalyses: number;
  totalAlerts: number;
  users: UsageReportUser[];
};

/** Admin-only: usage report for all users for the current month. */
export async function getUsageReportForAdmin(): Promise<UsageReport> {
  const monthKey = getMonthKey();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [usageRows, memeByUser, leverageByUser] = await Promise.all([
    prisma.usageThisMonth.findMany({
      where: { monthKey },
      select: { userId: true, aiAnalyses: true, user: { select: { email: true, name: true } } },
    }),
    prisma.userMemeCoinAlert.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
    }),
    prisma.leverageAlert.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: startOfMonth }, userId: { not: null } },
      _count: { id: true },
    }),
  ]);

  const alertCountByUser = new Map<string, number>();
  for (const g of memeByUser) {
    alertCountByUser.set(g.userId, (alertCountByUser.get(g.userId) ?? 0) + g._count.id);
  }
  for (const g of leverageByUser) {
    if (g.userId) alertCountByUser.set(g.userId, (alertCountByUser.get(g.userId) ?? 0) + g._count.id);
  }

  const userMap = new Map<string, UsageReportUser>();
  for (const row of usageRows) {
    const alerts = alertCountByUser.get(row.userId) ?? 0;
    userMap.set(row.userId, {
      userId: row.userId,
      email: row.user.email ?? null,
      name: row.user.name ?? null,
      aiAnalyses: row.aiAnalyses,
      alerts,
    });
  }
  const userIdsWithAlerts = new Set([
    ...memeByUser.map((g) => g.userId),
    ...leverageByUser.filter((g) => g.userId).map((g) => g.userId!),
  ]);
  for (const userId of userIdsWithAlerts) {
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        email: null,
        name: null,
        aiAnalyses: 0,
        alerts: alertCountByUser.get(userId) ?? 0,
      });
    }
  }

  const users = Array.from(userMap.values()).sort((a, b) => b.aiAnalyses + b.alerts - (a.aiAnalyses + a.alerts));
  const totalAiAnalyses = users.reduce((s, u) => s + u.aiAnalyses, 0);
  const totalAlerts = users.reduce((s, u) => s + u.alerts, 0);

  return {
    monthKey,
    startOfMonth: startOfMonth.toISOString(),
    totalAiAnalyses,
    totalAlerts,
    users,
  };
}
