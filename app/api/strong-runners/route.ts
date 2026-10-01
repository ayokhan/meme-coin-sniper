import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStrongRunnerAccess } from "@/lib/strong-runners-access";
import { isStrongRunnerChain, runStrongRunnersScan, type StrongRunnerChain } from "@/lib/strong-runners-scanner";
import {
  STRONG_RUNNER_CACHE_MS,
  getCachedScan,
  getStrongRunnerConfig,
  getStrongRunnerTrackRecord,
  recordPicks,
  saveScan,
  trackStrongRunnerPicks,
} from "@/lib/strong-runners-store";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const SOURCE = "strong_runners";

function dayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function usedToday(userId: string): Promise<number> {
  return prisma.usageAnalysisEvent.count({
    where: { userId, source: SOURCE, createdAt: { gte: dayStart() } },
  });
}

function parseChain(v: unknown): StrongRunnerChain {
  return isStrongRunnerChain(v) ? v : "solana";
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await getStrongRunnerAccess(session);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error, locked: access.locked }, { status: access.status });
  }
  const chain = parseChain(new URL(request.url).searchParams.get("chain"));
  try {
    const [config, latest, trackRecord, used] = await Promise.all([
      getStrongRunnerConfig(),
      getCachedScan(chain, 30 * 60 * 1000),
      getStrongRunnerTrackRecord(),
      access.isOwner ? Promise.resolve(0) : usedToday(access.userId),
    ]);
    return NextResponse.json({
      success: true,
      latest,
      trackRecord,
      usage: access.isOwner ? null : { used, limit: config.vipDailyLimit },
    });
  } catch (e) {
    console.error("strong-runners GET:", e);
    return NextResponse.json({ success: false, error: "Could not load Strong Runners." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const access = await getStrongRunnerAccess(session);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error, locked: access.locked }, { status: access.status });
  }

  let body: { chain?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* default chain */
  }
  const chain = parseChain(body.chain);

  try {
    const config = await getStrongRunnerConfig();
    if (!config.enabled && !access.isOwner) {
      return NextResponse.json({ success: false, error: "Strong Runners is paused right now. Check back soon." }, { status: 403 });
    }

    const cached = await getCachedScan(chain, STRONG_RUNNER_CACHE_MS);
    if (cached) return NextResponse.json({ success: true, result: cached, cached: true });

    if (!access.isOwner) {
      const used = await usedToday(access.userId);
      if (used >= config.vipDailyLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Daily limit reached (${config.vipDailyLimit} fresh scans per day, resets midnight UTC). Recent results are still shown.`,
            limitReached: true,
            used,
            limit: config.vipDailyLimit,
          },
          { status: 429 }
        );
      }
    }

    const result = await runStrongRunnersScan(chain, config);
    await saveScan(result);
    await recordPicks(result).catch((e) => console.error("strong-runners recordPicks:", e));
    await trackStrongRunnerPicks(40).catch((e) => console.error("strong-runners track:", e));
    if (!access.isOwner) {
      await prisma.usageAnalysisEvent.create({ data: { userId: access.userId, source: SOURCE } });
    }

    return NextResponse.json({ success: true, result, cached: false });
  } catch (e) {
    console.error("strong-runners POST:", e);
    return NextResponse.json({ success: false, error: "Scan failed. Try again in a minute." }, { status: 500 });
  }
}
