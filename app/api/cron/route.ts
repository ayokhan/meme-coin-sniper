import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runAiAnalysis } from '@/lib/ai-analyze';
import { runAiAnalysisBsc } from '@/lib/ai-analyze-bsc';

const PIN_REANALYZE_MINUTES = 3;
const MAX_PINS_PER_CRON = 5;

/**
 * Vercel Cron hits this route on schedule (see vercel.json).
 * Set CRON_SECRET in Vercel env; when set, Vercel sends it as Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const results: {
    scan?: { ok: boolean; message?: string };
    scanTwitter?: { ok: boolean; message?: string };
    walletNotify?: { ok: boolean; sent?: number; message?: string };
    leverageNotify?: { ok: boolean; sent?: number; message?: string };
    pinnedReanalyze?: { ok: boolean; updated?: number; message?: string };
    tradingBot?: { ok: boolean; message?: string; error?: string };
    perpNewListing?: { ok: boolean; newListings?: number; sent?: number; message?: string };
    perpDigest?: { ok: boolean; message?: string };
    perpAlerts?: { ok: boolean; triggered?: number; message?: string };
    novaScalper?: { ok: boolean; processed?: number; skipped?: boolean; message?: string };
  } = {};

  try {
    const scanRes = await fetch(`${base}/api/scan?source=birdeye`, { cache: 'no-store' });
    const scanData = await scanRes.json().catch(() => ({}));
    results.scan = { ok: scanData.success === true, message: scanData.error ?? scanData.hint };
  } catch (e) {
    results.scan = { ok: false, message: e instanceof Error ? e.message : 'Request failed' };
  }

  try {
    const twitterRes = await fetch(`${base}/api/scan-twitter`, { cache: 'no-store' });
    const twitterData = await twitterRes.json().catch(() => ({}));
    results.scanTwitter = { ok: twitterData.success === true, message: twitterData.error };
  } catch (e) {
    results.scanTwitter = { ok: false, message: e instanceof Error ? e.message : 'Request failed' };
  }

  try {
    const auth = request.headers.get('authorization');
    const walletRes = await fetch(`${base}/api/wallet-tracker/notify`, {
      cache: 'no-store',
      headers: auth ? { Authorization: auth } : {},
    });
    const walletData = await walletRes.json().catch(() => ({}));
    results.walletNotify = {
      ok: walletData.success === true,
      sent: walletData.sent,
      message: walletData.error,
    };
  } catch (e) {
    results.walletNotify = { ok: false, message: e instanceof Error ? e.message : 'Request failed' };
  }

  try {
    const authCron = request.headers.get('authorization');
    const leverageRes = await fetch(`${base}/api/leverage-wallet-tracker/notify`, {
      cache: 'no-store',
      headers: authCron ? { Authorization: authCron } : {},
    });
    const leverageData = await leverageRes.json().catch(() => ({}));
    results.leverageNotify = {
      ok: leverageData.success === true,
      sent: leverageData.sent,
      message: leverageData.error ?? leverageData.message,
    };
  } catch (e) {
    results.leverageNotify = { ok: false, message: e instanceof Error ? e.message : 'Leverage notify failed' };
  }

  try {
    const cutoff = new Date(Date.now() - PIN_REANALYZE_MINUTES * 60 * 1000);
    const prismaAny = prisma as unknown as { pinnedToken?: { findMany: (args: unknown) => Promise<{ id: string; contractAddress: string; chain: string; symbol: string | null; name: string | null }[]>; update: (args: unknown) => Promise<unknown> } };
    if (!prismaAny.pinnedToken) {
      results.pinnedReanalyze = { ok: true, updated: 0, message: 'PinnedToken model not in schema' };
    } else {
    const due = await prismaAny.pinnedToken.findMany({
      where: {
        OR: [
          { lastAnalyzedAt: null },
          { lastAnalyzedAt: { lt: cutoff } },
        ],
      },
      take: MAX_PINS_PER_CRON,
      orderBy: { pinnedAt: 'asc' },
    } as unknown);
    let updated = 0;
    for (const pin of due) {
      try {
        const chain = pin.chain === 'bsc' ? 'bsc' : 'solana';
        const result = chain === 'bsc'
          ? await runAiAnalysisBsc(pin.contractAddress)
          : await runAiAnalysis(pin.contractAddress);
        await prismaAny.pinnedToken.update({
          where: { id: pin.id },
          data: {
            lastAnalyzedAt: new Date(),
            analysisResult: result as unknown as Record<string, unknown>,
            symbol: result.tokenInfo?.symbol ?? pin.symbol,
            name: result.tokenInfo?.name ?? pin.name,
          },
        } as unknown);
        updated++;
      } catch (e) {
        console.warn('Pinned re-analyze failed for', pin.contractAddress, e instanceof Error ? e.message : e);
      }
    }
    results.pinnedReanalyze = { ok: true, updated, message: due.length ? `Re-analyzed ${updated}/${due.length} pins` : undefined };
    }
  } catch (e) {
    results.pinnedReanalyze = { ok: false, message: e instanceof Error ? e.message : 'Pinned re-analyze failed' };
  }

  try {
    const authHeader = request.headers.get('authorization');
    const tradingRes = await fetch(`${base}/api/admin/trading-bot/run`, {
      cache: 'no-store',
      headers: authHeader ? { Authorization: authHeader } : {},
    });
    const tradingData = await tradingRes.json().catch(() => ({}));
    results.tradingBot = {
      ok: tradingData.success === true,
      message: tradingData.message,
      error: tradingData.error,
    };
  } catch (e) {
    results.tradingBot = { ok: false, error: e instanceof Error ? e.message : 'Trading bot run failed' };
  }

  try {
    const authPerp = request.headers.get('authorization');
    const perpRes = await fetch(`${base}/api/cron/perp-new-listing`, {
      cache: 'no-store',
      headers: authPerp ? { Authorization: authPerp } : {},
    });
    const perpData = await perpRes.json().catch(() => ({}));
    results.perpNewListing = {
      ok: perpData.success === true,
      newListings: perpData.newListings,
      sent: perpData.sent,
      message: perpData.error,
    };
  } catch (e) {
    results.perpNewListing = { ok: false, message: e instanceof Error ? e.message : 'Perp new listing failed' };
  }

  try {
    const authDigest = request.headers.get('authorization');
    const digestRes = await fetch(`${base}/api/cron/perp-digest`, {
      cache: 'no-store',
      headers: authDigest ? { Authorization: authDigest } : {},
    });
    const digestData = await digestRes.json().catch(() => ({}));
    results.perpDigest = { ok: digestData.success === true, message: digestData.error };
  } catch (e) {
    results.perpDigest = { ok: false, message: e instanceof Error ? e.message : 'Perp digest failed' };
  }

  try {
    const authAlerts = request.headers.get('authorization');
    const alertsRes = await fetch(`${base}/api/cron/perp-alerts`, {
      cache: 'no-store',
      headers: authAlerts ? { Authorization: authAlerts } : {},
    });
    const alertsData = await alertsRes.json().catch(() => ({}));
    results.perpAlerts = {
      ok: alertsData.success === true,
      triggered: alertsData.triggered,
      message: alertsData.error,
    };
  } catch (e) {
    results.perpAlerts = { ok: false, message: e instanceof Error ? e.message : 'Perp alerts failed' };
  }

  try {
    const authNs = request.headers.get('authorization');
    const nsRes = await fetch(`${base}/api/cron/nova-scalper`, {
      cache: 'no-store',
      headers: authNs ? { Authorization: authNs } : {},
    });
    const nsData = await nsRes.json().catch(() => ({}));
    results.novaScalper = {
      ok: nsData.success === true,
      processed: typeof nsData.processed === 'number' ? nsData.processed : undefined,
      skipped: nsData.skipped === true,
      message: nsData.reason ?? nsData.error,
    };
  } catch (e) {
    results.novaScalper = { ok: false, message: e instanceof Error ? e.message : 'NovaScalper cron failed' };
  }

  return NextResponse.json({ success: true, cron: results });
}
