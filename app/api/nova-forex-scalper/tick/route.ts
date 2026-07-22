import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNovaForexScalpBotAccess } from "@/lib/vip-futures-addon-access";
import { runNovaForexScalperTick } from "@/lib/nova-forex-scalper-run";

export const dynamic = "force-dynamic";

/** POST — run one tick. Body: { configId? }. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const body = (await request.json().catch(() => ({}))) as { configId?: string };
    const result = await runNovaForexScalperTick(access.userId, { configId: body.configId });
    return NextResponse.json({ success: result.ok, message: result.message, error: result.error });
  } catch (e) {
    console.error("nova-forex-scalper/tick POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Tick failed." },
      { status: 500 }
    );
  }
}
