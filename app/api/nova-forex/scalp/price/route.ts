import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validateForexScalpSymbol } from "@/lib/forex-market";
import { resolveForexLivePrice } from "@/lib/forex-live-price";
import { getNovaForexScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const validated = validateForexScalpSymbol(
      new URL(request.url).searchParams.get("symbol")?.trim() ?? "XAUUSD"
    );
    if (!validated.ok) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }
    const symbol = validated.symbol;
    const live = await resolveForexLivePrice({
      symbol,
      userId: session?.user?.id ?? null,
    });

    return NextResponse.json({
      success: true,
      symbol,
      price: live?.price ?? null,
      source: live?.source ?? null,
      bid: live?.bid ?? null,
      ask: live?.ask ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Price fetch failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
