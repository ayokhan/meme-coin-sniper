import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  earlyBreakoutDirection,
  formatEarlyBreakoutTelegram,
  scanBlofinEarlyBreakouts,
} from "@/lib/blofin-early-breakout";
import { sendTelegramMessage, isTelegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const COOLDOWN_MS = 45 * 60 * 1000; // 45 min per symbol+direction
const MAX_ALERTS_PER_RUN = 8;

async function isOnCooldown(venue: string, symbol: string, alertKey: string): Promise<boolean> {
  const db = prisma as any;
  if (!db.scanAlertCooldown) return false;
  const row = await db.scanAlertCooldown.findUnique({
    where: { venue_symbol_alertKey: { venue, symbol, alertKey } },
  });
  if (!row?.lastTriggeredAt) return false;
  return Date.now() - new Date(row.lastTriggeredAt).getTime() < COOLDOWN_MS;
}

async function markCooldown(venue: string, symbol: string, alertKey: string): Promise<void> {
  const db = prisma as any;
  if (!db.scanAlertCooldown) return;
  await db.scanAlertCooldown.upsert({
    where: { venue_symbol_alertKey: { venue, symbol, alertKey } },
    create: { venue, symbol, alertKey, lastTriggeredAt: new Date() },
    update: { lastTriggeredAt: new Date() },
  });
}

/**
 * Cron: scan Blofin USDT perps for early breakouts and send Telegram when subscribers exist.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json({ success: true, triggered: 0, skipped: "telegram_not_configured" });
    }

    const db = prisma as any;
    const hasSubscribers =
      db.perpAlert &&
      (await db.perpAlert.count({ where: { alertType: "blofin_early_breakout" } })) > 0;

    if (!hasSubscribers) {
      return NextResponse.json({ success: true, triggered: 0, skipped: "no_subscribers" });
    }

    const { items: matches, stale } = await scanBlofinEarlyBreakouts(25);
    let triggered = 0;
    const now = new Date();

    for (const item of matches) {
      if (triggered >= MAX_ALERTS_PER_RUN) break;
      const direction = earlyBreakoutDirection(item);
      if (!direction) continue;

      const alertKey = `early_breakout_${direction}`;
      if (await isOnCooldown("blofin", item.base, alertKey)) continue;

      const text = formatEarlyBreakoutTelegram(item, direction);
      const ok = await sendTelegramMessage(text);
      if (!ok) continue;

      await markCooldown("blofin", item.base, alertKey);
      triggered++;

      if (db.perpAlert) {
        const subs = await db.perpAlert.findMany({ where: { alertType: "blofin_early_breakout" } });
        for (const alert of subs) {
          await db.perpAlert.update({ where: { id: alert.id }, data: { lastTriggeredAt: now } });
        }
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    return NextResponse.json({ success: true, triggered, scanned: matches.length, stale });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Blofin early breakout cron failed";
    console.error("Cron blofin-early-breakout:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
