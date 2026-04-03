import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resetNovaScalperState } from "@/lib/nova-scalper-run";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as {
      clearRounds?: boolean;
      configId?: string;
    };
    let configId = typeof body.configId === "string" ? body.configId.trim() : "";
    if (!configId) {
      const only = await db.novaScalperConfig.findFirst({
        where: { userId },
        orderBy: { slot: "asc" },
        select: { id: true },
      });
      if (!only) {
        return NextResponse.json({ success: false, error: "No NovaScalper config." }, { status: 404 });
      }
      configId = only.id;
    } else {
      const ok = await db.novaScalperConfig.findFirst({
        where: { id: configId, userId },
        select: { id: true },
      });
      if (!ok) {
        return NextResponse.json({ success: false, error: "Config not found." }, { status: 404 });
      }
    }
    const r = await resetNovaScalperState(userId, {
      configId,
      clearRounds: body.clearRounds === true,
      clearInPosition: true,
    });
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Reset failed." },
      { status: 500 }
    );
  }
}
