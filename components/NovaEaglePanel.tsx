"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type WhaleRow = {
  address: string;
  nickname: string | null;
  coin: string;
  side: "long" | "short";
  positionUsd: number;
  openedAtMs?: number;
  apexLiquidUrl: string;
  isGlobal: boolean;
};

type Agg = { coin: string; longUsd: number; shortUsd: number; whaleCount: number };
type NovaEagleMode = "tracked" | "global";
type WalletAnalysis = {
  summary: string;
  metrics: {
    winRate: number;
    wins: number;
    losses: number;
    closedTrades: number;
    openPositions: number;
    totalRealizedPnlUsd: number;
    avgRealizedPnlUsd: number;
    fillsSampled: number;
  };
};

export default function NovaEaglePanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minUsd, setMinUsd] = useState(500_000);
  const [mode, setMode] = useState<NovaEagleMode>("global");
  const [withAi, setWithAi] = useState(false);
  const [whales, setWhales] = useState<WhaleRow[]>([]);
  const [aggregates, setAggregates] = useState<Agg[]>([]);
  const [heuristics, setHeuristics] = useState<string[]>([]);
  const [aiBrief, setAiBrief] = useState<{ text: string; aiGenerated: boolean } | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [analysisByAddress, setAnalysisByAddress] = useState<Record<string, WalletAnalysis>>({});
  const [analysisOpenAddress, setAnalysisOpenAddress] = useState<string | null>(null);
  const [analysisLoadingAddress, setAnalysisLoadingAddress] = useState<string | null>(null);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ minUsd: String(minUsd), ai: withAi ? "1" : "0", mode });
      const res = await fetch(`/api/futures/nova-eagle?${qs}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.error ?? `Request failed (${res.status})`);
        setWhales([]);
        setAggregates([]);
        setHeuristics([]);
        setAiBrief(null);
        return;
      }
      setDisclaimer(data.disclaimer ?? "");
      setWhales(data.whales ?? []);
      setAggregates(data.aggregates ?? []);
      setHeuristics(data.heuristics ?? []);
      setAiBrief(data.aiBrief ?? null);
      setIsOwner(!!data.isOwner);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [minUsd, withAi, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyAddr = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const formatLocalDateTime = (ms?: number) => {
    if (!ms || !Number.isFinite(ms) || ms <= 0) return "—";
    return new Date(ms).toLocaleString();
  };

  const analyzeWallet = async (address: string) => {
    setAnalysisLoadingAddress(address);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/futures/nova-eagle/analyze-wallet?address=${encodeURIComponent(address)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionMessage(data?.error ?? "Failed to analyze wallet.");
        return;
      }
      setAnalysisByAddress((prev) => ({ ...prev, [address.toLowerCase()]: { summary: data.summary, metrics: data.metrics } }));
      setAnalysisOpenAddress(address.toLowerCase());
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to analyze wallet.");
    } finally {
      setAnalysisLoadingAddress(null);
    }
  };

  const addToTracker = async (address: string, nickname?: string | null) => {
    const key = `tracker:${address.toLowerCase()}`;
    setActionBusyKey(key);
    setActionMessage(null);
    try {
      const res = await fetch("/api/user/leverage-wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, nickname: nickname ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionMessage(data?.error ?? "Failed to add wallet to tracker.");
        return;
      }
      setActionMessage("Wallet added to your Top Leverage Traders tracker.");
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to add wallet to tracker.");
    } finally {
      setActionBusyKey(null);
    }
  };

  const addToGlobal = async (address: string, nickname?: string | null) => {
    const key = `global:${address.toLowerCase()}`;
    setActionBusyKey(key);
    setActionMessage(null);
    try {
      const res = await fetch("/api/admin/leverage-wallet-tracker/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, nickname: nickname ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        // If wallet already exists, ensure it's global + active.
        const patch = await fetch("/api/admin/leverage-wallet-tracker/wallets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ address, global: true, active: true }),
        });
        const patchData = await patch.json().catch(() => ({}));
        if (!patch.ok || !patchData.success) {
          setActionMessage(data?.error ?? patchData?.error ?? "Failed to add wallet to global tracker.");
          return;
        }
      }
      setActionMessage("Wallet added to global tracker list.");
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Failed to add wallet to global tracker.");
    } finally {
      setActionBusyKey(null);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 max-w-full space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Eagle</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Surfaces large open perp positions from a sampled top-wallet set. Use <strong className="text-zinc-700 dark:text-zinc-300">Global</strong> for live Apex top wallets (with fallback seed) plus your Top Leverage Traders (and platform global wallets) in one pass, or{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">Tracked</strong> for that list only. Copy an address into <strong className="text-zinc-700 dark:text-zinc-300">Wallet Tracker</strong> if you want alerts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground">Source</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value === "tracked" ? "tracked" : "global")}
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            <option value="global">Global + my tracked (beta)</option>
            <option value="tracked">My tracked wallets</option>
          </select>
          <label className="text-xs text-muted-foreground">Min position (USD)</label>
          <select
            value={minUsd}
            onChange={(e) => setMinUsd(Number(e.target.value))}
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
          >
            <option value={250000}>250k</option>
            <option value={500000}>500k</option>
            <option value={1000000}>1M</option>
            <option value={2000000}>2M</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={withAi} onChange={(e) => setWithAi(e.target.checked)} className="rounded" />
            AI summary
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {actionMessage && <p className="text-xs text-zinc-600 dark:text-zinc-300">{actionMessage}</p>}
      {disclaimer && <p className="text-[11px] text-muted-foreground leading-relaxed">{disclaimer}</p>}

      {heuristics.length > 0 && (
        <div className="rounded-md border border-cyan-200/80 dark:border-cyan-900/50 bg-cyan-50/50 dark:bg-cyan-950/20 p-3 space-y-2">
          <p className="text-xs font-medium text-cyan-900 dark:text-cyan-200">Skew &amp; ideas (heuristic, not advice)</p>
          <ul className="list-disc pl-4 text-sm text-cyan-950/90 dark:text-cyan-100/90 space-y-1">
            {heuristics.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}

      {aiBrief && (
        <div className="rounded-md border border-violet-200/80 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/20 p-3">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-medium text-violet-900 dark:text-violet-200">AI read</p>
            {aiBrief.aiGenerated && (
              <Badge variant="outline" className="text-[10px] border-violet-400/60">
                Claude
              </Badge>
            )}
          </div>
          <p className="text-sm text-violet-950/90 dark:text-violet-100/90 whitespace-pre-wrap">{aiBrief.text}</p>
        </div>
      )}

      {aggregates.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            By contract ({mode === "global" ? "global + tracked sample" : "tracked"} large size). BTC and ETH are always included.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Coin</TableHead>
                  <TableHead className="text-right text-xs">Long $</TableHead>
                  <TableHead className="text-right text-xs">Short $</TableHead>
                  <TableHead className="text-right text-xs">Wallets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aggregates.map((a) => (
                  <TableRow key={a.coin}>
                    <TableCell className="font-mono text-xs">
                      {a.coin}
                      {(a.coin === "BTC" || a.coin === "ETH") && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          focus
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      ${Math.round(a.longUsd).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                      ${Math.round(a.shortUsd).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-xs">{a.whaleCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Large positions (wallet → contract)</p>
        {loading && whales.length === 0 ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : whales.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rows above this threshold. Lower the minimum or refresh after traders open size.</p>
        ) : (
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Wallet</TableHead>
                  <TableHead className="text-xs">Label</TableHead>
                  <TableHead className="text-xs">Coin</TableHead>
                  <TableHead className="text-xs">Side</TableHead>
                  <TableHead className="text-right text-xs">Notional</TableHead>
                  <TableHead className="text-xs">Opened (local)</TableHead>
                  <TableHead className="text-xs">Analyze</TableHead>
                  <TableHead className="text-xs">Add to tracker</TableHead>
                  {isOwner && <TableHead className="text-xs">Admin global</TableHead>}
                  <TableHead className="text-xs w-24">Copy</TableHead>
                  <TableHead className="text-xs">Apex</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whales.map((w) => (
                  <TableRow key={`${w.address}-${w.coin}-${w.side}`}>
                    <TableCell className="font-mono text-[11px] max-w-[140px] truncate" title={w.address}>
                      {w.address}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{w.nickname ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{w.coin}</TableCell>
                    <TableCell className="text-xs">{w.side === "long" ? <span className="text-emerald-600">Long</span> : <span className="text-rose-600">Short</span>}</TableCell>
                    <TableCell className="text-right font-mono text-xs">${Math.round(w.positionUsd).toLocaleString()}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatLocalDateTime(w.openedAtMs)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => void analyzeWallet(w.address)}
                        disabled={analysisLoadingAddress === w.address}
                      >
                        {analysisLoadingAddress === w.address ? "Loading…" : "Analyze"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => void addToTracker(w.address, w.nickname)}
                        disabled={actionBusyKey === `tracker:${w.address.toLowerCase()}`}
                      >
                        {actionBusyKey === `tracker:${w.address.toLowerCase()}` ? "Adding…" : "Add"}
                      </Button>
                    </TableCell>
                    {isOwner && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => void addToGlobal(w.address, w.nickname)}
                          disabled={actionBusyKey === `global:${w.address.toLowerCase()}`}
                        >
                          {actionBusyKey === `global:${w.address.toLowerCase()}` ? "Adding…" : "Add global"}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void copyAddr(w.address)}>
                        {copied === w.address ? "Copied" : "Copy"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <a href={w.apexLiquidUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">
                        View
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {analysisOpenAddress && analysisByAddress[analysisOpenAddress] && (
        <div className="rounded-md border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1.5">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
            Wallet analysis: <span className="font-mono">{analysisOpenAddress}</span>
          </p>
          <p className="text-sm text-amber-950/90 dark:text-amber-100/90">{analysisByAddress[analysisOpenAddress].summary}</p>
          <p className="text-xs text-amber-950/80 dark:text-amber-100/80">
            Win rate: {analysisByAddress[analysisOpenAddress].metrics.winRate.toFixed(1)}% ({analysisByAddress[analysisOpenAddress].metrics.wins}W / {analysisByAddress[analysisOpenAddress].metrics.losses}L) | Open positions:{" "}
            {analysisByAddress[analysisOpenAddress].metrics.openPositions} | Closed positions: {analysisByAddress[analysisOpenAddress].metrics.closedTrades} | Total realized PnL: $
            {Math.round(analysisByAddress[analysisOpenAddress].metrics.totalRealizedPnlUsd).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
