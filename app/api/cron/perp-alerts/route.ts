import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUniverseSymbols } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";
import { getCandles as getBlofinCandles } from "@/lib/blofin";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SEED_OFFSET_DAYS = 8;
const TRIGGER_COOLDOWN_MS = 60 * 60 * 1000; // 1h before same alert can fire again

/** Get 5m % from latest candle (newest first). */
function get5mPct(candles: Array<[string, string, string, string, string, ...string[]]>): number | null {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return null;
  const open = Number(c[1]);
  const close = Number(c[4]);
  if (!open || open <= 0) return null;
  return ((close - open) / open) * 100;
}

/**
 * Cron-only: Evaluate perp alerts (new_listing, 5m_pct_above, 5m_pct_below) and send Telegram.
 * Called from main cron. Sends to main Telegram (broadcast).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = prisma as any;
    if (!db.perpAlert) {
      return NextResponse.json({ success: true, triggered: 0 });
    }

    const now = new Date();
    const cooldown = new Date(now.getTime() - TRIGGER_COOLDOWN_MS);
    const alerts = await db.perpAlert.findMany({
      where: {
        OR: [{ lastTriggeredAt: { lt: cooldown } }, { lastTriggeredAt: null }],
      },
      include: { user: { select: { email: true } } },
    });

    let triggered = 0;

    // New listing: sync universe, get newly added symbols this run
    const universe = await getUniverseSymbols();
    let newSymbols: string[] = [];
    if (universe.length > 0) {
      const count = await db.knownPerpSymbol.count();
      const seedCutoff = new Date(now.getTime() - SEED_OFFSET_DAYS * 24 * 60 * 60 * 1000);
      if (count > 0) {
        const existing = await db.knownPerpSymbol.findMany({
          where: { symbol: { in: universe } },
          select: { symbol: true },
        });
        const existingSet = new Set(existing.map((r: { symbol: string }) => r.symbol));
        newSymbols = universe.filter((s: string) => !existingSet.has(s));
        if (newSymbols.length > 0) {
          await db.knownPerpSymbol.createMany({
            data: newSymbols.map((symbol: string) => ({ symbol })),
            skipDuplicates: true,
          });
        }
      }
    }

    for (const symbol of newSymbols) {
      const newListingAlerts = alerts.filter((a: { alertType: string }) => a.alertType === "new_listing");
      for (const alert of newListingAlerts) {
        const text = `🔔 <b>Perp alert</b>: New listing <b>${symbol}</b>\n🔗 <a href="https://app.hyperliquid.xyz/trade/${symbol}">Trade</a>`;
        const ok = await sendTelegramMessage(text);
        if (ok) {
          await db.perpAlert.update({ where: { id: alert.id }, data: { lastTriggeredAt: now } });
          triggered++;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // 5m_pct_above / 5m_pct_below: Hyperliquid candles
    const pctAlerts = alerts.filter(
      (a: { alertType: string; venue?: string }) =>
        (a.alertType === "5m_pct_above" || a.alertType === "5m_pct_below") &&
        (a.venue ?? "hyperliquid") === "hyperliquid"
    );
    const symbolsToFetch = [...new Set(pctAlerts.map((a: { symbol: string | null }) => a.symbol).filter(Boolean))] as string[];
    for (const sym of symbolsToFetch.slice(0, 30)) {
      const candles = await getCandles(sym, "5m", 1);
      const pct = get5mPct(candles);
      if (pct == null) continue;
      for (const alert of pctAlerts.filter((a: { symbol: string | null }) => a.symbol === sym)) {
        const th = alert.threshold as number;
        const match =
          alert.alertType === "5m_pct_above"
            ? pct >= th
            : alert.alertType === "5m_pct_below"
              ? pct <= th
              : false;
        if (match) {
          const text = `🔔 <b>Perp alert</b>: <b>${sym}</b> 5m ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% ${alert.alertType === "5m_pct_above" ? "≥" : "≤"} ${th}%\n🔗 <a href="https://app.hyperliquid.xyz/trade/${sym}">Trade</a>`;
          const ok = await sendTelegramMessage(text);
          if (ok) {
            await db.perpAlert.update({ where: { id: alert.id }, data: { lastTriggeredAt: now } });
            triggered++;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }

    // Blofin 5m_pct_above / 5m_pct_below
    const blofinPctAlerts = alerts.filter(
      (a: { alertType: string; venue?: string }) =>
        (a.alertType === "blofin_5m_pct_above" || a.alertType === "blofin_5m_pct_below") ||
        ((a.alertType === "5m_pct_above" || a.alertType === "5m_pct_below") && a.venue === "blofin")
    );
    const blofinSymbols = [
      ...new Set(blofinPctAlerts.map((a: { symbol: string | null }) => a.symbol).filter(Boolean)),
    ] as string[];
    for (const sym of blofinSymbols.slice(0, 30)) {
      const instId = sym.includes("-") ? sym : `${sym}-USDT`;
      const candles = await getBlofinCandles(instId, "5m", 1);
      const pct = get5mPct(candles);
      if (pct == null) continue;
      for (const alert of blofinPctAlerts.filter((a: { symbol: string | null }) => a.symbol === sym)) {
        const th = alert.threshold as number;
        const isAbove = alert.alertType === "blofin_5m_pct_above" || alert.alertType === "5m_pct_above";
        const isBelow = alert.alertType === "blofin_5m_pct_below" || alert.alertType === "5m_pct_below";
        const match = isAbove ? pct >= th : isBelow ? pct <= th : false;
        if (match) {
          const base = sym.replace(/-USDT$/i, "");
          const text = `🔔 <b>Blofin perp alert</b>: <b>${base}/USDT</b> 5m ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% ${isAbove ? "≥" : "≤"} ${th}%\n🔗 <a href="https://www.blofin.com/futures/${base}-USDT">Trade</a>`;
          const ok = await sendTelegramMessage(text);
          if (ok) {
            await db.perpAlert.update({ where: { id: alert.id }, data: { lastTriggeredAt: now } });
            triggered++;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    }

    return NextResponse.json({ success: true, triggered });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Perp alerts evaluation failed";
    console.error("Cron perp-alerts:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
