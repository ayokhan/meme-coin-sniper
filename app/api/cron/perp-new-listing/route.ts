import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUniverseSymbols } from "@/lib/api-clients/hyperliquid";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEED_OFFSET_DAYS = 8;

/**
 * Cron-only: Check Hyperliquid universe for new perps; send Telegram for each new listing.
 * Run every 1–2 min (e.g. */2 * * * *) for instant alerts. Uses existing KnownPerpSymbol.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const universe = await getUniverseSymbols();
    if (universe.length === 0) {
      return NextResponse.json({ success: true, newListings: 0, message: "No universe" });
    }

    const count = await (prisma as any).knownPerpSymbol.count();
    const now = new Date();
    const seedCutoff = new Date(now.getTime() - SEED_OFFSET_DAYS * 24 * 60 * 60 * 1000);

    let newSymbols: string[] = [];

    if (count === 0) {
      await (prisma as any).knownPerpSymbol.createMany({
        data: universe.map((symbol: string) => ({ symbol, firstSeenAt: seedCutoff })),
        skipDuplicates: true,
      });
      // Don't alert on initial seed
    } else {
      const existing = await (prisma as any).knownPerpSymbol.findMany({
        where: { symbol: { in: universe } },
        select: { symbol: true },
      });
      const existingSet = new Set(existing.map((r: { symbol: string }) => r.symbol));
      newSymbols = universe.filter((s: string) => !existingSet.has(s));
      if (newSymbols.length > 0) {
        await (prisma as any).knownPerpSymbol.createMany({
          data: newSymbols.map((symbol: string) => ({ symbol })),
          skipDuplicates: true,
        });
      }
    }

    let sent = 0;
    for (const symbol of newSymbols) {
      const text = `🆕 <b>New perp listed</b>: ${symbol}\n🔗 <a href="https://app.hyperliquid.xyz/trade/${symbol}">Trade on Hyperliquid</a>`;
      const ok = await sendTelegramMessage(text);
      if (ok) sent++;
      await new Promise((r) => setTimeout(r, 300));
    }

    return NextResponse.json({
      success: true,
      newListings: newSymbols.length,
      sent,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Perp new listing check failed";
    console.error("Cron perp-new-listing:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
