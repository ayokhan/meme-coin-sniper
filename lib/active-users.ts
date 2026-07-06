import { prisma } from "@/lib/db";
import { buildCityLabel, formatAnalyticsPathLabel } from "@/lib/analytics-insights";

const ONLINE_MS = 5 * 60 * 1000;
const RECENT_MS = 30 * 60 * 1000;

export type ActiveUserStatus = "online" | "recent";

export type ActiveMemberRow = {
  kind: "member";
  userId: string;
  email: string | null;
  name: string | null;
  locationLabel: string | null;
  lastSeenAt: string;
  lastPath: string;
  lastPathLabel: string;
  deviceType: string | null;
  status: ActiveUserStatus;
  minutesAgo: number;
};

export type ActiveVisitorRow = {
  kind: "visitor";
  visitorId: string;
  locationLabel: string | null;
  lastSeenAt: string;
  lastPath: string;
  lastPathLabel: string;
  deviceType: string | null;
  browser: string | null;
  status: ActiveUserStatus;
  minutesAgo: number;
};

/** @deprecated use ActiveMemberRow */
export type ActiveUserRow = ActiveMemberRow;

export type LiveActivitySnapshot = {
  onlineMemberCount: number;
  recentMemberCount: number;
  onlineVisitorCount: number;
  recentVisitorCount: number;
  members: ActiveMemberRow[];
  visitors: ActiveVisitorRow[];
  windowMinutes: number;
  /** @deprecated */
  onlineCount: number;
  /** @deprecated */
  recentCount: number;
  /** @deprecated */
  users: ActiveMemberRow[];
};

type MemberEventRow = {
  userId: string | null;
  path: string;
  createdAt: Date;
  deviceType: string | null;
  country: string | null;
  city: string | null;
};

type VisitorEventRow = {
  visitorId: string | null;
  path: string;
  createdAt: Date;
  deviceType: string | null;
  browser: string | null;
  country: string | null;
  city: string | null;
};

type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  novaConnectDisplayName?: string | null;
};

function statusFromAge(ageMs: number): ActiveUserStatus {
  return ageMs < ONLINE_MS ? "online" : "recent";
}

export async function getActiveUsersForOwner(): Promise<LiveActivitySnapshot> {
  const since = new Date(Date.now() - RECENT_MS);
  const now = Date.now();

  const memberEvents = (await (prisma as unknown as {
    analyticsEvent: {
      findMany: (args: {
        where: { userId: { not: null }; createdAt: { gte: Date } };
        orderBy: { createdAt: "desc" };
        select: {
          userId: true;
          path: true;
          createdAt: true;
          deviceType: true;
          country: true;
          city: true;
        };
        take: number;
      }) => Promise<MemberEventRow[]>;
    };
  }).analyticsEvent.findMany({
    where: { userId: { not: null }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { userId: true, path: true, createdAt: true, deviceType: true, country: true, city: true },
    take: 8000,
  })) as MemberEventRow[];

  const visitorEvents = (await (prisma as unknown as {
    analyticsEvent: {
      findMany: (args: {
        where: { userId: null; visitorId: { not: null }; createdAt: { gte: Date } };
        orderBy: { createdAt: "desc" };
        select: {
          visitorId: true;
          path: true;
          createdAt: true;
          deviceType: true;
          browser: true;
          country: true;
          city: true;
        };
        take: number;
      }) => Promise<VisitorEventRow[]>;
    };
  }).analyticsEvent.findMany({
    where: { userId: null, visitorId: { not: null }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: {
      visitorId: true,
      path: true,
      createdAt: true,
      deviceType: true,
      browser: true,
      country: true,
      city: true,
    },
    take: 8000,
  })) as VisitorEventRow[];

  const latestByUser = new Map<
    string,
    { lastSeenAt: Date; lastPath: string; deviceType: string | null; locationLabel: string | null }
  >();
  for (const e of memberEvents) {
    if (!e.userId || latestByUser.has(e.userId)) continue;
    latestByUser.set(e.userId, {
      lastSeenAt: e.createdAt,
      lastPath: e.path,
      deviceType: e.deviceType,
      locationLabel: buildCityLabel(e.city, e.country),
    });
  }

  const userIds = [...latestByUser.keys()];
  const users =
    userIds.length === 0
      ? []
      : ((await (prisma as unknown as {
          user: {
            findMany: (args: {
              where: { id: { in: string[] } };
              select: { id: true; email: true; name: true; novaConnectDisplayName: true };
            }) => Promise<UserRow[]>;
          };
        }).user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true, novaConnectDisplayName: true },
        })) as UserRow[]);

  const members: ActiveMemberRow[] = users.map((u) => {
    const activity = latestByUser.get(u.id)!;
    const ageMs = now - activity.lastSeenAt.getTime();
    const status = statusFromAge(ageMs);
    return {
      kind: "member",
      userId: u.id,
      email: u.email,
      name: u.novaConnectDisplayName ?? u.name,
      locationLabel: activity.locationLabel,
      lastSeenAt: activity.lastSeenAt.toISOString(),
      lastPath: activity.lastPath,
      lastPathLabel: formatAnalyticsPathLabel(activity.lastPath),
      deviceType: activity.deviceType,
      status,
      minutesAgo: Math.max(0, Math.floor(ageMs / 60000)),
    };
  });

  const latestByVisitor = new Map<
    string,
    {
      lastSeenAt: Date;
      lastPath: string;
      deviceType: string | null;
      browser: string | null;
      locationLabel: string | null;
    }
  >();
  for (const e of visitorEvents) {
    if (!e.visitorId || latestByVisitor.has(e.visitorId)) continue;
    latestByVisitor.set(e.visitorId, {
      lastSeenAt: e.createdAt,
      lastPath: e.path,
      deviceType: e.deviceType,
      browser: e.browser,
      locationLabel: buildCityLabel(e.city, e.country),
    });
  }

  const visitors: ActiveVisitorRow[] = [...latestByVisitor.entries()].map(([visitorId, activity]) => {
    const ageMs = now - activity.lastSeenAt.getTime();
    const status = statusFromAge(ageMs);
    return {
      kind: "visitor",
      visitorId,
      locationLabel: activity.locationLabel,
      lastSeenAt: activity.lastSeenAt.toISOString(),
      lastPath: activity.lastPath,
      lastPathLabel: formatAnalyticsPathLabel(activity.lastPath),
      deviceType: activity.deviceType,
      browser: activity.browser,
      status,
      minutesAgo: Math.max(0, Math.floor(ageMs / 60000)),
    };
  });

  members.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  visitors.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  const onlineMemberCount = members.filter((r) => r.status === "online").length;
  const recentMemberCount = members.filter((r) => r.status === "recent").length;
  const onlineVisitorCount = visitors.filter((r) => r.status === "online").length;
  const recentVisitorCount = visitors.filter((r) => r.status === "recent").length;

  return {
    onlineMemberCount,
    recentMemberCount,
    onlineVisitorCount,
    recentVisitorCount,
    members,
    visitors,
    windowMinutes: RECENT_MS / 60000,
    onlineCount: onlineMemberCount + onlineVisitorCount,
    recentCount: recentMemberCount + recentVisitorCount,
    users: members,
  };
}
