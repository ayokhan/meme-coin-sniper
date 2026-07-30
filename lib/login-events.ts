import crypto from "crypto";
import { prisma } from "@/lib/db";
import { buildCityLabel } from "@/lib/analytics-insights";
import { parseUserAgent } from "@/lib/ua-parse";
import { getAuthRequest } from "@/lib/auth-request-context";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

export type LoginProvider = "email" | "google" | "wallet" | "capacitor";

export type LoginEventRow = {
  id: string;
  provider: string;
  country: string | null;
  city: string | null;
  locationLabel: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  createdAt: string;
};

const KEEP_PER_USER = 20;
const DEDUPE_MS = 10 * 60 * 1000;
const MULTI_LOCATION_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const MULTI_LOCATION_NEAR_MS = 48 * 60 * 60 * 1000;

export async function isLoginLocationIntelEnabled(): Promise<boolean> {
  return getFeatureFlag(FEATURE_FLAG_KEYS.LOGIN_LOCATION_INTEL);
}

function loginEventDb() {
  return (prisma as unknown as {
    loginEvent: {
      create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
      findFirst: (args: {
        where: Record<string, unknown>;
        orderBy?: Record<string, string>;
      }) => Promise<{
        id: string;
        country: string | null;
        city: string | null;
        deviceType: string | null;
        browser: string | null;
        createdAt: Date;
      } | null>;
      findMany: (args: {
        where?: Record<string, unknown>;
        orderBy?: Record<string, string> | Array<Record<string, string>>;
        take?: number;
        select?: Record<string, boolean>;
      }) => Promise<
        Array<{
          id: string;
          userId: string;
          provider: string;
          country: string | null;
          city: string | null;
          deviceType: string | null;
          browser: string | null;
          os: string | null;
          createdAt: Date;
        }>
      >;
      deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
    };
  }).loginEvent;
}

function clientIpFromRequest(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  return realIp ? realIp.slice(0, 64) : null;
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export function geoFromRequest(req: Request): {
  country: string | null;
  city: string | null;
  deviceType: string;
  browser: string;
  os: string;
  ipHash: string | null;
} {
  const country = (req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null) || null;
  const cityRaw = req.headers.get("x-vercel-ip-city") ?? req.headers.get("cf-ipcity") ?? null;
  const city = (typeof cityRaw === "string" ? cityRaw.trim().slice(0, 200) : null) || null;
  const ua = req.headers.get("user-agent") ?? null;
  const { deviceType, browser, os } = parseUserAgent(ua);
  return {
    country: country ? country.trim().slice(0, 8).toUpperCase() : null,
    city,
    deviceType,
    browser,
    os,
    ipHash: hashIp(clientIpFromRequest(req)),
  };
}

function normalizeProvider(raw: string | null | undefined): LoginProvider {
  const p = (raw ?? "").toLowerCase();
  if (p === "google") return "google";
  if (p === "wallet") return "wallet";
  if (p === "capacitor") return "capacitor";
  return "email";
}

async function pruneOldLogins(userId: string) {
  const db = loginEventDb();
  const keep = await db.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: KEEP_PER_USER,
    select: { id: true },
  });
  if (keep.length < KEEP_PER_USER) return;
  const keepIds = keep.map((r) => r.id);
  await db.deleteMany({
    where: { userId, id: { notIn: keepIds } },
  });
}

/** Record a successful sign-in. Safe to call fire-and-forget; never throws to callers. */
export async function recordLoginEvent(args: {
  userId: string;
  provider?: string | null;
  request?: Request | null;
}): Promise<void> {
  try {
    const req = args.request ?? getAuthRequest() ?? null;
    const geo = req
      ? geoFromRequest(req)
      : { country: null, city: null, deviceType: null, browser: null, os: null, ipHash: null };

    // First-touch registered-from (OAuth / older accounts). Independent of intel flag.
    if (geo.country || geo.city) {
      try {
        await (prisma.user as any).updateMany({
          where: {
            id: args.userId,
            registeredCountry: null,
            registeredCity: null,
          },
          data: {
            registeredCountry: geo.country,
            registeredCity: geo.city,
            registeredIpHash: geo.ipHash,
          },
        });
      } catch {
        /* ignore */
      }
    }

    if (!(await isLoginLocationIntelEnabled())) return;
    const db = loginEventDb();
    if (!db) return;
    const provider = normalizeProvider(args.provider);

    const recent = await db.findFirst({
      where: { userId: args.userId },
      orderBy: { createdAt: "desc" },
    });
    if (
      recent &&
      Date.now() - recent.createdAt.getTime() < DEDUPE_MS &&
      (recent.country ?? null) === (geo.country ?? null) &&
      (recent.city ?? null) === (geo.city ?? null) &&
      (recent.deviceType ?? null) === (geo.deviceType ?? null) &&
      (recent.browser ?? null) === (geo.browser ?? null)
    ) {
      return;
    }

    await db.create({
      data: {
        userId: args.userId,
        provider,
        country: geo.country,
        city: geo.city,
        deviceType: geo.deviceType,
        browser: geo.browser,
        os: geo.os,
        ipHash: geo.ipHash,
      },
    });
    await pruneOldLogins(args.userId);
  } catch (e) {
    console.error("recordLoginEvent:", e);
  }
}

export function isMultiLocationSuspect(
  events: Array<{ country: string | null; createdAt: Date | string }>
): boolean {
  const cutoff = Date.now() - MULTI_LOCATION_LOOKBACK_MS;
  const withCountry = events
    .map((e) => ({
      country: (e.country ?? "").trim().toUpperCase(),
      at: typeof e.createdAt === "string" ? Date.parse(e.createdAt) : e.createdAt.getTime(),
    }))
    .filter((e) => e.country && Number.isFinite(e.at) && e.at >= cutoff);

  const countries = new Set(withCountry.map((e) => e.country));
  if (countries.size < 2) return false;

  // Flag when two different countries appear within 48h (travel is possible; sharing is common).
  for (let i = 0; i < withCountry.length; i++) {
    for (let j = i + 1; j < withCountry.length; j++) {
      if (withCountry[i]!.country === withCountry[j]!.country) continue;
      if (Math.abs(withCountry[i]!.at - withCountry[j]!.at) <= MULTI_LOCATION_NEAR_MS) return true;
    }
  }
  // Or 3+ countries in 30 days even if spaced out
  return countries.size >= 3;
}

export async function getRecentLoginEventsForUser(userId: string, limit = KEEP_PER_USER): Promise<LoginEventRow[]> {
  if (!(await isLoginLocationIntelEnabled())) return [];
  const db = loginEventDb();
  if (!db) return [];
  const rows = await db.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    country: r.country,
    city: r.city,
    locationLabel: buildCityLabel(r.city, r.country),
    deviceType: r.deviceType,
    browser: r.browser,
    os: r.os,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Batch flags + recent samples for admin customers list. */
export async function getLoginIntelByUserIds(userIds: string[]): Promise<
  Map<
    string,
    {
      multiLocationSuspect: boolean;
      distinctCountries: number;
      usedAndroidApp: boolean;
      recentLogins: LoginEventRow[];
    }
  >
> {
  const map = new Map<
    string,
    {
      multiLocationSuspect: boolean;
      distinctCountries: number;
      usedAndroidApp: boolean;
      recentLogins: LoginEventRow[];
    }
  >();
  for (const id of userIds) {
    map.set(id, {
      multiLocationSuspect: false,
      distinctCountries: 0,
      usedAndroidApp: false,
      recentLogins: [],
    });
  }
  if (userIds.length === 0) return map;
  if (!(await isLoginLocationIntelEnabled())) return map;

  const db = loginEventDb();
  if (!db) return map;

  const since = new Date(Date.now() - MULTI_LOCATION_LOOKBACK_MS);
  const rows = await db.findMany({
    where: { userId: { in: userIds }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: Math.min(userIds.length * KEEP_PER_USER, 8000),
  });

  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byUser.get(r.userId) ?? [];
    if (list.length >= KEEP_PER_USER) continue;
    list.push(r);
    byUser.set(r.userId, list);
  }

  for (const [userId, list] of byUser) {
    const recentLogins: LoginEventRow[] = list.map((r) => ({
      id: r.id,
      provider: r.provider,
      country: r.country,
      city: r.city,
      locationLabel: buildCityLabel(r.city, r.country),
      deviceType: r.deviceType,
      browser: r.browser,
      os: r.os,
      createdAt: r.createdAt.toISOString(),
    }));
    const countries = new Set(
      list.map((r) => (r.country ?? "").trim().toUpperCase()).filter(Boolean)
    );
    const usedAndroidApp = list.some(
      (r) =>
        r.provider === "capacitor" ||
        (r.os ?? "").toLowerCase() === "android"
    );
    map.set(userId, {
      multiLocationSuspect: isMultiLocationSuspect(list),
      distinctCountries: countries.size,
      usedAndroidApp,
      recentLogins,
    });
  }

  return map;
}
