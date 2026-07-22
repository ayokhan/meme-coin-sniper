import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNovaForexBotAccess } from "@/lib/vip-futures-addon-access";
import { runNovaForexBotTick } from "@/lib/nova-forex-bot-run";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const result = await runNovaForexBotTick(access.userId);
    return NextResponse.json({ success: result.ok, message: result.message, error: result.error, action: result.action });
  } catch (e) {
    console.error("nova-forex-bot/tick POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Tick failed." },
      { status: 500 }
    );
  }
}
