import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, isOwnerSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

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
        data: { symbol: 'BTC', timeframe: '15m', leverage: 5, tpPct: 2, slPct: 1, mode: 'demo', marginCurrency: 'USDT', positionSizeUsdt: 50, enabled: false },
      });
    }
    return NextResponse.json({
      success: true,
      config: {
        symbol: bot.symbol,
        timeframe: bot.timeframe,
        leverage: bot.leverage,
        tpPct: bot.tpPct,
        slPct: bot.slPct,
        mode: bot.mode,
        marginCurrency: bot.marginCurrency ?? 'USDT',
        positionSizeUsdt: bot.positionSizeUsdt ?? 50,
        strategy: (bot as { strategy?: string }).strategy ?? 'simple',
        emaPeriod: (bot as { emaPeriod?: number }).emaPeriod ?? 200,
        fastMA: (bot as { fastMA?: number }).fastMA ?? 9,
        slowMA: (bot as { slowMA?: number }).slowMA ?? 21,
        rsiPeriod: (bot as { rsiPeriod?: number }).rsiPeriod ?? 14,
        enabled: bot.enabled,
        lastRunAt: bot.lastRunAt?.toISOString() ?? null,
        lastError: bot.lastError ?? null,
      },
    });
  } catch (e) {
    console.error('Admin trading-bot GET:', e);
    const message = e instanceof Error ? e.message : 'Failed to load config.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** PATCH - Update trading bot config (owner only). Body: { symbol?, timeframe?, leverage?, tpPct?, slPct?, mode? } */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    let bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!bot) {
      bot = await db.tradingBot.create({
        data: { symbol: 'BTC', timeframe: '15m', leverage: 5, tpPct: 2, slPct: 1, mode: 'demo', marginCurrency: 'USDT', positionSizeUsdt: 50, enabled: false },
      });
    }
    const updates: Record<string, unknown> = {};
    if (typeof body.symbol === 'string' && body.symbol.trim()) updates.symbol = body.symbol.trim().toUpperCase();
    if (typeof body.timeframe === 'string' && body.timeframe.trim()) updates.timeframe = body.timeframe.trim();
    if (typeof body.leverage === 'number' && body.leverage >= 1 && body.leverage <= 125) updates.leverage = body.leverage;
    if (typeof body.tpPct === 'number' && body.tpPct > 0 && body.tpPct <= 100) updates.tpPct = body.tpPct;
    if (typeof body.slPct === 'number' && body.slPct > 0 && body.slPct <= 100) updates.slPct = body.slPct;
    if (body.mode === 'demo' || body.mode === 'live') updates.mode = body.mode;
    if (body.marginCurrency === 'USDT' || body.marginCurrency === 'USDC') updates.marginCurrency = body.marginCurrency;
    if (typeof body.positionSizeUsdt === 'number' && body.positionSizeUsdt > 0 && body.positionSizeUsdt <= 1_000_000) updates.positionSizeUsdt = body.positionSizeUsdt;
    const validStrategies = ['simple', 'indicators', 'ai', 'hybrid'];
    if (typeof body.strategy === 'string' && validStrategies.includes(body.strategy)) updates.strategy = body.strategy;
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
        symbol: updated.symbol,
        timeframe: updated.timeframe,
        leverage: updated.leverage,
        tpPct: updated.tpPct,
        slPct: updated.slPct,
        mode: updated.mode,
        marginCurrency: updated.marginCurrency ?? 'USDT',
        positionSizeUsdt: updated.positionSizeUsdt ?? 50,
        strategy: (updated as { strategy?: string }).strategy ?? 'simple',
        emaPeriod: (updated as { emaPeriod?: number }).emaPeriod ?? 200,
        fastMA: (updated as { fastMA?: number }).fastMA ?? 9,
        slowMA: (updated as { slowMA?: number }).slowMA ?? 21,
        rsiPeriod: (updated as { rsiPeriod?: number }).rsiPeriod ?? 14,
        enabled: updated.enabled,
        lastRunAt: updated.lastRunAt?.toISOString() ?? null,
        lastError: updated.lastError ?? null,
      },
    });
  } catch (e) {
    console.error('Admin trading-bot PATCH:', e);
    return NextResponse.json({ success: false, error: 'Failed to update config.' }, { status: 500 });
  }
}

/** POST - Start or stop bot (owner only). Body: { action: 'start' | 'stop' } */
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
        data: { symbol: 'BTC', timeframe: '15m', leverage: 5, tpPct: 2, slPct: 1, mode: 'demo', marginCurrency: 'USDT', positionSizeUsdt: 50, enabled: false },
      });
    }
    const enabled = action === 'start';
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
