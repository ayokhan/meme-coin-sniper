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
