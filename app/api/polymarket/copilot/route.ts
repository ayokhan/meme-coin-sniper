import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import { isOwnerEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

type GammaMarket = {
  question?: string;
  volume?: number | string;
  liquidity?: number | string;
  endDate?: string;
  slug?: string;
  clobTokenIds?: string;
  outcomes?: string;
  outcomePrices?: string;
};
type DataTrade = {
  proxyWallet?: string;
  side?: "BUY" | "SELL";
  size?: number;
  price?: number;
  timestamp?: number;
  title?: string;
  slug?: string;
  outcome?: string;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function parseOutcomeState(m: GammaMarket): { bestOutcome: string; confidencePct: number; direction: "bullish" | "bearish" | "mixed" } {
  const outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) as string[] : [];
  const prices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices).map((x: string) => Number(x)) as number[] : [];
  if (!Array.isArray(outcomes) || !Array.isArray(prices) || outcomes.length === 0 || outcomes.length !== prices.length) {
    return { bestOutcome: "Unknown", confidencePct: 0, direction: "mixed" };
  }
  let idx = 0;
  for (let i = 1; i < prices.length; i++) if ((prices[i] ?? 0) > (prices[idx] ?? 0)) idx = i;
  const best = outcomes[idx] ?? "Unknown";
  const conf = Math.max(0, Math.min(100, Math.round((prices[idx] ?? 0) * 100)));
  const low = best.toLowerCase();
  let direction: "bullish" | "bearish" | "mixed" = "mixed";
  if (/\b(yes|up|rise|higher|increase|win|approve)\b/.test(low)) direction = "bullish";
  if (/\b(no|down|fall|lower|decrease|lose|reject)\b/.test(low)) direction = direction === "bullish" ? "mixed" : "bearish";
  return { bestOutcome: best, confidencePct: conf, direction };
}

export async function POST(request: Request) {
  try {
    const { tier, userId, session } = await getSessionAndSubscription();
    const owner = isOwnerEmail(session?.user?.email ?? null);
    const user = userId
      ? await (prisma as { user: { findUnique: (args: unknown) => Promise<{ polymarketBotOnDemand?: boolean } | null> } }).user.findUnique({
          where: { id: userId },
          select: { polymarketBotOnDemand: true },
        })
      : null;
    const polymarketEnabled = owner || (tier === "vip" && !!user?.polymarketBotOnDemand);
    if (!polymarketEnabled) {
      return NextResponse.json(
        { success: false, locked: true, error: "Nova Polymarket Bot is VIP on-demand. Ask admin to enable access." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const keyword = String(body.keyword ?? "").trim();
    const bankroll = n(body.bankroll);
    const mode = String(body.mode ?? "demo").toLowerCase() === "live" ? "live" : "demo";
    const walletConnected = !!body.walletConnected;
    const copyMode = String(body.copyMode ?? "exact").toLowerCase() === "exact" ? "exact" : "scaled";
    const walletsRaw = String(body.copyWallets ?? "");
    const wallets = walletsRaw
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (!keyword) {
      return NextResponse.json({ success: false, error: "Enter a market keyword (e.g. election, fed, bitcoin)." }, { status: 400 });
    }

    const url = `https://gamma-api.polymarket.com/markets?closed=false&active=true&limit=150`;
    const res = await fetch(url, { cache: "no-store" });
    const all = (await res.json().catch(() => [])) as GammaMarket[];
    const k = keyword.toLowerCase();
    const filtered = (Array.isArray(all) ? all : [])
      .filter((m) => (m.question ?? "").toLowerCase().includes(k))
      .sort((a, b) => (n(b.volume) + n(b.liquidity)) - (n(a.volume) + n(a.liquidity)))
      .slice(0, 8);

    const markets = filtered.map((m) => {
      const parsed = parseOutcomeState(m);
      return {
        question: m.question ?? "Untitled market",
        volume: n(m.volume),
        liquidity: n(m.liquidity),
        endDate: m.endDate ?? null,
        url: m.slug ? `https://polymarket.com/event/${m.slug}` : "https://polymarket.com",
        bestOutcome: parsed.bestOutcome,
        confidencePct: parsed.confidencePct,
        direction: parsed.direction,
      };
    });

    let bullish = 0;
    let bearish = 0;
    for (const m of markets) {
      if (m.direction === "bullish") bullish++;
      if (m.direction === "bearish") bearish++;
    }
    const direction: "bullish" | "bearish" | "mixed" = bullish === bearish ? "mixed" : bullish > bearish ? "bullish" : "bearish";

    const copyPlan = wallets.length > 0
      ? wallets.map((w, i) => ({
          wallet: w,
          allocationUsd: bankroll > 0 ? Math.round((bankroll * (copyMode === "exact" ? 0.85 : 0.7)) / wallets.length) : null,
          copyMode,
          note:
            copyMode === "exact"
              ? "Exact copy requested: mirror side and market; size is capped by your risk settings."
              : i < 2
                ? "Primary copy-trader slot"
                : "Secondary slot (reduced confidence)",
        }))
      : [];

    // Copy-trader signals (public Polymarket Data API trades per wallet).
    const signalsMap = new Map<string, {
      slug: string;
      title: string;
      outcome: string;
      buys: number;
      sells: number;
      wallets: Set<string>;
      score: number;
      url: string;
    }>();

    if (wallets.length > 0) {
      await Promise.all(wallets.map(async (w) => {
        try {
          const tRes = await fetch(`https://data-api.polymarket.com/trades?user=${encodeURIComponent(w)}&limit=40`, { cache: "no-store" });
          const trades = (await tRes.json().catch(() => [])) as DataTrade[];
          for (const t of Array.isArray(trades) ? trades : []) {
            const slug = String(t.slug ?? "").trim();
            if (!slug) continue;
            const key = `${slug}::${String(t.outcome ?? "Unknown")}`;
            const prev = signalsMap.get(key) ?? {
              slug,
              title: String(t.title ?? "Untitled market"),
              outcome: String(t.outcome ?? "Unknown"),
              buys: 0,
              sells: 0,
              wallets: new Set<string>(),
              score: 0,
              url: `https://polymarket.com/event/${slug}`,
            };
            if (t.side === "BUY") prev.buys += 1;
            if (t.side === "SELL") prev.sells += 1;
            prev.wallets.add(w);
            prev.score += n(t.size) * Math.max(0.01, n(t.price));
            signalsMap.set(key, prev);
          }
        } catch {
          // ignore failing wallet feed
        }
      }));
    }

    const copySignals = [...signalsMap.values()]
      .sort((a, b) => {
        const aStrength = (a.buys - a.sells) * 10 + a.wallets.size * 5 + a.score;
        const bStrength = (b.buys - b.sells) * 10 + b.wallets.size * 5 + b.score;
        return bStrength - aStrength;
      })
      .slice(0, 10)
      .map((s) => ({
        slug: s.slug,
        title: s.title,
        outcome: s.outcome,
        wallets: [...s.wallets],
        buys: s.buys,
        sells: s.sells,
        score: Number(s.score.toFixed(2)),
        url: s.url,
      }));

    return NextResponse.json({
      success: true,
      result: {
        keyword,
        direction,
        confidence: markets.length === 0 ? "low" : Math.max(bullish, bearish) >= 5 ? "high" : Math.max(bullish, bearish) >= 3 ? "medium" : "low",
        summary: markets.length === 0
          ? "No active Polymarket matches found for this keyword."
          : `Scanned ${markets.length} active markets for "${keyword}". Directional lean is ${direction} based on top-liquidity market pricing and Yes/No outcome skew.`,
        markets,
        institutionalHint: "Higher-liquidity markets usually reflect larger and more informed flow. Prioritize markets with deeper liquidity and tighter pricing.",
        copyPlan,
        copySignals,
        execution: {
          mode,
          walletConnected,
          ownerBypass: owner,
          readyForLive: mode === "live" && (walletConnected || owner),
          loginHint: walletConnected
            ? "Wallet connected. You can execute from NovaStaris when trading keys/session are active."
            : owner
              ? "Owner bypass is enabled. Live execution can run without wallet login."
              : "Connect your wallet to enable live order execution from NovaStaris.",
        },
        riskNote: "No bot can guarantee wins. Use strict sizing, diversify across uncorrelated events, and avoid all-in exposure.",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Polymarket copilot failed";
    console.error("polymarket/copilot:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

