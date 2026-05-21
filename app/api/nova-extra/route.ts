import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeNovaExtra, NOVA_EXTRA_LOOKBACK_DAYS } from "@/lib/nova-extra";
import { getNovaExtraAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaExtraAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = String(body.symbol ?? "BTC").trim();
    const lookbackDays = Number(body.lookbackDays ?? NOVA_EXTRA_LOOKBACK_DAYS);

    const result = await analyzeNovaExtra(symbol, lookbackDays);
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Extra analysis failed";
    console.error("nova-extra POST:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
