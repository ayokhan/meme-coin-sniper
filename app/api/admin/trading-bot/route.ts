import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, canAccessTradingBot } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isBlofinConfigured } from '@/lib/blofin';
import { isCoinbaseConfigured } from '@/lib/coinbase';
import {
  parseMonitorTpTargetsJson,
  parseMonitorTpAmountsJson,
  parseMonitorDeepTimeframesJson,
  serializeMonitorDeepTimeframes,
} from '@/lib/trading-bot-run';

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
    if (!canAccessTradingBot(session)) {
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
        sizeMode: (bot as { sizeMode?: string }).sizeMode === 'contracts' ? 'contracts' : 'margin',
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
        monitorSymbols: (bot as { monitorSymbols?: string | null }).monitorSymbols
          ? String((bot as { monitorSymbols: string }).monitorSymbols).split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
        aiMonitorAutopilot: (bot as { aiMonitorAutopilot?: boolean }).aiMonitorAutopilot ?? false,
        monitorTpTargets: parseMonitorTpTargetsJson((bot as { monitorTpTargetsJson?: string | null }).monitorTpTargetsJson),
        monitorTpAmountsQuote: parseMonitorTpAmountsJson((bot as { monitorTpTargetsJson?: string | null }).monitorTpTargetsJson),
        monitorDeepTimeframes: parseMonitorDeepTimeframesJson(
          (bot as { monitorDeepTimeframesJson?: string | null }).monitorDeepTimeframesJson
        ),
        aiMonitorRunDeepEachCycle: (bot as { aiMonitorRunDeepEachCycle?: boolean }).aiMonitorRunDeepEachCycle ?? false,
        aiMonitorDeepCheckAutopilot: (bot as { aiMonitorDeepCheckAutopilot?: boolean }).aiMonitorDeepCheckAutopilot ?? false,
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
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: 'Owner only.' }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    if (body.provider && !['blofin', 'coinbase'].includes(body.provider)) {
      return NextResponse.json({ success: false, error: 'Provider must be blofin or coinbase.' }, { status: 400 });
    }
    let bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!bot) {
      bot = await db.tradingBot.create({
        data: { provider: 'blofin', symbol: 'BTC', timeframe: '15m', leverage: 5, tpPct: 2, slPct: 1, mode: 'demo', marginCurrency: 'USDT', positionSizeUsdt: 50, enabled: false },
      });
    }
    const targetProvider = (body.provider ?? (bot as { provider?: string }).provider ?? 'blofin').toLowerCase();
    if (targetProvider === 'coinbase' && !isCoinbaseConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Coinbase API keys not set. Set COINBASE_API_KEY_NAME and COINBASE_API_SECRET in your server env (e.g. Vercel), then redeploy.',
      }, { status: 400 });
    }
    if (targetProvider === 'blofin' && !isBlofinConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Blofin API keys not set. Set BLOFIN_API_KEY, BLOFIN_SECRET_KEY, BLOFIN_PASSPHRASE in your server env (e.g. Vercel), then redeploy.',
      }, { status: 400 });
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
    const updates: Record<string, unknown> = { provider: targetProvider };
    updates.symbol = merged.symbol.toUpperCase();
    updates.timeframe = merged.timeframe;
    updates.leverage = merged.leverage;
    updates.tpPct = merged.tpPct;
    updates.slPct = merged.slPct;
    updates.positionSizeUsdt = merged.positionSizeUsdt;
    updates.sizeMode =
      targetProvider === 'coinbase' && body.sizeMode === 'contracts' ? 'contracts' : 'margin';
    updates.strategy = merged.strategy;
    if (body.mode === 'demo' || body.mode === 'live') updates.mode = body.mode;
    if (body.marginCurrency === 'USDT' || body.marginCurrency === 'USDC') updates.marginCurrency = body.marginCurrency;
    if (body.marginMode === 'cross' || body.marginMode === 'isolated') updates.marginMode = body.marginMode;
    if (typeof body.emaPeriod === 'number' && body.emaPeriod >= 1 && body.emaPeriod <= 500) updates.emaPeriod = body.emaPeriod;
    if (typeof body.fastMA === 'number' && body.fastMA >= 1 && body.fastMA <= 100) updates.fastMA = body.fastMA;
    if (typeof body.slowMA === 'number' && body.slowMA >= 1 && body.slowMA <= 200) updates.slowMA = body.slowMA;
    if (typeof body.rsiPeriod === 'number' && body.rsiPeriod >= 2 && body.rsiPeriod <= 50) updates.rsiPeriod = body.rsiPeriod;
    if (Array.isArray(body.monitorSymbols)) {
      updates.monitorSymbols = body.monitorSymbols.map((s: string) => String(s).trim()).filter(Boolean).join(',') || null;
    } else if (body.monitorSymbols === null || body.monitorSymbols === undefined) {
      // leave unchanged
    } else {
      updates.monitorSymbols = String(body.monitorSymbols).trim() || null;
    }
    if (typeof body.aiMonitorAutopilot === 'boolean') updates.aiMonitorAutopilot = body.aiMonitorAutopilot;
    if (typeof body.aiMonitorRunDeepEachCycle === 'boolean') updates.aiMonitorRunDeepEachCycle = body.aiMonitorRunDeepEachCycle;
    if (typeof body.aiMonitorDeepCheckAutopilot === 'boolean') updates.aiMonitorDeepCheckAutopilot = body.aiMonitorDeepCheckAutopilot;
    if (body.monitorTpTargetsJson !== undefined && body.monitorTpTargetsJson !== null) {
      if (typeof body.monitorTpTargetsJson === 'string') {
        const s = body.monitorTpTargetsJson.trim();
        if (s.length > 8000) {
          return NextResponse.json({ success: false, error: 'TP targets JSON is too long.' }, { status: 400 });
        }
        if (s.length === 0) {
          updates.monitorTpTargetsJson = null;
        } else {
          try {
            JSON.parse(s);
          } catch {
            return NextResponse.json({ success: false, error: 'monitorTpTargetsJson must be valid JSON.' }, { status: 400 });
          }
          updates.monitorTpTargetsJson = s;
        }
      } else if (typeof body.monitorTpTargetsJson === 'object') {
        updates.monitorTpTargetsJson = JSON.stringify(body.monitorTpTargetsJson);
      }
    }
    if (body.monitorDeepTimeframesJson !== undefined && body.monitorDeepTimeframesJson !== null) {
      if (typeof body.monitorDeepTimeframesJson === 'string') {
        const s = body.monitorDeepTimeframesJson.trim();
        if (s.length > 200) {
          return NextResponse.json({ success: false, error: 'Deep timeframes JSON is too long.' }, { status: 400 });
        }
        try {
          JSON.parse(s);
        } catch {
          return NextResponse.json({ success: false, error: 'monitorDeepTimeframesJson must be valid JSON.' }, { status: 400 });
        }
        updates.monitorDeepTimeframesJson = s.length ? s : null;
      } else if (Array.isArray(body.monitorDeepTimeframesJson) && body.monitorDeepTimeframesJson.length >= 2) {
        const ser = serializeMonitorDeepTimeframes(
          String(body.monitorDeepTimeframesJson[0]),
          String(body.monitorDeepTimeframesJson[1])
        );
        if (!ser) {
          return NextResponse.json(
            { success: false, error: 'Invalid deep check timeframes. Use two values from 15m through 1M.' },
            { status: 400 }
          );
        }
        updates.monitorDeepTimeframesJson = ser;
      }
    }
    if (Array.isArray(body.monitorDeepTimeframes) && body.monitorDeepTimeframes.length >= 2) {
      const ser = serializeMonitorDeepTimeframes(String(body.monitorDeepTimeframes[0]), String(body.monitorDeepTimeframes[1]));
      if (!ser) {
        return NextResponse.json(
          { success: false, error: 'Invalid deep check timeframes. Use two values from 15m through 1M.' },
          { status: 400 }
        );
      }
      updates.monitorDeepTimeframesJson = ser;
    }
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
        sizeMode: (updated as { sizeMode?: string }).sizeMode === 'contracts' ? 'contracts' : 'margin',
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
        monitorSymbols: (updated as { monitorSymbols?: string | null }).monitorSymbols
          ? (updated as { monitorSymbols: string }).monitorSymbols.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [],
        aiMonitorAutopilot: (updated as { aiMonitorAutopilot?: boolean }).aiMonitorAutopilot ?? false,
        monitorTpTargets: parseMonitorTpTargetsJson((updated as { monitorTpTargetsJson?: string | null }).monitorTpTargetsJson),
        monitorTpAmountsQuote: parseMonitorTpAmountsJson((updated as { monitorTpTargetsJson?: string | null }).monitorTpTargetsJson),
        monitorDeepTimeframes: parseMonitorDeepTimeframesJson(
          (updated as { monitorDeepTimeframesJson?: string | null }).monitorDeepTimeframesJson
        ),
        aiMonitorRunDeepEachCycle: (updated as { aiMonitorRunDeepEachCycle?: boolean }).aiMonitorRunDeepEachCycle ?? false,
        aiMonitorDeepCheckAutopilot: (updated as { aiMonitorDeepCheckAutopilot?: boolean }).aiMonitorDeepCheckAutopilot ?? false,
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
    if (!canAccessTradingBot(session)) {
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
      if (!['blofin', 'coinbase'].includes(provider)) {
        return NextResponse.json({ success: false, error: 'Config must use Blofin or Coinbase.' }, { status: 400 });
      }
      if (provider === 'coinbase' && !isCoinbaseConfigured()) {
        return NextResponse.json({
          success: false,
          error: 'Coinbase API keys not set. Set COINBASE_API_KEY_NAME and COINBASE_API_SECRET in your server env (e.g. Vercel), then redeploy.',
        }, { status: 400 });
      }
      if (provider === 'blofin' && !isBlofinConfigured()) {
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
    return NextResponse.json({
      success: true,
      enabled,
      cronNote: enabled
        ? "Enabled. Automated cycles run via /api/cron (daily) and /api/cron/trading-bot when scheduled on Vercel. Use Run now for an immediate cycle."
        : "Stopped. Cron will skip until you start again.",
    });
  } catch (e) {
    console.error('Admin trading-bot POST:', e);
    return NextResponse.json({ success: false, error: 'Failed to update bot state.' }, { status: 500 });
  }
}
