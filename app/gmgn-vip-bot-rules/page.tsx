import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Zap } from "lucide-react";
import { GMGN_BOT_DEFAULTS } from "@/lib/gmgn-vip-bot-rules";

import { GMGN_BOT_DISPLAY_NAME } from "@/lib/gmgn-client-types";

export const metadata = {
  title: `${GMGN_BOT_DISPLAY_NAME} — Trading rules | NovaStaris`,
  description: `How the NovaStaris ${GMGN_BOT_DISPLAY_NAME} scans, filters, and executes trades.`,
};

export default function GmgnVipBotRulesPage() {
  const d = GMGN_BOT_DEFAULTS;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <Card className="border-violet-200 dark:border-violet-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              <CardTitle>{GMGN_BOT_DISPLAY_NAME} — trading rules</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Each VIP configures their own limits in the bot panel. Defaults below apply when you have not changed a
              setting. Not financial advice — meme tokens are extremely high risk.
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 space-y-5">
            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">What the bot does</h2>
              <p className="text-sm">
                The bot polls GMGN&apos;s <strong>1-hour trending</strong> list on the chains you enable (Solana, BSC,
                Robinhood). When a token passes your filters, it creates a <strong>signal</strong>. In{" "}
                <strong>semi-auto</strong> mode you approve or skip each signal. In <strong>full auto</strong> mode
                approved-sized buys run immediately after scan when credentials and wallet are set.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Entry filters (configurable)</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>
                  Token appears in GMGN 1h trending (top {d.trendingLimit} per chain per scan).
                </li>
                <li>
                  Minimum liquidity (when GMGN reports it): default <strong>${d.minLiquidityUsd.toLocaleString()}</strong>{" "}
                  — you can raise or lower this in your bot settings.
                </li>
                <li>
                  Minimum 1h price change: default <strong>+{d.minMomentum1hPct}%</strong> — configurable per user.
                </li>
                <li>
                  No duplicate signal for the same token + chain within <strong>{d.dedupeHours} hours</strong>.
                </li>
                <li>
                  Respects your <strong>max open trades</strong> (pending + approved signals; default {d.maxOpenTrades}
                  ).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Execution (configurable)</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>
                  <strong>Max trade (USD est.)</strong> — default ${d.maxTradeUsd}; converted to chain native amount for
                  the GMGN swap.
                </li>
                <li>
                  <strong>Slippage</strong> — default {d.slippagePct}% passed to GMGN on swap.
                </li>
                <li>
                  Requires a valid <strong>GMGN-bound wallet address</strong> (on-chain address, not email) and GMGN API
                  key + private key (stored encrypted, or platform-managed for the owner account).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Risk limits (stored per user)</h2>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>
                  <strong>Stop loss</strong> — default {d.stopLossPct}% (saved in your config; automated exit orders
                  are planned — currently entry-only).
                </li>
                <li>
                  <strong>Take profit</strong> — default {d.takeProfitPct}% (saved in your config; automated exit
                  orders are planned).
                </li>
                <li>
                  <strong>Max daily loss</strong> — default ${d.maxDailyLossUsd} (saved in your config; enforcement
                  planned).
                </li>
              </ul>
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-md px-3 py-2 mt-2">
                Today the bot executes <strong>market buys</strong> via GMGN. Stop-loss and take-profit percentages are
                saved for each user but are not yet attached as follow-up GMGN strategy orders. Monitor positions
                manually until exit automation ships.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Wallet addresses</h2>
              <p className="text-sm">
                Add one or more <strong>on-chain wallets</strong> bound to your GMGN API key in GMGN → API Management.
                Solana addresses are base58 (32–44 characters). BSC and Robinhood use EVM <code>0x…</code> addresses.
                If you trade both Solana and EVM chains, add both wallets — the bot picks the matching address per chain
                when executing. This is not your NovaStaris login email.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Disclaimer</h2>
              <p className="text-sm">
                Meme coins can go to zero. Slippage, failed txs, rugs, and exchange/API outages happen. You are
                responsible for keys, wallet funding, and tax reporting. See our{" "}
                <Link href="/terms" className="text-cyan-600 dark:text-cyan-400 underline">
                  Terms of Service
                </Link>
                .
              </p>
            </section>
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/?tab=gmgn-vip-bot" className="underline">
            Open {GMGN_BOT_DISPLAY_NAME}
          </Link>
          {" · "}
          <Link href="/" className="underline">
            Back to app
          </Link>
        </p>
      </div>
    </div>
  );
}
