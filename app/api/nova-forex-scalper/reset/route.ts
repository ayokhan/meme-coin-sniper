import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNovaForexScalpBotAccess } from "@/lib/vip-futures-addon-access";
import { resetNovaForexScalperState } from "@/lib/nova-forex-scalper-run";

export const dynamic = "force-dynamic";

/** POST — reset last ref price / in-position flag (optionally round count). Body: { configId?, clearRounds? }. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const body = (await request.json().catch(() => ({}))) as { configId?: string; clearRounds?: boolean };
    const r = await resetNovaForexScalperState(access.userId, {
      configId: body.configId,
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
