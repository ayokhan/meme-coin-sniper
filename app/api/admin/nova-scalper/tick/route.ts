import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { runNovaScalperTick } from "@/lib/nova-scalper-run";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
    }
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const result = await runNovaScalperTick(session.user.id, {
      envFallbackForOwner: isOwnerSession(session),
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
