import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { getAiAgentFunnelStats } from "@/lib/ai-agent-funnel";

export const dynamic = "force-dynamic";

/** GET — AI Agent conversion funnel (owner only). Query: days=30 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");
  const funnel = await getAiAgentFunnelStats(Number.isFinite(days) ? days : 30);
  return NextResponse.json({ success: true, funnel });
}
