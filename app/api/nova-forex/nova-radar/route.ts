import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runForexNovaRadar } from "@/lib/nova-forex-radar";
import { getNovaForexAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const out = await runForexNovaRadar(body as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      symbol: out.symbol,
      currentPrice: out.currentPrice,
      contractDescription: out.contractDescription,
      plans: out.plans,
      recommendation: out.recommendation,
      disclaimer: out.disclaimer,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Forex Radar failed";
    const status = message.includes("Enter") || message.includes("valid") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
