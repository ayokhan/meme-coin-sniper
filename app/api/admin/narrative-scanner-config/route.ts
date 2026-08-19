import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const CONFIG_ID = "default";

type PrismaExt = typeof prisma & {
  narrativeScannerConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<{ enabled: boolean; freeDailyLimit: number; vipDailyLimit: number; updatedAt: Date } | null>;
    upsert: (a: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<{ enabled: boolean; freeDailyLimit: number; vipDailyLimit: number; updatedAt: Date }>;
  };
  narrativeScannerUserLimit?: {
    findMany: () => Promise<{ id: string; userId: string; dailyLimit: number; updatedAt: Date }[]>;
    upsert: (a: { where: { userId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>;
    delete: (a: { where: { userId: string } }) => Promise<unknown>;
  };
};

function db() {
  return (prisma as unknown as PrismaExt).narrativeScannerConfig ?? null;
}

function userLimitDb() {
  return (prisma as unknown as PrismaExt).narrativeScannerUserLimit ?? null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const cfgDb = db();
  if (!cfgDb) return NextResponse.json({ success: true, config: { enabled: true, freeDailyLimit: 1, vipDailyLimit: 5 }, userLimits: [] });

  const row = await cfgDb.findUnique({ where: { id: CONFIG_ID } });
  const config = row ?? { enabled: true, freeDailyLimit: 1, vipDailyLimit: 5 };

  const ulDb = userLimitDb();
  const userLimits = ulDb ? await ulDb.findMany() : [];

  return NextResponse.json({ success: true, config, userLimits });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json();
  const cfgDb = db();
  if (!cfgDb) return NextResponse.json({ success: false, error: "Run prisma db push first." }, { status: 500 });

  const update: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.freeDailyLimit === "number") update.freeDailyLimit = Math.max(0, Math.round(body.freeDailyLimit));
  if (typeof body.vipDailyLimit === "number") update.vipDailyLimit = Math.max(0, Math.round(body.vipDailyLimit));

  const row = await cfgDb.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ...update },
    update,
  });

  return NextResponse.json({ success: true, config: row });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json();
  const ulDb = userLimitDb();
  if (!ulDb) return NextResponse.json({ success: false, error: "Run prisma db push first." }, { status: 500 });

  if (body.action === "set" && body.userId && typeof body.dailyLimit === "number") {
    await ulDb.upsert({
      where: { userId: body.userId },
      create: { userId: body.userId, dailyLimit: Math.max(0, Math.round(body.dailyLimit)) },
      update: { dailyLimit: Math.max(0, Math.round(body.dailyLimit)) },
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "remove" && body.userId) {
    try { await ulDb.delete({ where: { userId: body.userId } }); } catch { /* not found */ }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
