import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const CONFIG_ID = "default";

type PrismaExt = typeof prisma & {
  earlyCatchConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
    upsert: (a: object) => Promise<Record<string, unknown>>;
  };
  earlyCatchUserLimit?: {
    findMany: () => Promise<Array<{ id: string; userId: string; dailyLimit: number }>>;
    upsert: (a: object) => Promise<unknown>;
    delete: (a: object) => Promise<unknown>;
  };
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const cfgDb = (prisma as unknown as PrismaExt).earlyCatchConfig;
  const ulDb = (prisma as unknown as PrismaExt).earlyCatchUserLimit;
  const row = cfgDb ? await cfgDb.findUnique({ where: { id: CONFIG_ID } }) : null;
  const config = row ?? {
    enabled: true,
    vipDailyLimit: 1,
    freeDailyLimit: 0,
    maxMarketCapUsd: 20000,
    minLiquidityUsd: 2000,
  };
  const userLimits = ulDb ? await ulDb.findMany() : [];
  return NextResponse.json({ success: true, config, userLimits });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json();
  const cfgDb = (prisma as unknown as PrismaExt).earlyCatchConfig;
  if (!cfgDb) return NextResponse.json({ success: false, error: "Run prisma db push first." }, { status: 500 });

  const update: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.vipDailyLimit === "number") update.vipDailyLimit = Math.max(0, Math.round(body.vipDailyLimit));
  if (typeof body.freeDailyLimit === "number") update.freeDailyLimit = Math.max(0, Math.round(body.freeDailyLimit));
  if (typeof body.maxMarketCapUsd === "number") update.maxMarketCapUsd = Math.max(1000, body.maxMarketCapUsd);
  if (typeof body.minLiquidityUsd === "number") update.minLiquidityUsd = Math.max(0, body.minLiquidityUsd);

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
  const ulDb = (prisma as unknown as PrismaExt).earlyCatchUserLimit;
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
    try {
      await ulDb.delete({ where: { userId: body.userId } });
    } catch {
      /* not found */
    }
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
}
