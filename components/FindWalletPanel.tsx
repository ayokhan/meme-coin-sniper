"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Copy, Check, ExternalLink } from "lucide-react";

type MatchRow = {
  wallet: string;
  side: string;
  amountUsd: number;
  diffPct: number;
  txHash: string;
  timestamp: string | null;
  poolName: string | null;
  networkId: string;
  explorerTxUrl: string | null;
  explorerWalletUrl: string | null;
  gmgnTokenUrl: string | null;
};

type SearchResult = {
  chain: string;
  contractAddress: string;
  symbol: string | null;
  queriedAmountUsd: number;
  side: string;
  tolerancePct: number;
  poolsSearched: number;
  tradesScanned: number;
  matches: MatchRow[];
};

function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function fmtUsd(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function FindWalletPanel({
  isVip,
  isOwner,
}: {
  isVip: boolean;
  isOwner: boolean;
}) {
  const [ca, setCa] = useState("");
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState<"buy" | "sell" | "any">("buy");
  const [tolerancePct, setTolerancePct] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const canUse = isOwner || isVip;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const search = async () => {
    setLoading(true);
    setError(null);
    setLocked(false);
    setResult(null);
    try {
      const res = await fetch("/api/wallet-tracker/find-wallet", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ca, amountUsd: amount, side, tolerancePct }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.locked) setLocked(true);
        setError(data.error || "Search failed");
        return;
      }
      setResult({
        chain: data.chain,
        contractAddress: data.contractAddress,
        symbol: data.symbol,
        queriedAmountUsd: data.queriedAmountUsd,
        side: data.side,
        tolerancePct: data.tolerancePct,
        poolsSearched: data.poolsSearched,
        tradesScanned: data.tradesScanned,
        matches: data.matches ?? [],
      });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!canUse) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">VIP required</p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Find Wallet matches a token CA and buy/sell size to the trader wallet — so you can copy the trade.
        </p>
        <Button asChild className="mt-6 bg-cyan-600 hover:bg-cyan-700 text-white">
          <a href="/subscribe">Upgrade to VIP</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Find Wallet</h3>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
          Paste a contract address and the buy/sell USD size from FOMO / CT. We search recent DEX trades and return
          matching wallet IDs + tx hashes so you can copy the trade.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Contract address (CA)</span>
              <input
                value={ca}
                onChange={(e) => setCa(e.target.value)}
                placeholder="0x… or Solana mint"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Amount (USD)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="49.3K or 49300"
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Side</span>
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as "buy" | "sell" | "any")}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="any">Any</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Tolerance ±%</span>
              <select
                value={tolerancePct}
                onChange={(e) => setTolerancePct(Number(e.target.value))}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              >
                <option value={5}>5%</option>
                <option value={10}>10%</option>
                <option value={15}>15%</option>
                <option value={25}>25%</option>
              </select>
            </label>
          </div>
          <Button
            type="button"
            disabled={loading || !ca.trim() || !amount.trim()}
            onClick={() => void search()}
            className="gap-1.5"
          >
            <Search className="h-4 w-4" />
            {loading ? "Searching…" : "Find wallet"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Uses recent pool trades (typically last ~24h). Example: CA + <span className="font-mono">49.3K</span> buy.
          </p>
        </CardContent>
      </Card>

      {error && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            locked
              ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
              : "border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 text-red-700 dark:text-red-300"
          }`}
        >
          {error}
          {locked && (
            <a href="/subscribe" className="ml-2 underline font-medium">
              Upgrade to VIP
            </a>
          )}
        </div>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Results
              {result.symbol ? ` · ${result.symbol}` : ""} · {result.chain} · queried {fmtUsd(result.queriedAmountUsd)}{" "}
              {result.side}
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Scanned {result.tradesScanned} trades across {result.poolsSearched} pool
              {result.poolsSearched === 1 ? "" : "s"} (±{result.tolerancePct}%).
            </p>
          </CardHeader>
          <CardContent>
            {result.matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No matches in recent trades. Widen tolerance, switch side to Any, or try again after the trade indexes.
              </p>
            ) : (
              <ul className="space-y-2">
                {result.matches.map((m) => (
                  <li
                    key={`${m.txHash}-${m.wallet}`}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 px-3 py-2.5 space-y-1.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          m.side === "buy"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                            : m.side === "sell"
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25"
                              : "bg-zinc-200 text-zinc-700 border-zinc-300"
                        }`}
                      >
                        {m.side.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold">{fmtUsd(m.amountUsd)}</span>
                      <span className="text-xs text-muted-foreground">Δ {m.diffPct.toFixed(1)}%</span>
                      <span className="text-xs text-muted-foreground ml-auto">{fmtTime(m.timestamp)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-mono break-all">{m.wallet}</code>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-zinc-200/80 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
                        onClick={() => void copy(m.wallet, m.wallet)}
                      >
                        {copied === m.wallet ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copied === m.wallet ? "Copied" : "Copy wallet"}
                      </button>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        Tx <span className="font-mono">{shortAddr(m.txHash)}</span>
                      </span>
                      {m.poolName && <span>{m.poolName}</span>}
                      <span className="uppercase">{m.networkId}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <button
                        type="button"
                        className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 inline-flex items-center gap-1"
                        onClick={() => void copy(m.txHash, m.txHash)}
                      >
                        {copied === m.txHash ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        Copy tx
                      </button>
                      {m.explorerWalletUrl && (
                        <a
                          href={m.explorerWalletUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 inline-flex items-center gap-1"
                        >
                          Explorer <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {m.explorerTxUrl && (
                        <a
                          href={m.explorerTxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 inline-flex items-center gap-1"
                        >
                          Tx <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {m.gmgnTokenUrl && (
                        <a
                          href={m.gmgnTokenUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 inline-flex items-center gap-1"
                        >
                          GMGN <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
