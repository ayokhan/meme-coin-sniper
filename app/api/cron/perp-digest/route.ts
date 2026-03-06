import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTrendingPerps, getPerpsByCoins } from "@/lib/api-clients/hyperliquid";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmail } from "@/lib/send-email";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NEW_DAYS = 7;
const TOP_MOMENTUM = 8;
const TOP_NEW = 5;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Cron-only: Send daily perp digest to Telegram and optionally to email (DIGEST_EMAIL_TO).
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

    let telegramOk = await sendTelegramMessage(text);

    const html = [
      "<h2>NovaStaris Perp Digest</h2>",
      "<p><strong>Hot new (7d):</strong> " + escapeHtml(newLine) + "</p>",
      "<p><strong>Top momentum (24h):</strong> " + escapeHtml(momentumLine) + "</p>",
      "<p><a href=\"https://app.hyperliquid.xyz\">Trade on Hyperliquid</a> · <a href=\"https://novastaris.ai\">NovaStaris</a></p>",
    ].join("");

    // Optional: send same digest to email if DIGEST_EMAIL_TO is set (comma-separated addresses)
    const digestEmailTo = process.env.DIGEST_EMAIL_TO?.trim();
    let emailOk = false;
    if (digestEmailTo) {
      const toAddresses = digestEmailTo.split(",").map((e) => e.trim()).filter(Boolean);
      for (const to of toAddresses) {
        const sent = await sendEmail(to, "NovaStaris Perp Digest", html);
        if (sent) emailOk = true;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // If admin enabled "Send digest to newsletter subscribers", email all opted-in users
    const sendToSubscribers = await getFeatureFlag(FEATURE_FLAG_KEYS.DIGEST_TO_NEWSLETTER_SUBSCRIBERS);
    if (sendToSubscribers) {
      const subscribers = await (prisma as any).user.findMany({
        where: { newsletterOptIn: true, email: { not: null } },
        select: { email: true },
      });
      for (const u of subscribers) {
        const to = u.email!;
        const sent = await sendEmail(to, "NovaStaris Perp Digest", html);
        if (sent) emailOk = true;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return NextResponse.json({ success: telegramOk, emailSent: emailOk });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Perp digest failed";
    console.error("Cron perp-digest:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
