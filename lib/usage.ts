import { prisma } from "@/lib/db";

export type UsageReportPeriod = "month" | "day";

export type UsageReportQuery = {
  period?: UsageReportPeriod;
  month?: string;
  day?: string;
};

function getMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getDayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolvePeriodRange(query: UsageReportQuery = {}): {
  period: UsageReportPeriod;
  periodKey: string;
  start: Date;
  end: Date;
} {
  const period: UsageReportPeriod = query.period === "day" ? "day" : "month";
  const now = new Date();

  if (period === "day") {
    const periodKey =
      query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) ? query.day : getDayKey(now);
    const [y, m, d] = periodKey.split("-").map((n) => parseInt(n, 10));
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    return { period, periodKey, start, end };
  }

  const periodKey =
    query.month && /^\d{4}-\d{2}$/.test(query.month) ? query.month : getMonthKey(now);
  const [y, m] = periodKey.split("-").map((n) => parseInt(n, 10));
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { period, periodKey, start, end };
}

export function formatUsagePeriodLabel(period: UsageReportPeriod, periodKey: string): string {
  if (period === "day") {
    const [y, m, d] = periodKey.split("-").map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  const [y, m] = periodKey.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

/** Record one AI analysis for the current month (call after successful analysis). */
export async function recordAiAnalysis(userId: string, source?: string): Promise<void> {
  const monthKey = getMonthKey();
  const db = prisma as typeof prisma & {
    usageAnalysisEvent: {
      create: (args: { data: { userId: string; source?: string | null } }) => Promise<unknown>;
    };
  };
  await Promise.all([
    prisma.usageThisMonth.upsert({
      where: {
        userId_monthKey: { userId, monthKey },
      },
      create: { userId, monthKey, aiAnalyses: 1 },
      update: { aiAnalyses: { increment: 1 } },
    }),
    db.usageAnalysisEvent.create({
      data: { userId, source: source ?? null },
    }),
  ]);
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
  period: UsageReportPeriod;
  periodKey: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  /** @deprecated use periodKey when period is month */
  monthKey: string;
  /** @deprecated use periodStart */
  startOfMonth: string;
  dailyAiTrackingNote: string | null;
  totalUsers: number;
  usersWithActivity: number;
  totalAiAnalyses: number;
  totalAlerts: number;
  users: UsageReportUser[];
};

/** Admin-only: usage report for all registered users for a selected day or month. */
export async function getUsageReportForAdmin(query: UsageReportQuery = {}): Promise<UsageReport> {
  const { period, periodKey, start, end } = resolvePeriodRange(query);
  const now = new Date();
  const dateFilter = { gte: start, lt: end };

  const db = prisma as typeof prisma & {
    usageAnalysisEvent: {
      groupBy: (args: {
        by: ["userId"];
        where?: { createdAt: { gte: Date; lt: Date } };
        _count: { id: true };
      }) => Promise<Array<{ userId: string; _count: { id: number } }>>;
      findFirst: (args: {
        orderBy: { createdAt: "asc" | "desc" };
        select: { createdAt: true };
      }) => Promise<{ createdAt: Date } | null>;
    };
  };

  const [allUsersRaw, usageRows, aiEventsByUser, memeByUser, leverageByUser, activeSubsRaw, firstAiEvent] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
      }),
      period === "month"
        ? (prisma.usageThisMonth.findMany({
            where: { monthKey: periodKey },
          }) as Promise<Array<{ userId: string; aiAnalyses: number }>>)
        : Promise.resolve([] as Array<{ userId: string; aiAnalyses: number }>),
      period === "day"
        ? db.usageAnalysisEvent.groupBy({
            by: ["userId"],
            where: { createdAt: dateFilter },
            _count: { id: true },
          })
        : Promise.resolve([] as Array<{ userId: string; _count: { id: number } }>),
      prisma.userMemeCoinAlert.groupBy({
        by: ["userId"],
        where: { createdAt: dateFilter },
        _count: { id: true },
      }),
      prisma.leverageAlert.groupBy({
        by: ["userId"],
        where: { createdAt: dateFilter, userId: { not: null } },
        _count: { id: true },
      }),
      prisma.subscription.findMany({
        where: { expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
      }),
      period === "day"
        ? db.usageAnalysisEvent.findFirst({
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
          })
        : Promise.resolve(null),
    ]);

  const allUsers = allUsersRaw.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    name: u.name ?? null,
  }));
  const activeSubs = activeSubsRaw as Array<{ userId: string; tier?: string | null }>;

  const aiByUser = new Map<string, number>();
  if (period === "month") {
    for (const row of usageRows) aiByUser.set(row.userId, row.aiAnalyses);
  } else {
    for (const g of aiEventsByUser) aiByUser.set(g.userId, g._count.id);
  }

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
    const labelB = (b.email ?? b.name ?? b.userId).toLowerCase();
    return labelA.localeCompare(labelB);
  });

  const usersWithActivity = users.filter((u) => u.aiAnalyses > 0 || u.alerts > 0).length;
  const totalAiAnalyses = users.reduce((s, u) => s + u.aiAnalyses, 0);
  const totalAlerts = users.reduce((s, u) => s + u.alerts, 0);

  let dailyAiTrackingNote: string | null = null;
  if (period === "day" && firstAiEvent?.createdAt && start < firstAiEvent.createdAt) {
    dailyAiTrackingNote =
      "Daily AI analysis counts are logged per run from " +
      firstAiEvent.createdAt.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }) +
      ". Use Monthly for full AI totals before that.";
  } else if (period === "day") {
    dailyAiTrackingNote =
      "Daily view: AI analyses are counted per run on the selected day. Alerts are meme-coin + leverage wallet alerts created that day.";
  }

  return {
    period,
    periodKey,
    periodLabel: formatUsagePeriodLabel(period, periodKey),
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    monthKey: period === "month" ? periodKey : getMonthKey(start),
    startOfMonth: start.toISOString(),
    dailyAiTrackingNote,
    totalUsers: users.length,
    usersWithActivity,
    totalAiAnalyses,
    totalAlerts,
    users,
  };
}
