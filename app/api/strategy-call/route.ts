import { NextResponse } from "next/server";
import { getStrategyCallConfig, toStrategyCallPublic } from "@/lib/strategy-call";

/** Public strategy-call flags for dashboard nav + one-time popup. */
export async function GET() {
  try {
    const config = toStrategyCallPublic(await getStrategyCallConfig());
    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("strategy-call public GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load." }, { status: 500 });
  }
}
