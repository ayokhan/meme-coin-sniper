import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const CONFIG_ID = "default";

type PrismaExt = typeof prisma & {
  pnlCalculatorConfig?: {
    findUnique: (a: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
    upsert: (a: object) => Promise<Record<string, unknown>>;
  };
  pnlCalculatorUserLimit?: {
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
  const cfgDb = (prisma as unknown as PrismaExt).pnlCalculatorConfig;
  const ulDb = (prisma as unknown as PrismaExt).pnlCalculatorUserLimit;
  const row = cfgDb ? await cfgDb.findUnique({ where: { id: CONFIG_ID } }) : null;
  const config = row ?? { enabled: true, guestDailyLimit: 2, freeDailyLimit: 4, vipDailyLimit: 0 };
  const userLimits = ulDb ? await ulDb.findMany() : [];
  return NextResponse.json({ success: true, config, userLimits });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json();
  const cfgDb = (prisma as unknown as PrismaExt).pnlCalculatorConfig;
  if (!cfgDb) return NextResponse.json({ success: false, error: "Run prisma migrate deploy first." }, { status: 500 });

  const update: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.guestDailyLimit === "number") update.guestDailyLimit = Math.max(0, Math.round(body.guestDailyLimit));
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
  const ulDb = (prisma as unknown as PrismaExt).pnlCalculatorUserLimit;
  if (!ulDb) return NextResponse.json({ success: false, error: "Run prisma migrate deploy first." }, { status: 500 });

  if (body.action === "set" && body.userId && typeof body.dailyLimit === "number") {
    await ulDb.upsert({
      where: { userId: body.userId },
      create: { userId: body.userId, dailyLimit: Math.round(body.dailyLimit) },
      update: { dailyLimit: Math.round(body.dailyLimit) },
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
