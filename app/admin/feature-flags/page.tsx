"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

const FLAG_LABELS: Record<string, { label: string; description: string }> = {
  moralis_go_hunting: {
    label: "Go Hunting (Moralis)",
    description: "Use Moralis for New pairs and Scan fallback. When OFF, no Moralis API calls for Go Hunting or Scan.",
  },
  moralis_wallet_tracker: {
    label: "Wallet Tracker (Moralis)",
    description: "Use Moralis for wallet alerts and live trades. When OFF, only Helius/Birdeye are used (saves CPU).",
  },
  live_trades_enabled: {
    label: "Live trades (Wallet Tracker)",
    description: "Fetch and show live trades from tracked wallets. When OFF, no calls to trades API (saves Moralis). Alerts still work.",
  },
  telegram_wallet_alerts: {
    label: "Telegram wallet alerts",
    description: "Send wallet alerts to Telegram when cron runs. When OFF, cron still runs but does not send messages.",
  },
  telegram_wallet_alerts_viral_gt_70: {
    label: "Wallet alerts: viralScore > 70",
    description: "When ON, Wallet Tracker Telegram alerts only send when viralScore is greater than 70 (otherwise > 60).",
  },
  telegram_token_scan_alerts: {
    label: "CT Scan / scan token alerts (Telegram)",
    description: "When OFF, CT Scan / scan endpoints do not send token alerts to Telegram.",
  },

  page_tab_new: {
    label: "Tab: Go Hunting",
    description: "Show/hide the Go Hunting tab in the main GUI.",
  },
  page_tab_trending: {
    label: "Tab: Trending",
    description: "Show/hide the Trending tab in the main GUI.",
  },
  page_tab_surge: {
    label: "Tab: Surge",
    description: "Show/hide the Surge tab in the main GUI.",
  },
  page_tab_transactions: {
    label: "Tab: Transactions",
    description: "Show/hide the Transactions tab in the main GUI.",
  },
  page_tab_ai_analysis: {
    label: "Tab: NovaStaris AI Agent",
    description: "Show/hide the NovaStaris AI Agent tab in the main GUI.",
  },
  page_tab_futures: {
    label: "Tab: Crypto Futures",
    description: "Show/hide the Crypto Futures tab in the main GUI.",
  },
  page_tab_trending_perps: {
    label: "Tab: Trending perps",
    description: "Show/hide the Trending perps tab in the main GUI.",
  },
  page_tab_perp_radar: {
    label: "Tab: Perp Radar",
    description: "Show/hide the Perp Radar tab in the main GUI.",
  },
  page_tab_narratives: {
    label: "Tab: Narratives",
    description: "Show/hide the Narratives tab in the main GUI.",
  },
  page_tab_trading_bot: {
    label: "Tab: NovaStaris AI Trading Bot",
    description: "Show/hide the AI Trading Bot tab in the main GUI.",
  },
  page_tab_ct: {
    label: "Tab: CT Scan",
    description: "Show/hide the CT Scan tab in the main GUI.",
  },
  page_tab_wallets: {
    label: "Tab: Wallet Tracker",
    description: "Show/hide the Wallet Tracker tab in the main GUI.",
  },
  page_tab_coach_calls: {
    label: "Tab: Coach Calls + Telegram Signals",
    description: "Show/hide the Coach Calls + Telegram Signals tab in the main GUI.",
  },
  page_tab_nova_forecast: {
    label: "Tab: NovaForecast Agent",
    description: "Show/hide the NovaForecast Agent tab in the main GUI.",
  },
  page_tab_nova_plus: {
    label: "Tab: Nova+",
    description: "Show/hide the Nova+ tab (VIP-only risk-managed trade analysis) in the main GUI.",
  },
  page_tab_meme_intelligence: {
    label: "Tab: Nova Meme Intelligence",
    description: "Show/hide the Nova Meme Intelligence tab (VIP-only meme TA workspace) in the main GUI.",
  },
  page_tab_nova_investment_agent: {
    label: "Tab: Nova Investment Agent",
    description: "Show/hide the Nova Investment Agent tab (VIP-only) in the main GUI.",
  },
  page_tab_bsc: {
    label: "Tab: BSC",
    description: "Show/hide the BSC tab in the main GUI.",
  },
  page_tab_watchlist: {
    label: "Tab: Watchlist",
    description: "Show/hide the Watchlist tab in the main GUI.",
  },
  page_tab_nova_connect: {
    label: "Tab: NovaConnect",
    description: "Show/hide the NovaConnect tab in the main GUI.",
  },
  page_tab_chris_clayton: {
    label: "Tab: Online Boss Strategy",
    description: "Show/hide the Online Boss Strategy tab (owner-only) in the main GUI.",
  },
  owner_first_buy_alerts: {
    label: "First buy alerts (owner only)",
    description: "Notify in-app and Telegram the first time a tracked wallet buys a coin. No repeat alerts for same wallet+token.",
  },
  telegram_leverage_alerts: {
    label: "Telegram Top Leverage Traders alerts",
    description: "Send Telegram when an alert-enabled leverage wallet changes positions (cron). Toggle per wallet in Nova Admin → Leverage Wallet Tracker.",
  },
  digest_to_newsletter_subscribers: {
    label: "Send digest to newsletter subscribers",
    description: "When ON, the perp digest is also emailed to users who opted in at registration. When OFF, digest goes only to Telegram and DIGEST_EMAIL_TO.",
  },
  nova_connect: {
    label: "NovaConnect (social portal)",
    description: "Enable the NovaConnect tab (social feed + community rules). When OFF, the NovaConnect tab is hidden for all users.",
  },
  nova_scalper_cron: {
    label: "NovaScalper overnight automation",
    description:
      "When ON, the server’s daily maintenance job also advances NovaScalper for every user who has it enabled (one batch per day on typical hosting). When OFF, that pass is skipped—users still get ticks when they use Check price or leave the tab open with auto tick. Advanced: on Pro hosting you can add more frequent scheduled calls to /api/cron/nova-scalper if needed.",
  },
  nova_polymarket_tracker: {
    label: "Nova Polymarket Tracker",
    description:
      "When ON, VIP users with Nova Polymarket Pro (on demand) see the Nova Polymarket Tracker subtab and APIs work. When OFF, the tracker is hidden and list/activity routes return disabled. Admin wallet list: Nova Admin → Polymarket Tracker.",
  },
  nova_polymarket_copy_bot: {
    label: "Nova Polymarket Copy Trading Bot",
    description:
      "When ON, eligible VIP users see the Copy trading bot subtab under Nova Polymarket Pro (analyze any proxy wallet, wire into Copilot). Requires Nova Polymarket Tracker access. Default OFF until you enable it.",
  },
  nova_polymarket_leaderboard: {
    label: "Nova Polymarket Leaderboard",
    description:
      "When ON, eligible VIP users see the Leaderboard subtab under Nova Polymarket Pro (trader rankings + biggest wins from Polymarket’s public data API). Requires Nova Polymarket Tracker access. Default OFF until you enable it.",
  },
  nova_polymarket_five_mins: {
    label: "Nova 5 mins (Polymarket Pro)",
    description:
      "When ON, eligible VIP users see the Nova 5 mins subtab under Nova Polymarket Pro (short-horizon Up/Down-style AI context from spot candles + optional browser alerts on signal flips). Requires Nova Polymarket Tracker access. Default OFF until you enable it.",
  },
  nova_eagle: {
    label: "Nova Eagle (Crypto Futures)",
    description:
      "When ON, VIP users see the Nova Eagle subtab under Crypto Futures: large positions from Top Leverage Traders wallets, wallet copy for tracker, and skew heuristics (optional AI summary). Default OFF until you enable it.",
  },
  nova_crypto_buddie: {
    label: "Crypto Buddie (Crypto Futures)",
    description:
      "When ON, VIP users see the Crypto Buddie subtab: ranked perps for short-horizon style reads plus optional Sol/BSC AI monitor polling. Default OFF until you enable it.",
  },
  nova_liquidation_map: {
    label: "Liquidation Map (Crypto Futures)",
    description:
      "When ON, VIP users see the Liquidation Map subtab under Crypto Futures (symbol search for BTC/ETH/SOL/XAU-style contracts, liquidity zones, stop/liquidation clusters, and AI trade area guidance). Default OFF until you enable it.",
  },
  nova_futures_narratives: {
    label: "Nova Futures Narratives",
    description:
      "When ON, VIP users see the standalone Nova Futures Narratives tab (headline + CFTC institutional narrative read). Default OFF until you enable it.",
  },
  nova_meme_intelligence: {
    label: "Nova Meme Intelligence",
    description:
      "When ON, VIP users see the Nova Meme Intelligence tab with meme-focused technical analysis tools. Default OFF until you enable it.",
  },
  nova_q_memes: {
    label: "NovaQ - Memes",
    description:
      "When ON, VIP users can use NovaQ - Memes for support/resistance, market structure, trendline, liquidity reads, and dead/downside warnings.",
  },
  nova_smart_memes: {
    label: "Nova Smart Analysis for Memes",
    description:
      "When ON, VIP users can run Nova Smart Analysis for Memes for entry/exit ideas, direction bias, trendline confidence, and risk notes.",
  },
  nova_top_meme_coins: {
    label: "Top Meme coins",
    description:
      "When ON, VIP users can access Top Meme coins to discover more stable, liquid meme coins with filters against honeypots and weak setups.",
  },
  nova_meme_price_factor: {
    label: "Meme Price Factor",
    description:
      "When ON, VIP users can access Meme Price Factor under Nova Meme Intelligence to analyze high/low market-cap bands and touch counts by timeframe for Solana/BSC contracts.",
  },
  nova_perp_wallet_analyst: {
    label: "Nova Perp Wallet Analyst Agent (Wallet Tracker)",
    description:
      "When ON, UVIP users (VIP + Nova Ultimate enabled) and owner see this Wallet Tracker subtab to analyze a pasted perp wallet, review open positions and win/loss profile, and add wallets to personal/global lists.",
  },
  nova_meme_leaderboard: {
    label: "Meme Leaderboard (Wallet Tracker)",
    description:
      "When ON, eligible Meme Coins Traders users see the Meme Leaderboard subtab under Wallet Tracker: top tracked Solana wallets ranked by realized SOL flow, win-rate, volume and biggest wins. Uses free APIs only (Helius free tier + Dexscreener no-key). Owner can refresh snapshots; users can change period.",
  },
};

export default function AdminFeatureFlagsPage() {
  const { data: session, status } = useSession();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const load = () =>
    fetch("/api/admin/feature-flags")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setFlags(d.flags ?? {});
        else setError(d.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (status !== "authenticated") return;
    load();
  }, [status]);

  const handleToggle = async (key: string) => {
    const next = !flags[key];
    setToggling(key);
    setError("");
    setSuccessMessage("");
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: next }),
      });
      const data = await res.json();
      if (data.success) {
        setFlags(data.flags ?? {});
        setSuccessMessage(next ? "Turned on." : "Turned off.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setToggling(null);
    }
  };

  const isOwner = (session?.user as { isOwner?: boolean })?.isOwner ?? false;

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to manage feature flags."}
            {!session && (
              <p className="mt-2">
                <Link href="/signin" className="underline">Sign in</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            Owner only. Only owner emails (OWNER_EMAIL) can turn notifications and API usage on or off.
            <p className="mt-2">
              <Link href="/" className="underline">Back to app</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <div className="flex gap-2 mb-4">
          <Link href="/admin" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Nova Admin hub
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/admin/customers" className="text-sm text-muted-foreground hover:underline">
            Nova Admin — Customers
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/admin/wallet-tracker" className="text-sm text-muted-foreground hover:underline">
            Admin — Wallet Tracker
          </Link>
          {" · "}
          <Link href="/admin/leverage-wallet-tracker" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
            Leverage Wallet Tracker
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/admin/polymarket-tracker" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
            Polymarket Tracker
          </Link>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-medium">Nova Admin — Feature flags</span>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Feature flags</CardTitle>
            <p className="text-sm text-muted-foreground">
              Turn features on or off during testing. Only you (owner) can change these. When a feature is OFF, the related API calls or notifications are skipped.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {successMessage && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2">
                {successMessage}
              </div>
            )}
            {error && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <ul className="space-y-4">
                {Object.entries(FLAG_LABELS).map(([key, { label, description }]) => {
                  const enabled = flags[key] ?? true;
                  const busy = toggling === key;
                  return (
                    <li key={key} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{label}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${enabled ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                            {enabled ? "ON" : "OFF"}
                          </span>
                          <Button
                            size="sm"
                            variant={enabled ? "outline" : "default"}
                            onClick={() => handleToggle(key)}
                            disabled={busy}
                          >
                            {busy ? "…" : enabled ? "Turn off" : "Turn on"}
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 border-zinc-200 dark:border-zinc-800 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Moralis API usage</CardTitle>
            <p className="text-sm text-muted-foreground">
              Daily usage and limits are not shown in-app yet. Check your usage in the{" "}
              <a href="https://admin.moralis.io" target="_blank" rel="noopener noreferrer" className="underline text-cyan-600 dark:text-cyan-400 hover:no-underline">
                Moralis dashboard
              </a>
              . In-app usage display can be added when Moralis exposes a usage or quota API.
            </p>
          </CardHeader>
        </Card>

        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline">Back to app</Link>
        </p>
      </div>
    </div>
  );
}
