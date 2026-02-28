import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { runTradingBotCycle } from "@/lib/trading-bot-run";
import { isBlofinConfigured } from "@/lib/blofin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

async function runWithPreCheck(userId?: string) {
  const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!bot) {
    return { ok: false, message: null, error: "No bot config. Save config first." };
  }
  const provider = ((bot as { provider?: string }).provider ?? "blofin").toLowerCase();
  if (provider !== "blofin") {
    return { ok: false, message: null, error: "Only Blofin is supported. Set provider to Blofin in config." };
  }
  // Require global Blofin keys only when running without a user (e.g. cron); per-user run uses user's keys
  if (!userId && !isBlofinConfigured()) {
    return {
      ok: false,
      message: null,
      error: "Blofin API keys not set. Set BLOFIN_API_KEY, BLOFIN_SECRET_KEY, BLOFIN_PASSPHRASE in your server env, then redeploy.",
    };
  }
  const symbol = (bot.symbol ?? "").toString().trim();
  if (!symbol) {
    return { ok: false, message: null, error: "Symbol is required in config." };
  }
  return runTradingBotCycle(userId);
}

/**
 * GET: Run one bot cycle. Called by cron (Bearer CRON_SECRET) or owner (session).
 * POST: Same, for manual trigger by owner.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  let userId: string | undefined;
  if (!isCron) {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner or cron only." }, { status: 403 });
    }
    userId = session?.user?.id;
  }
  const result = await runWithPreCheck(userId);
  return NextResponse.json({
    success: result.ok,
    message: result.message,
    error: result.error,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!canAccessTradingBot(session)) {
    return NextResponse.json({ success: false, error: "Trading Bot run requires VIP + on demand access. Request access from the owner." }, { status: 403 });
  }
  const result = await runWithPreCheck(session.user.id);
  return NextResponse.json({
    success: result.ok,
    message: result.message,
    error: result.error,
  });
}
