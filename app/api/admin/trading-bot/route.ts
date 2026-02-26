import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isBlofinConfigured } from '@/lib/blofin';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const VALID_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D'];
const VALID_STRATEGIES = ['simple', 'indicators', 'ai', 'hybrid'];

/** Returns error message if config is invalid; otherwise undefined. */
function validateConfig(c: {
  symbol?: string;
  timeframe?: string;
  leverage?: number;
  tpPct?: number;
  slPct?: number;
  positionSizeUsdt?: number;
  strategy?: string;
  emaPeriod?: number;
  fastMA?: number;
  slowMA?: number;
  rsiPeriod?: number;
}): string | undefined {
  const symbol = (c.symbol ?? '').trim().toUpperCase();
  if (!symbol) return 'Symbol is required (e.g. BTC or BTC/USDT).';
  if (typeof c.timeframe !== 'string' || !VALID_TIMEFRAMES.includes(c.timeframe.trim())) {
    return `Timeframe must be one of: ${VALID_TIMEFRAMES.join(', ')}.`;
  }
  const leverage = c.leverage ?? 0;
  if (typeof leverage !== 'number' || leverage < 1 || leverage > 125) {
    return 'Leverage must be between 1 and 125.';
  }
  if (typeof c.tpPct === 'number' && (c.tpPct <= 0 || c.tpPct > 100)) {
    return 'Take profit % must be between 0.1 and 100.';
  }
  if (typeof c.slPct === 'number' && (c.slPct <= 0 || c.slPct > 100)) {
    return 'Stop loss % must be between 0.1 and 100.';
  }
  if (typeof c.positionSizeUsdt === 'number' && (c.positionSizeUsdt <= 0 || c.positionSizeUsdt > 1_000_000)) {
    return 'Position size must be between 1 and 1,000,000.';
  }
  if (typeof c.strategy === 'string' && !VALID_STRATEGIES.includes(c.strategy)) {
    return `Strategy must be one of: ${VALID_STRATEGIES.join(', ')}.`;
  }
  return undefined;
}

/** GET - Get trading bot config and status (owner only). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }
    let bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!bot) {
      bot = await db.tradingBot.create({
        data: { provider: 'blofin', symbol: 'BTC', timeframe: '15m', leverage: 5, tpPct: 2, slPct: 1, mode: 'demo', marginCurrency: 'USDT', positionSizeUsdt: 50, enabled: false },
      });
    }
    return NextResponse.json({
      success: true,
      config: {
        provider: (bot as { provider?: string }).provider ?? 'blofin',
        symbol: bot.symbol,
        timeframe: bot.timeframe,
        leverage: bot.leverage,
        tpPct: bot.tpPct,
        slPct: bot.slPct,
        mode: bot.mode,
        marginCurrency: bot.marginCurrency ?? 'USDT',
        marginMode: (bot as { marginMode?: string }).marginMode ?? 'cross',
        positionSizeUsdt: bot.positionSizeUsdt ?? 50,
        strategy: (bot as { strategy?: string }).strategy ?? 'simple',
        emaPeriod: (bot as { emaPeriod?: number }).emaPeriod ?? 200,
        fastMA: (bot as { fastMA?: number }).fastMA ?? 9,
        slowMA: (bot as { slowMA?: number }).slowMA ?? 21,
        rsiPeriod: (bot as { rsiPeriod?: number }).rsiPeriod ?? 14,
        enabled: bot.enabled,
        lastRunAt: bot.lastRunAt?.toISOString() ?? null,
        lastError: bot.lastError ?? null,
        lastDecision: (bot as { lastDecision?: string | null }).lastDecision ?? null,
        lastDecisionMsg: (bot as { lastDecisionMsg?: string | null }).lastDecisionMsg ?? null,
        lastDecisionReason: (bot as { lastDecisionReason?: string | null }).lastDecisionReason ?? null,
      },
    });
  } catch (e) {
    console.error('Admin trading-bot GET:', e);
    const message = e instanceof Error ? e.message : 'Failed to load config.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PATCH - Update trading bot config (owner only). Only Blofin supported. Validates config and Blofin env before saving. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    if (body.provider && body.provider !== 'blofin') {
      return NextResponse.json({ success: false, error: 'Only Blofin is supported.' }, { status: 400 });
    }
    if (!isBlofinConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Blofin API keys not set. Set BLOFIN_API_KEY, BLOFIN_SECRET_KEY, BLOFIN_PASSPHRASE in your server env (e.g. Vercel), then redeploy.',
      }, { status: 400 });
    }
    let bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!bot) {
      bot = await db.tradingBot.create({
        data: { provider: 'blofin', symbol: 'BTC', timeframe: '15m', leverage: 5, tpPct: 2, slPct: 1, mode: 'demo', marginCurrency: 'USDT', positionSizeUsdt: 50, enabled: false },
      });
    }
    const merged = {
      symbol: (body.symbol ?? bot.symbol ?? '').toString().trim(),
      timeframe: (body.timeframe ?? bot.timeframe ?? '').toString().trim(),
      leverage: typeof body.leverage === 'number' ? body.leverage : bot.leverage ?? 5,
      tpPct: typeof body.tpPct === 'number' ? body.tpPct : bot.tpPct ?? 2,
      slPct: typeof body.slPct === 'number' ? body.slPct : bot.slPct ?? 1,
      positionSizeUsdt: typeof body.positionSizeUsdt === 'number' ? body.positionSizeUsdt : (bot.positionSizeUsdt ?? 50),
      strategy: (body.strategy ?? (bot as { strategy?: string }).strategy ?? 'simple') as string,
      emaPeriod: typeof body.emaPeriod === 'number' ? body.emaPeriod : (bot as { emaPeriod?: number }).emaPeriod,
      fastMA: typeof body.fastMA === 'number' ? body.fastMA : (bot as { fastMA?: number }).fastMA,
      slowMA: typeof body.slowMA === 'number' ? body.slowMA : (bot as { slowMA?: number }).slowMA,
      rsiPeriod: typeof body.rsiPeriod === 'number' ? body.rsiPeriod : (bot as { rsiPeriod?: number }).rsiPeriod,
    };
    const validationError = validateConfig(merged);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }
    const updates: Record<string, unknown> = { provider: 'blofin' };
    updates.symbol = merged.symbol.toUpperCase();
    updates.timeframe = merged.timeframe;
    updates.leverage = merged.leverage;
    updates.tpPct = merged.tpPct;
    updates.slPct = merged.slPct;
    updates.positionSizeUsdt = merged.positionSizeUsdt;
    updates.strategy = merged.strategy;
    if (body.mode === 'demo' || body.mode === 'live') updates.mode = body.mode;
    if (body.marginCurrency === 'USDT' || body.marginCurrency === 'USDC') updates.marginCurrency = body.marginCurrency;
    if (body.marginMode === 'cross' || body.marginMode === 'isolated') updates.marginMode = body.marginMode;
    if (typeof body.emaPeriod === 'number' && body.emaPeriod >= 1 && body.emaPeriod <= 500) updates.emaPeriod = body.emaPeriod;
    if (typeof body.fastMA === 'number' && body.fastMA >= 1 && body.fastMA <= 100) updates.fastMA = body.fastMA;
    if (typeof body.slowMA === 'number' && body.slowMA >= 1 && body.slowMA <= 200) updates.slowMA = body.slowMA;
    if (typeof body.rsiPeriod === 'number' && body.rsiPeriod >= 2 && body.rsiPeriod <= 50) updates.rsiPeriod = body.rsiPeriod;
    const updated = await db.tradingBot.update({
      where: { id: bot.id },
      data: updates,
    });
    return NextResponse.json({
      success: true,
      config: {
        provider: (updated as { provider?: string }).provider ?? 'blofin',
        symbol: updated.symbol,
        timeframe: updated.timeframe,
        leverage: updated.leverage,
        tpPct: updated.tpPct,
        slPct: updated.slPct,
        mode: updated.mode,
        marginCurrency: updated.marginCurrency ?? 'USDT',
        marginMode: (updated as { marginMode?: string }).marginMode ?? 'cross',
        positionSizeUsdt: updated.positionSizeUsdt ?? 50,
        strategy: (updated as { strategy?: string }).strategy ?? 'simple',
        emaPeriod: (updated as { emaPeriod?: number }).emaPeriod ?? 200,
        fastMA: (updated as { fastMA?: number }).fastMA ?? 9,
        slowMA: (updated as { slowMA?: number }).slowMA ?? 21,
        rsiPeriod: (updated as { rsiPeriod?: number }).rsiPeriod ?? 14,
        enabled: updated.enabled,
        lastRunAt: updated.lastRunAt?.toISOString() ?? null,
        lastError: updated.lastError ?? null,
        lastDecision: (updated as { lastDecision?: string | null }).lastDecision ?? null,
        lastDecisionMsg: (updated as { lastDecisionMsg?: string | null }).lastDecisionMsg ?? null,
        lastDecisionReason: (updated as { lastDecisionReason?: string | null }).lastDecisionReason ?? null,
      },
    });
  } catch (e) {
    console.error('Admin trading-bot PATCH:', e);
    return NextResponse.json({ success: false, error: 'Failed to update config.' }, { status: 500 });
  }
}

/** POST - Start or stop bot (owner only). Body: { action: 'start' | 'stop' }. Validates config and Blofin before start. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const action = body.action === 'start' ? 'start' : body.action === 'stop' ? 'stop' : null;
    if (!action) {
      return NextResponse.json({ success: false, error: 'Body must include { action: "start" | "stop" }' }, { status: 400 });
    }
    let bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!bot) {
      bot = await db.tradingBot.create({
        data: { provider: 'blofin', symbol: 'BTC', timeframe: '15m', leverage: 5, tpPct: 2, slPct: 1, mode: 'demo', marginCurrency: 'USDT', positionSizeUsdt: 50, enabled: false },
      });
    }
    const enabled = action === 'start';
    if (enabled) {
      const provider = ((bot as { provider?: string }).provider ?? 'blofin').toLowerCase();
      if (provider !== 'blofin') {
        return NextResponse.json({ success: false, error: 'Only Blofin is supported. Config must use Blofin.' }, { status: 400 });
      }
      if (!isBlofinConfigured()) {
        return NextResponse.json({
          success: false,
          error: 'Blofin API keys not set. Set BLOFIN_API_KEY, BLOFIN_SECRET_KEY, BLOFIN_PASSPHRASE in your server env (e.g. Vercel), then redeploy.',
        }, { status: 400 });
      }
      const validationError = validateConfig({
        symbol: bot.symbol,
        timeframe: bot.timeframe,
        leverage: bot.leverage,
        tpPct: bot.tpPct,
        slPct: bot.slPct,
        positionSizeUsdt: bot.positionSizeUsdt ?? 50,
        strategy: (bot as { strategy?: string }).strategy,
        emaPeriod: (bot as { emaPeriod?: number }).emaPeriod,
        fastMA: (bot as { fastMA?: number }).fastMA,
        slowMA: (bot as { slowMA?: number }).slowMA,
        rsiPeriod: (bot as { rsiPeriod?: number }).rsiPeriod,
      });
      if (validationError) {
        return NextResponse.json({ success: false, error: validationError }, { status: 400 });
      }
    }
    await db.tradingBot.update({
      where: { id: bot.id },
      data: { enabled, lastError: enabled ? null : bot.lastError },
    });
    // TODO: Trigger worker/cron when enabled=true; stop when enabled=false
    return NextResponse.json({ success: true, enabled });
  } catch (e) {
    console.error('Admin trading-bot POST:', e);
    return NextResponse.json({ success: false, error: 'Failed to update bot state.' }, { status: 500 });
  }
}
