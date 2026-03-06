import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTrendingPerps, getPerpsByCoins } from "@/lib/api-clients/hyperliquid";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NEW_DAYS = 7;
const TOP_MOMENTUM = 8;
const TOP_NEW = 5;

/**
 * Cron-only: Send daily/2x daily perp digest to Telegram.
 * Hot new (7d) + top momentum. Called from main cron.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const newCutoff = new Date(now.getTime() - NEW_DAYS * 24 * 60 * 60 * 1000);

    const [trending, newRows] = await Promise.all([
      getTrendingPerps(TOP_MOMENTUM),
      (prisma as any).knownPerpSymbol?.findMany?.({
        where: { firstSeenAt: { gte: newCutoff } },
        select: { symbol: true },
        orderBy: { firstSeenAt: "desc" },
        take: TOP_NEW,
      }) ?? Promise.resolve([]),
    ]);

    const newSymbols = Array.isArray(newRows) ? newRows.map((r: { symbol: string }) => r.symbol) : [];
    let newPerps: { coin: string; dayPct: number }[] = [];
    if (newSymbols.length > 0) {
      newPerps = await getPerpsByCoins(newSymbols);
    }

    const momentumLine =
      trending.length > 0
        ? trending
            .slice(0, TOP_MOMENTUM)
            .map((p) => `${p.coin} ${p.dayPct >= 0 ? "+" : ""}${p.dayPct.toFixed(1)}%`)
            .join(" · ")
        : "—";
    const newLine =
      newPerps.length > 0
        ? newPerps
            .slice(0, TOP_NEW)
            .map((p) => `${p.coin} ${p.dayPct >= 0 ? "+" : ""}${p.dayPct.toFixed(1)}%`)
            .join(" · ")
        : "None in last 7d";

    const text = [
      "📊 <b>NovaStaris Perp Digest</b>",
      "",
      "🔥 <b>Hot new (7d):</b> " + newLine,
      "📈 <b>Top momentum (24h):</b> " + momentumLine,
      "",
      "🔗 <a href=\"https://app.hyperliquid.xyz\">Trade on Hyperliquid</a> · <a href=\"https://novastaris.ai\">NovaStaris</a>",
    ].join("\n");

    const ok = await sendTelegramMessage(text);
    return NextResponse.json({ success: ok });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Perp digest failed";
    console.error("Cron perp-digest:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
