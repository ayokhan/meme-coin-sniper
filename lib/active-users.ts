import { prisma } from "@/lib/db";
import { formatAnalyticsPathLabel } from "@/lib/analytics-insights";

const ONLINE_MS = 5 * 60 * 1000;
const RECENT_MS = 30 * 60 * 1000;

export type ActiveUserStatus = "online" | "recent";

export type ActiveUserRow = {
  userId: string;
  email: string | null;
  name: string | null;
  lastSeenAt: string;
  lastPath: string;
  lastPathLabel: string;
  deviceType: string | null;
  status: ActiveUserStatus;
  minutesAgo: number;
};

export type ActiveUsersSnapshot = {
  onlineCount: number;
  recentCount: number;
  users: ActiveUserRow[];
  windowMinutes: number;
};

type AnalyticsRow = {
  userId: string | null;
  path: string;
  createdAt: Date;
  deviceType: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  novaConnectDisplayName?: string | null;
};

export async function getActiveUsersForOwner(): Promise<ActiveUsersSnapshot> {
  const since = new Date(Date.now() - RECENT_MS);
  const events = (await (prisma as unknown as {
    analyticsEvent: {
      findMany: (args: {
        where: { userId: { not: null }; createdAt: { gte: Date } };
        orderBy: { createdAt: "desc" };
        select: { userId: true; path: true; createdAt: true; deviceType: true };
        take: number;
      }) => Promise<AnalyticsRow[]>;
    };
  }).analyticsEvent.findMany({
    where: { userId: { not: null }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, path: true, createdAt: true, deviceType: true },
    take: 8000,
  })) as AnalyticsRow[];

  const latestByUser = new Map<
    string,
    { lastSeenAt: Date; lastPath: string; deviceType: string | null }
  >();
  for (const e of events) {
    if (!e.userId || latestByUser.has(e.userId)) continue;
    latestByUser.set(e.userId, {
      lastSeenAt: e.createdAt,
      lastPath: e.path,
      deviceType: e.deviceType,
    });
  }

  const userIds = [...latestByUser.keys()];
  if (userIds.length === 0) {
    return { onlineCount: 0, recentCount: 0, users: [], windowMinutes: RECENT_MS / 60000 };
  }

  const users = (await (prisma as unknown as {
    user: {
      findMany: (args: {
        where: { id: { in: string[] } };
        select: { id: true; email: true; name: true; novaConnectDisplayName: true };
      }) => Promise<UserRow[]>;
    };
  }).user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true, novaConnectDisplayName: true },
  })) as UserRow[];

  const now = Date.now();
  const rows: ActiveUserRow[] = users.map((u) => {
    const activity = latestByUser.get(u.id)!;
    const ageMs = now - activity.lastSeenAt.getTime();
    const status: ActiveUserStatus = ageMs < ONLINE_MS ? "online" : "recent";
    return {
      userId: u.id,
      email: u.email,
      name: u.novaConnectDisplayName ?? u.name,
      lastSeenAt: activity.lastSeenAt.toISOString(),
      lastPath: activity.lastPath,
      lastPathLabel: formatAnalyticsPathLabel(activity.lastPath),
      deviceType: activity.deviceType,
      status,
      minutesAgo: Math.max(0, Math.floor(ageMs / 60000)),
    };
  });

  rows.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  return {
    onlineCount: rows.filter((r) => r.status === "online").length,
    recentCount: rows.filter((r) => r.status === "recent").length,
    users: rows,
    windowMinutes: RECENT_MS / 60000,
  };
}
