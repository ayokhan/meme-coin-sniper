import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { runTradingBotCycle } from "@/lib/trading-bot-run";

export const dynamic = "force-dynamic";

/**
 * GET: Run one bot cycle. Called by cron (Bearer CRON_SECRET) or owner (session).
 * POST: Same, for manual trigger by owner.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner or cron only." }, { status: 403 });
    }
  }
  const result = await runTradingBotCycle();
  return NextResponse.json({
    success: result.ok,
    message: result.message,
    error: result.error,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const result = await runTradingBotCycle();
  return NextResponse.json({
    success: result.ok,
    message: result.message,
    error: result.error,
  });
}
