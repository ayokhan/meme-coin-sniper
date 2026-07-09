import { NextResponse } from "next/server";
import { getNjaSupportKnowledge } from "@/lib/nja-support-knowledge";

export const dynamic = "force-dynamic";

/** GET — topics Nja can answer (affiliate, partner promos). Controlled by admin feature flags. */
export async function GET() {
  try {
    const knowledge = await getNjaSupportKnowledge();
    return NextResponse.json({ success: true, ...knowledge });
  } catch (e) {
    console.error("nja-knowledge GET:", e);
    return NextResponse.json({ success: false, topics: [] }, { status: 500 });
  }
}
