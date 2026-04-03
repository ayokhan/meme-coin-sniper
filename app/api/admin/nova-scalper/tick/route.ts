import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runNovaScalperTick } from "@/lib/nova-scalper-run";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const body = (await request.json().catch(() => ({}))) as { configId?: string };
    let configId = typeof body.configId === "string" ? body.configId.trim() : "";
    if (!configId) {
      const only = await db.novaScalperConfig.findFirst({
        where: { userId: session.user.id },
        orderBy: { slot: "asc" },
        select: { id: true },
      });
      if (!only) {
        return NextResponse.json({ success: false, error: "No NovaScalper config." }, { status: 404 });
      }
      configId = only.id;
    } else {
      const ok = await db.novaScalperConfig.findFirst({
        where: { id: configId, userId: session.user.id },
        select: { id: true },
      });
      if (!ok) {
        return NextResponse.json({ success: false, error: "Config not found." }, { status: 404 });
      }
    }
    const result = await runNovaScalperTick(session.user.id, {
      envFallbackForOwner: isOwnerSession(session),
      configId,
    });
    return NextResponse.json({
      success: result.ok,
      message: result.message,
      error: result.error,
    });
  } catch (e) {
    console.error("nova-scalper tick:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Tick failed." },
      { status: 500 }
    );
  }
}
