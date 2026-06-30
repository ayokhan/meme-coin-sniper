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
  subscriptionTier: string | null;
  aiAnalyses: number;
  alerts: number;
};

export type UsageReport = {
  monthKey: string;
  startOfMonth: string;
  totalUsers: number;
  usersWithActivity: number;
  totalAiAnalyses: number;
  totalAlerts: number;
  users: UsageReportUser[];
};

/** Admin-only: usage report for all registered users for the current month. */
export async function getUsageReportForAdmin(): Promise<UsageReport> {
  const monthKey = getMonthKey();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const now = new Date();

  const [allUsersRaw, usageRows, memeByUser, leverageByUser, activeSubsRaw] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    }),
    prisma.usageThisMonth.findMany({
      where: { monthKey },
    }) as Promise<Array<{ userId: string; aiAnalyses: number }>>,
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
    prisma.subscription.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { expiresAt: "desc" },
    }),
  ]);

  const allUsers = allUsersRaw.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    name: u.name ?? null,
  }));
  const activeSubs = activeSubsRaw as Array<{ userId: string; tier?: string | null }>;

  const aiByUser = new Map(usageRows.map((r) => [r.userId, r.aiAnalyses]));
  const alertCountByUser = new Map<string, number>();
  for (const g of memeByUser) {
    alertCountByUser.set(g.userId, (alertCountByUser.get(g.userId) ?? 0) + g._count.id);
  }
  for (const g of leverageByUser) {
    if (g.userId) alertCountByUser.set(g.userId, (alertCountByUser.get(g.userId) ?? 0) + g._count.id);
  }

  const tierByUser = new Map<string, string>();
  for (const sub of activeSubs) {
    if (!tierByUser.has(sub.userId)) tierByUser.set(sub.userId, sub.tier ?? "pro");
  }

  const users: UsageReportUser[] = allUsers.map((user) => {
    const aiAnalyses = aiByUser.get(user.id) ?? 0;
    const alerts = alertCountByUser.get(user.id) ?? 0;
    return {
      userId: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      subscriptionTier: tierByUser.get(user.id) ?? null,
      aiAnalyses,
      alerts,
    };
  });

  users.sort((a, b) => {
    const activityA = a.aiAnalyses + a.alerts;
    const activityB = b.aiAnalyses + b.alerts;
    if (activityB !== activityA) return activityB - activityA;
    const labelA = (a.email ?? a.name ?? a.userId).toLowerCase();
    const labelB = (b.email ?? b.name ?? a.userId).toLowerCase();
    return labelA.localeCompare(labelB);
  });

  const usersWithActivity = users.filter((u) => u.aiAnalyses > 0 || u.alerts > 0).length;
  const totalAiAnalyses = users.reduce((s, u) => s + u.aiAnalyses, 0);
  const totalAlerts = users.reduce((s, u) => s + u.alerts, 0);

  return {
    monthKey,
    startOfMonth: startOfMonth.toISOString(),
    totalUsers: users.length,
    usersWithActivity,
    totalAiAnalyses,
    totalAlerts,
    users,
  };
}
