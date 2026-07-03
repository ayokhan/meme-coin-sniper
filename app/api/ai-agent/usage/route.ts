import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getAiAgentUsageForUser } from "@/lib/ai-agent-quota";

export const dynamic = "force-dynamic";

/** GET — daily usage + limits for Meme Coins Agent and Chart Analysis. */
export async function GET() {
  const { session, isPaid } = await getSessionAndSubscription();
  const usage = await getAiAgentUsageForUser(session, isPaid);
  return NextResponse.json({ success: true, ...usage });
}
