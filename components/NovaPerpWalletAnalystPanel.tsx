"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AnalyzeResponse = {
  success: boolean;
  error?: string;
  locked?: boolean;
  disabled?: boolean;
  isOwner?: boolean;
  address?: string;
  recommendation?: "copy" | "monitor" | "ignore";
  summary?: string;
  accountValueUsd?: number;
  metrics?: {
    winRate: number;
    wins: number;
    losses: number;
    closedTrades: number;
    openPositions: number;
    totalRealizedPnlUsd: number;
    avgRealizedPnlUsd: number;
    fillsSampled: number;
  };
  openPositions?: Array<{
    coin: string;
    side: "long" | "short";
    szi: string;
    entryPx: number;
    positionUsd: number;
    unrealizedPnlUsd: number;
    leverage: number | null;
    liquidationPx: number | null;
    openedAtMs: number | null;
  }>;
};

export default function NovaPerpWalletAnalystPanel() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<"tracker" | "global" | null>(null);

  const canAct = !!result?.success && !!result?.address;
  const recommendationBadge = useMemo(() => {
    if (!result?.recommendation) return null;
    if (result.recommendation === "copy") return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Good to copy</Badge>;
    if (result.recommendation === "monitor") return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Monitor</Badge>;
    return <Badge variant="destructive">Ignore</Badge>;
  }, [result?.recommendation]);

  const formatMoney = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return "—";
    return `$${Math.round(n).toLocaleString()}`;
  };

  const analyze = async () => {
    setLoading(true);
    setMessage(null);
    setResult(null);
    try {
      const res = await fetch("/api/wallet-tracker/nova-perp-wallet-analyst/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: address.trim() }),
      });
      const data = (await res.json()) as AnalyzeResponse;
      if (!res.ok || !data.success) {
        setResult(data);
        setMessage(data.error ?? "Failed to analyze wallet.");
        return;
      }
      setResult(data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to analyze wallet.");
    } finally {
      setLoading(false);
    }
  };

  const addToTracker = async () => {
    if (!result?.address) return;
    setActionBusy("tracker");
    setMessage(null);
    try {
      const res = await fetch("/api/user/leverage-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: result.address }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage(data?.error ?? "Failed to add wallet to tracker.");
        return;
      }
      setMessage("Wallet added to your Top Leverage Traders list.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to add wallet to tracker.");
    } finally {
      setActionBusy(null);
    }
  };

  const addToGlobal = async () => {
    if (!result?.address) return;
    setActionBusy("global");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/leverage-wallet-tracker/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address: result.address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const patch = await fetch("/api/admin/leverage-wallet-tracker/wallets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ address: result.address, global: true, active: true }),
        });
        const patchData = await patch.json().catch(() => ({}));
        if (!patch.ok || !patchData.success) {
          setMessage(data?.error ?? patchData?.error ?? "Failed to add wallet to global list.");
          return;
        }
      }
      setMessage("Wallet added to global tracker list.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to add wallet to global list.");
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Nova Perp Wallet Analyst Agent</h3>
        <p className="text-xs text-muted-foreground">
          Paste a perp wallet, analyze win/loss profile and open positions, then decide to copy, monitor, or ignore.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x... wallet address"
            className="font-mono text-sm border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 w-80 max-w-full"
          />
          <Button onClick={() => void analyze()} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze wallet"}
          </Button>
        </div>
        {message && <p className="text-xs text-zinc-600 dark:text-zinc-300">{message}</p>}
        {result && !result.success && result.error && (
          <p className="text-sm text-rose-600 dark:text-rose-400">{result.error}</p>
        )}
      </div>

      {result?.success && result.metrics && (
        <>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 font-mono">{result.address}</p>
              {recommendationBadge}
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{result.summary}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-zinc-700 dark:text-zinc-300">
              <p>Win rate: {result.metrics.winRate.toFixed(1)}%</p>
              <p>Wins/Losses: {result.metrics.wins}/{result.metrics.losses}</p>
              <p>Closed positions: {result.metrics.closedTrades}</p>
              <p>Open positions: {result.metrics.openPositions}</p>
              <p>Total realized PnL: {formatMoney(result.metrics.totalRealizedPnlUsd)}</p>
              <p>Avg realized PnL: {formatMoney(result.metrics.avgRealizedPnlUsd)}</p>
              <p>Account value: {formatMoney(result.accountValueUsd)}</p>
              <p>Sampled fills: {result.metrics.fillsSampled}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => void addToTracker()} disabled={!canAct || actionBusy === "tracker"}>
                {actionBusy === "tracker" ? "Adding..." : "Add to list"}
              </Button>
              {result.isOwner && (
                <Button variant="outline" size="sm" onClick={() => void addToGlobal()} disabled={!canAct || actionBusy === "global"}>
                  {actionBusy === "global" ? "Adding..." : "Add to global list"}
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
            <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">Open positions</h4>
            {(result.openPositions ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No open positions found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Coin</TableHead>
                      <TableHead className="text-xs">Side</TableHead>
                      <TableHead className="text-right text-xs">Size</TableHead>
                      <TableHead className="text-right text-xs">Entry</TableHead>
                      <TableHead className="text-right text-xs">Position $</TableHead>
                      <TableHead className="text-right text-xs">Unrealized PnL</TableHead>
                      <TableHead className="text-right text-xs">Leverage</TableHead>
                      <TableHead className="text-right text-xs">Liq</TableHead>
                      <TableHead className="text-xs">Opened (local)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(result.openPositions ?? []).map((p, i) => (
                      <TableRow key={`${p.coin}-${p.side}-${i}`}>
                        <TableCell className="font-mono text-xs">{p.coin}</TableCell>
                        <TableCell className="text-xs">
                          {p.side === "long" ? <span className="text-emerald-600 dark:text-emerald-400">Long</span> : <span className="text-rose-600 dark:text-rose-400">Short</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{p.szi}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatMoney(p.entryPx)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatMoney(p.positionUsd)}</TableCell>
                        <TableCell className={`text-right font-mono text-xs ${p.unrealizedPnlUsd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {formatMoney(p.unrealizedPnlUsd)}
                        </TableCell>
                        <TableCell className="text-right text-xs">{p.leverage != null ? `${p.leverage.toFixed(1)}x` : "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{p.liquidationPx != null ? formatMoney(p.liquidationPx) : "—"}</TableCell>
                        <TableCell className="text-xs">{p.openedAtMs ? new Date(p.openedAtMs).toLocaleString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
