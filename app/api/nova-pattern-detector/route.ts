import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  analyzeNovaPattern,
  NOVA_PATTERN_LOOKBACK_OPTIONS,
  NOVA_PATTERN_TYPE_OPTIONS,
} from "@/lib/nova-pattern-detector";
import { isValidNovaExtraTimezone } from "@/lib/nova-extra";
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
    const patternTypeId = String(body.patternTypeId ?? body.patternType ?? "playbook").trim();
    const timezoneRaw = String(body.timezone ?? body.tz ?? "America/New_York").trim();
    const timezone = isValidNovaExtraTimezone(timezoneRaw) ? timezoneRaw : "America/New_York";

    if (!NOVA_PATTERN_LOOKBACK_OPTIONS.some((o) => o.id === lookbackId)) {
      return NextResponse.json({ success: false, error: "Invalid lookback period." }, { status: 400 });
    }
    if (!NOVA_PATTERN_TYPE_OPTIONS.some((o) => o.id === patternTypeId)) {
      return NextResponse.json({ success: false, error: "Invalid pattern type." }, { status: 400 });
    }

    const result = await analyzeNovaPattern(symbol, { lookbackId, patternTypeId, timezone });
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pattern analysis failed";
    console.error("nova-pattern-detector POST:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
