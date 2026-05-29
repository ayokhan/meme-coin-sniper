import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyzeNovaPattern, NOVA_PATTERN_LOOKBACK_OPTIONS } from "@/lib/nova-pattern-detector";
import { getNovaPatternDetectorAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaPatternDetectorAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = String(body.symbol ?? "XAU").trim();
    const lookbackId = String(body.lookbackId ?? "6w").trim();
    const timeframesParam = body.timeframes ?? body.tf ?? ["24h", "48h", "1w"];

    if (!NOVA_PATTERN_LOOKBACK_OPTIONS.some((o) => o.id === lookbackId)) {
      return NextResponse.json({ success: false, error: "Invalid lookback period." }, { status: 400 });
    }

    const timeframeIds = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/)
      : Array.isArray(timeframesParam)
        ? timeframesParam
        : []
    )
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);

    const result = await analyzeNovaPattern(symbol, { lookbackId, timeframeIds });
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pattern analysis failed";
    console.error("nova-pattern-detector POST:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
