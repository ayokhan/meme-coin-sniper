import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { resetNovaScalperState } from "@/lib/nova-scalper-run";

export const dynamic = "force-dynamic";

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
    };
    const r = await resetNovaScalperState(userId, {
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
