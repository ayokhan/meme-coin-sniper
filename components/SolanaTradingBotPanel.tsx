"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";


type QuoteResult = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct?: string;
  otherAmountThreshold?: string;
};

export default function SolanaTradingBotPanel() {
  const [tokenMint, setTokenMint] = useState("");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100); // 1%
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);

  const isSolanaAddress = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test((s || "").trim());

  const getQuote = async () => {
    const mint = tokenMint.trim();
    if (!mint || !isSolanaAddress(mint)) {
      setError("Enter a valid Solana token mint address.");
      return;
    }
    const amountRaw = amount.trim();
    if (!amountRaw || Number.isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError(null);
    setQuote(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/solana-bot/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenMint: mint,
          direction,
          amount: amountRaw,
          slippageBps,
        }),
      });
      const data = await res.json();
      if (data.success && data.quote) {
        setQuote(data.quote);
      } else {
        setError(data.error ?? "Failed to get quote.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get quote.");
    } finally {
      setLoading(false);
    }
  };

  const jupiterSwapUrl = () => {
    const mint = tokenMint.trim();
    if (!mint) return "https://jup.ag";
    if (direction === "buy") {
      return `https://jup.ag/swap/SOL-${mint}${amount.trim() ? `?amount=${amount.trim()}` : ""}`;
    }
    return `https://jup.ag/swap/${mint}-SOL${amount.trim() ? `?amount=${amount.trim()}` : ""}`;
  };

  return (
    <div className="mx-6 py-8 max-w-2xl space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-500 bg-clip-text text-transparent dark:from-violet-300 dark:via-fuchsia-300 dark:to-violet-400">
        Solana Meme Coin Trading
      </h2>
      <p className="text-sm text-muted-foreground">
        Owner only. Powered by <strong className="text-zinc-800 dark:text-zinc-200">Jupiter</strong> for best execution on Solana meme coins. Sign with <strong className="text-zinc-800 dark:text-zinc-200">Phantom</strong> (or any Solana wallet) when you complete the swap on Jupiter. Use the form below to get a quote or open Jupiter with your parameters.
      </p>

      {error && (
        <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Swap setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Token mint (contract address)</label>
            <input
              type="text"
              placeholder="e.g. So111... or paste from DexScreener"
              value={tokenMint}
              onChange={(e) => { setTokenMint(e.target.value); setQuote(null); setError(null); }}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Direction</label>
            <select
              value={direction}
              onChange={(e) => { setDirection(e.target.value as "buy" | "sell"); setQuote(null); }}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="buy">Buy token (spend SOL)</option>
              <option value="sell">Sell token (receive SOL)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Amount ({direction === "buy" ? "SOL to spend" : "token amount"})</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder={direction === "buy" ? "e.g. 0.5" : "e.g. 1000000"}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setQuote(null); setError(null); }}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            {direction === "sell" && (
              <p className="text-xs text-muted-foreground mt-1">Token amount (many meme coins use 6 decimals; e.g. 1e6 = 1 token).</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Slippage (bps, 100 = 1%)</label>
            <input
              type="number"
              min={1}
              max={5000}
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-xs text-muted-foreground mt-1">100 bps = 1%. Meme coins often need 2–5% (200–500 bps).</p>
          </div>
          {quote && (
            <div className="rounded-lg border border-violet-200/80 dark:border-violet-800/80 bg-violet-50/50 dark:bg-violet-950/30 p-3 text-sm space-y-1">
              <p className="font-medium text-violet-800 dark:text-violet-200">Quote</p>
              <p className="text-zinc-700 dark:text-zinc-300">In: {quote.inAmount} → Out: {quote.outAmount}</p>
              {quote.priceImpactPct != null && <p className="text-muted-foreground">Price impact: {quote.priceImpactPct}%</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={getQuote}
              disabled={loading}
              className="bg-violet-500 hover:bg-violet-600 text-white dark:bg-violet-600 dark:hover:bg-violet-700"
            >
              {loading ? "Getting quote…" : "Get quote"}
            </Button>
            <Button
              variant="outline"
              className="border-violet-500 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/50"
              asChild
            >
              <a href={jupiterSwapUrl()} target="_blank" rel="noopener noreferrer">
                Open in Jupiter (sign with Phantom)
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        You will complete the swap on Jupiter. Connect your Phantom (or other Solana wallet) there to sign. NovaStaris does not hold your keys or execute trades for you.
      </p>
    </div>
  );
}
