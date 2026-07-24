import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { jobAgentDb as prisma } from "@/lib/nova-job-agent/db";

export const dynamic = "force-dynamic";

/** Owner metrics: Nova Jobs Agent application volume. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
  }

  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 7);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [byStatus, appliedToday, appliedWeek, appliedMonth, preparedTotal, usersWithApps, topUsers] =
      await Promise.all([
        prisma.jobAgentApplication.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.jobAgentApplication.count({
          where: { status: "applied", createdAt: { gte: startOfDay } },
        }),
        prisma.jobAgentApplication.count({
          where: { status: "applied", createdAt: { gte: startOfWeek } },
        }),
        prisma.jobAgentApplication.count({
          where: { status: "applied", createdAt: { gte: startOfMonth } },
        }),
        prisma.jobAgentApplication.count({ where: { status: "prepared" } }),
        prisma.jobAgentApplication.groupBy({
          by: ["userId"],
          _count: { _all: true },
        }),
        prisma.jobAgentApplication.groupBy({
          by: ["userId"],
          where: { status: { in: ["applied", "prepared"] } },
          _count: { _all: true },
        }),
      ]);

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const row of byStatus as Array<{ status: string; _count: { _all: number } }>) {
      statusCounts[row.status] = row._count._all;
      total += row._count._all;
    }

    const ranked = (topUsers as Array<{ userId: string; _count: { _all: number } }>)
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 15);
    const topIds = ranked.map((r) => r.userId);
    const users =
      topIds.length === 0
        ? []
        : await (
            prisma as unknown as {
              user: {
                findMany: (args: unknown) => Promise<
                  Array<{ id: string; email: string | null; name: string | null }>
                >;
              };
            }
          ).user.findMany({
            where: { id: { in: topIds } },
            select: { id: true, email: true, name: true },
          });
    const userById = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      success: true,
      totals: {
        all: total,
        applied: statusCounts.applied ?? 0,
        prepared: statusCounts.prepared ?? preparedTotal,
        queued: statusCounts.queued ?? 0,
        failed: statusCounts.failed ?? 0,
        skipped: statusCounts.skipped ?? 0,
      },
      applied: {
        today: appliedToday,
        last7Days: appliedWeek,
        thisMonth: appliedMonth,
      },
      activeUsers: (usersWithApps as Array<{ userId: string }>).length,
      topUsers: ranked.map((r) => {
        const u = userById.get(r.userId);
        return {
          userId: r.userId,
          email: u?.email ?? null,
          name: u?.name ?? null,
          applications: r._count._all,
        };
      }),
    });
  } catch (e) {
    console.error("Jobs Agent metrics:", e);
    return NextResponse.json({ success: false, error: "Failed to load Jobs Agent metrics." }, { status: 500 });
  }
}
