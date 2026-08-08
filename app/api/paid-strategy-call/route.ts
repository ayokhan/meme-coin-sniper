import { NextResponse } from "next/server";
import { getPaidStrategyCallConfig, toPaidStrategyCallPublic } from "@/lib/paid-strategy-call";

export async function GET() {
  try {
    const config = toPaidStrategyCallPublic(await getPaidStrategyCallConfig());
    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("paid-strategy-call public GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load." }, { status: 500 });
  }
}
