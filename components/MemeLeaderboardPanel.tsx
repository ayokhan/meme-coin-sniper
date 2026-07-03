"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, RefreshCw, Info, ExternalLink, Lock, Search, Download, Plus, Wand2, Trash2, Globe, Star, Copy, Check } from "lucide-react";
import WalletAnalyzerCard, { type AnalyzerChain, type AnalyzerPeriod } from "@/components/WalletAnalyzerCard";
import { StyledSelect } from "@/components/ui/styled-select";

type Period = "24h" | "7d" | "30d";

type Row = {
  walletAddress: string;
  label: string | null;
  realizedPnlUsd: number;
  unrealizedHoldingsUsd: number;
  totalPnlUsd: number;
  volumeUsd: number;
  tradeCount: number;
  winRatePct: number | null;
  biggestWinMint: string | null;
  biggestWinSymbol: string | null;
  biggestWinPnlUsd: number | null;
  notes: string | null;
  computedAt: string;
  isMine: boolean;
  isGlobal: boolean;
};

type MyWallet = { id: string; address: string; label: string | null; chain: string };

type LeaderboardResponse = {
  success: boolean;
  error?: string;
  disabled?: boolean;
  locked?: boolean;
  rows?: Row[];
  period?: Period;
  isOwner?: boolean;
  lastComputedAt?: string | null;
  methodology?: string;
};

type DiscoveryCandidate = {
  walletAddress: string;
  appearances: number;
  mints: Array<{ mint: string; symbol?: string; name?: string }>;
  totalLiquidityScore: number;
};

function fmtUsd(v: number | null | undefined, opts?: { signed?: boolean }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = opts?.signed ? (v > 0 ? "+" : v < 0 ? "-" : "") : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs > 0) return `${sign}$${abs.toFixed(4)}`;
  return "$0.00";
}

function fmtPct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(0)}%`;
}

function shortenWallet(w: string) {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

function fmtAgo(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export type MemeLeaderboardPanelProps = {
  /** Bump this counter from a parent to ask the panel to focus its Wallet Analyzer card with the given address. */
  externalAnalyzerTrigger?: number;
  externalAnalyzerAddress?: string;
  externalAnalyzerChain?: AnalyzerChain;
};

export default function MemeLeaderboardPanel({
  externalAnalyzerTrigger,
  externalAnalyzerAddress,
  externalAnalyzerChain,
}: MemeLeaderboardPanelProps = {}) {
  const [period, setPeriod] = useState<Period>("7d");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
  const [methodology, setMethodology] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryMsg, setDiscoveryMsg] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [addedCandidates, setAddedCandidates] = useState<Set<string>>(new Set());
  const [candidateErrors, setCandidateErrors] = useState<Record<string, string>>({});
  const [pairsScanned, setPairsScanned] = useState(0);
  const [addingWallet, setAddingWallet] = useState<string | null>(null);

  // Drives the WalletAnalyzerCard at the top when a row's "Analyze" button is clicked.
  const [analyzerTrigger, setAnalyzerTrigger] = useState(0);
  const [analyzerAddress, setAnalyzerAddress] = useState<string | undefined>(undefined);
  const [analyzerChain, setAnalyzerChain] = useState<AnalyzerChain | undefined>(undefined);

  // Personal-wallet management (any signed-in user with leaderboard access).
  const [myWallets, setMyWallets] = useState<MyWallet[]>([]);
  const [addAddress, setAddAddress] = useState("");
  const [addNickname, setAddNickname] = useState("");
  const [addChain, setAddChain] = useState<"solana" | "bsc">("solana");
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);
  const [busyAddress, setBusyAddress] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyAddress = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard?period=${p}&limit=100`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as LeaderboardResponse;
      if (!data.success) {
        setRows([]);
        setLocked(!!data.locked);
        setDisabled(!!data.disabled);
        setError(data.error ?? "Failed to load leaderboard.");
        return;
      }
      setLocked(false);
      setDisabled(false);
      setRows(data.rows ?? []);
      setIsOwner(!!data.isOwner);
      setLastComputedAt(data.lastComputedAt ?? null);
      setMethodology(data.methodology ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyWallets = useCallback(async () => {
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/my-wallets`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { success?: boolean; wallets?: MyWallet[] };
      if (data.success) setMyWallets(data.wallets ?? []);
    } catch {
      // Silent — UI degrades to empty list.
    }
  }, []);

  useEffect(() => {
    void fetchData(period);
  }, [fetchData, period]);

  useEffect(() => {
    if (!disabled && !locked) void fetchMyWallets();
  }, [disabled, locked, fetchMyWallets]);

  useEffect(() => {
    if (myWallets.length === 0) return;
    setAddedCandidates((prev) => {
      const next = new Set(prev);
      for (const w of myWallets) next.add(w.address);
      return next;
    });
  }, [myWallets]);

  const analyzerPeriod: AnalyzerPeriod = period;

  useEffect(() => {
    if (!externalAnalyzerTrigger || externalAnalyzerTrigger === 0) return;
    const addr = (externalAnalyzerAddress ?? "").trim();
    if (!addr) return;
    setAnalyzerAddress(addr);
    if (externalAnalyzerChain) setAnalyzerChain(externalAnalyzerChain);
    setAnalyzerTrigger((n) => n + 1);
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [externalAnalyzerTrigger, externalAnalyzerAddress, externalAnalyzerChain]);

  const onAddMyWallet = useCallback(async () => {
    const address = addAddress.trim();
    if (!address) {
      setAddMsg("Paste a wallet address first.");
      return;
    }
    setAddBusy(true);
    setAddMsg(null);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/my-wallets`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, nickname: addNickname.trim() || undefined, chain: addChain }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; wallets?: MyWallet[] };
      if (!data.success) {
        setAddMsg(data.error ?? "Failed to add wallet.");
        return;
      }
      setMyWallets(data.wallets ?? []);
      setAddAddress("");
      setAddNickname("");
      setAddMsg("Wallet added. Click Analyze on the row to compute live stats — cron will refresh nightly.");
      await fetchData(period);
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Failed to add wallet.");
    } finally {
      setAddBusy(false);
    }
  }, [addAddress, addNickname, addChain, fetchData, period]);

  const onRemoveMyWallet = useCallback(async (address: string) => {
    setBusyAddress(address);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/my-wallets?address=${encodeURIComponent(address)}`, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!data.success) {
        setAddMsg(data.error ?? "Failed to remove wallet.");
        return;
      }
      setMyWallets((prev) => prev.filter((w) => w.address !== address));
      await fetchData(period);
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Failed to remove wallet.");
    } finally {
      setBusyAddress(null);
    }
  }, [fetchData, period]);

  const onPromoteRow = useCallback(async (address: string, label: string | null) => {
    setBusyAddress(address);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/promote`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, nickname: label ?? undefined, global: true }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!data.success) {
        setAddMsg(data.error ?? "Failed to promote.");
        return;
      }
      await fetchData(period);
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Failed to promote.");
    } finally {
      setBusyAddress(null);
    }
  }, [fetchData, period]);

  const onDemoteRow = useCallback(async (address: string) => {
    if (typeof window !== "undefined" && !window.confirm(
      "Remove this wallet from global? Users won't see it on their leaderboard unless they added it personally.",
    )) {
      return;
    }
    setBusyAddress(address);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/promote`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, global: false }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!data.success) {
        setAddMsg(data.error ?? "Failed to remove from global.");
        return;
      }
      await fetchData(period);
    } catch (err) {
      setAddMsg(err instanceof Error ? err.message : "Failed to remove from global.");
    } finally {
      setBusyAddress(null);
    }
  }, [fetchData, period]);

  const triggerAnalyzeRow = useCallback((walletAddress: string) => {
    setAnalyzerAddress(walletAddress);
    setAnalyzerChain("solana");
    setAnalyzerTrigger((t) => t + 1);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/refresh?period=${period}`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        success?: boolean;
        refreshed?: number;
        totalWallets?: number;
        error?: string;
      };
      if (!data.success) {
        setRefreshMsg(data.error ?? "Refresh failed.");
      } else {
        setRefreshMsg(`Refreshed ${data.refreshed ?? 0} / ${data.totalWallets ?? 0} wallets.`);
        await fetchData(period);
      }
    } catch (err) {
      setRefreshMsg(err instanceof Error ? err.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchData, period]);

  const onImportConfig = useCallback(async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch(`/api/admin/wallet-tracker/import-config`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as { success?: boolean; count?: number; error?: string };
      if (!data.success) {
        setImportMsg(data.error ?? "Import failed.");
      } else {
        setImportMsg(`Imported ${data.count ?? 0} wallets from default list. Click Recompute snapshots next.`);
      }
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }, []);

  const onDiscover = useCallback(async () => {
    setDiscovering(true);
    setDiscoveryMsg(null);
    setDiscoverOpen(true);
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/discover`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        candidates?: DiscoveryCandidate[];
        pairsScanned?: number;
        ownersResolved?: number;
      };
      if (!data.success) {
        setDiscoveryMsg(data.error ?? "Discovery failed.");
        setCandidates([]);
      } else {
        setCandidates(data.candidates ?? []);
        setPairsScanned(data.pairsScanned ?? 0);
        {
          const count = data.candidates?.length ?? 0;
          const overlap = (data.candidates ?? []).filter((c) => (c?.appearances ?? 0) >= 2).length;
          setDiscoveryMsg(
            count === 0
              ? `Scanned ${data.pairsScanned ?? 0} trending pairs — no candidate wallets surfaced. Try again in a few minutes when trending data refreshes.`
              : `Scanned ${data.pairsScanned ?? 0} trending pairs → ${count} candidate${count === 1 ? "" : "s"} (${overlap} high-confidence overlap${overlap === 1 ? "" : "s"}).`,
          );
        }
      }
    } catch (err) {
      setDiscoveryMsg(err instanceof Error ? err.message : "Discovery failed.");
    } finally {
      setDiscovering(false);
    }
  }, []);

  const onAddCandidate = useCallback(async (wallet: string, label: string) => {
    setAddingWallet(wallet);
    setCandidateErrors((prev) => {
      const next = { ...prev };
      delete next[wallet];
      return next;
    });
    try {
      const res = await fetch(`/api/wallet-tracker/meme-leaderboard/my-wallets`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet, nickname: label, chain: "solana" }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        duplicate?: boolean;
        wallets?: MyWallet[];
      };
      if (data.success) {
        setAddedCandidates((prev) => {
          const next = new Set(prev);
          next.add(wallet);
          return next;
        });
        if (data.wallets) setMyWallets(data.wallets);
        // Refresh leaderboard so the new wallet shows up tagged "Mine".
        void fetchData(period);
      } else if (data.duplicate) {
        setAddedCandidates((prev) => {
          const next = new Set(prev);
          next.add(wallet);
          return next;
        });
        setCandidateErrors((prev) => ({
          ...prev,
          [wallet]: data.error ?? "Wallet already added.",
        }));
      } else {
        setCandidateErrors((prev) => ({
          ...prev,
          [wallet]: data.error ?? "Failed to add wallet.",
        }));
      }
    } catch (err) {
      setCandidateErrors((prev) => ({
        ...prev,
        [wallet]: err instanceof Error ? err.message : "Failed to add wallet.",
      }));
    } finally {
      setAddingWallet(null);
    }
  }, [fetchData, period]);

  const totals = useMemo(() => {
    if (rows.length === 0) return null;
    const totalPnl = rows.reduce((a, r) => a + r.totalPnlUsd, 0);
    const totalVol = rows.reduce((a, r) => a + r.volumeUsd, 0);
    const winRates = rows.map((r) => r.winRatePct).filter((v): v is number => v !== null);
    const avgWin = winRates.length > 0 ? winRates.reduce((a, v) => a + v, 0) / winRates.length : null;
    return { totalPnl, totalVol, avgWin };
  }, [rows]);

  if (disabled) {
    return (
      <Card className="border-amber-300/60 bg-amber-50/40 dark:border-amber-700/60 dark:bg-amber-900/10">
        <CardContent className="p-6 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-300 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">Meme Coin Advantage Bundle is disabled</p>
            <p className="text-sm text-muted-foreground mt-1">
              Owner can turn it on in Nova Admin → Feature flags → &quot;Meme Coin Advantage Bundle (Wallet Tracker)&quot;.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (locked) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-zinc-400 mb-2" />
          <p className="font-semibold">VIP subscription required</p>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade to VIP to access the Meme Coin Advantage Bundle (wallet tracker + wallet analyzer + leaderboard).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <WalletAnalyzerCard
        pendingTrigger={analyzerTrigger}
        pendingAddress={analyzerAddress}
        pendingChain={analyzerChain}
        pendingPeriod={analyzerPeriod}
        isOwner={isOwner}
        onWalletChanged={() => { void fetchData(period); void fetchMyWallets(); }}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-5 w-5 text-cyan-500" />
            Add a wallet to your leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-5">
              <input
                type="text"
                className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm font-mono"
                placeholder="Solana (base58) or BSC (0x…) wallet address"
                value={addAddress}
                onChange={(e) => setAddAddress(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <div className="md:col-span-3">
              <input
                type="text"
                className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm"
                placeholder="Nickname (optional)"
                value={addNickname}
                onChange={(e) => setAddNickname(e.target.value)}
                maxLength={64}
              />
            </div>
            <div className="md:col-span-2">
              <StyledSelect<"solana" | "bsc">
                value={addChain}
                options={[
                  { value: "solana", label: "Solana" },
                  { value: "bsc", label: "BSC" },
                ]}
                onChange={(v) => setAddChain(v)}
                title="Chain"
              />
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-10"
                onClick={() => void onAddMyWallet()}
                disabled={addBusy}
              >
                {addBusy ? "Adding…" : "Add wallet"}
              </Button>
            </div>
          </div>
          {addMsg && (
            <p className="text-xs text-muted-foreground">{addMsg}</p>
          )}
          {myWallets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Your wallets:</span>
              {myWallets.map((w) => (
                <span
                  key={w.id}
                  className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300"
                >
                  {w.label || shortenWallet(w.address)}
                  <button
                    type="button"
                    className="hover:text-rose-600"
                    onClick={() => void onRemoveMyWallet(w.address)}
                    disabled={busyAddress === w.address}
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="flex flex-col">
                <span>Meme Coin Advantage Bundle</span>
                <span className="text-[11px] font-normal text-muted-foreground">Wallet Tracker · Wallet Analyzer · Leaderboard</span>
              </span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <TabsList className="bg-zinc-100 dark:bg-zinc-800">
                  <TabsTrigger value="24h">24h</TabsTrigger>
                  <TabsTrigger value="7d">7d</TabsTrigger>
                  <TabsTrigger value="30d">30d</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchData(period)}
                disabled={loading || refreshing}
              >
                {loading ? "Loading…" : "Reload"}
              </Button>
              {isOwner && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onImportConfig}
                    disabled={importing}
                  >
                    <Download className={`h-4 w-4 mr-1 ${importing ? "animate-pulse" : ""}`} />
                    {importing ? "Importing…" : "Import default list"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    onClick={onRefresh}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Refreshing…" : "Recompute snapshots"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <div className="text-xs text-muted-foreground">Aggregate PnL ({period})</div>
              <div className={`text-lg font-bold ${totals && totals.totalPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {totals ? fmtUsd(totals.totalPnl, { signed: true }) : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <div className="text-xs text-muted-foreground">Aggregate volume</div>
              <div className="text-lg font-bold">{totals ? fmtUsd(totals.totalVol) : "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <div className="text-xs text-muted-foreground">Avg win rate</div>
              <div className="text-lg font-bold">{totals ? fmtPct(totals.avgWin) : "—"}</div>
            </div>
          </div>

          {refreshMsg && (
            <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-900/20 px-3 py-2 text-xs text-cyan-700 dark:text-cyan-200">
              {refreshMsg}
            </div>
          )}
          {importMsg && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
              {importMsg}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead className="text-right">Total PnL</TableHead>
                  <TableHead className="text-right">Realized</TableHead>
                  <TableHead className="text-right">Holdings</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Trades</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                  <TableHead>Biggest win</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {loading
                        ? "Loading…"
                        : isOwner
                          ? "No snapshots yet. Click \"Recompute snapshots\" to build the first leaderboard."
                          : "No snapshots yet. Contact support if you need a refresh."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => {
                    return (
                      <TableRow key={r.walletAddress}>
                          <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium flex items-center gap-1.5 flex-wrap">
                                {r.label || shortenWallet(r.walletAddress)}
                                {r.isGlobal && (
                                  <span className="text-[10px] px-1 py-0 rounded bg-amber-100 dark:bg-amber-900/30 text-slate-600 dark:text-slate-300 border border-amber-300 dark:border-amber-700 inline-flex items-center gap-0.5">
                                    <Globe className="h-2.5 w-2.5" /> Global
                                  </span>
                                )}
                                {r.isMine && (
                                  <span className="text-[10px] px-1 py-0 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 inline-flex items-center gap-0.5">
                                    <Star className="h-2.5 w-2.5" /> Mine
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void copyAddress(`wallet-${r.walletAddress}`, r.walletAddress)}
                                  title="Copy wallet address"
                                  className="opacity-70 hover:opacity-100"
                                >
                                  {copiedKey === `wallet-${r.walletAddress}` ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                              {r.label && (
                                <div className="text-xs text-muted-foreground font-mono">{shortenWallet(r.walletAddress)}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${r.totalPnlUsd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {fmtUsd(r.totalPnlUsd, { signed: true })}
                          </TableCell>
                          <TableCell className={`text-right ${r.realizedPnlUsd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {fmtUsd(r.realizedPnlUsd, { signed: true })}
                          </TableCell>
                          <TableCell className="text-right">{fmtUsd(r.unrealizedHoldingsUsd)}</TableCell>
                          <TableCell className="text-right">{fmtUsd(r.volumeUsd)}</TableCell>
                          <TableCell className="text-right">{r.tradeCount}</TableCell>
                          <TableCell className="text-right">{fmtPct(r.winRatePct)}</TableCell>
                          <TableCell>
                            {r.biggestWinSymbol || r.biggestWinMint ? (
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">
                                  {r.biggestWinSymbol ?? shortenWallet(r.biggestWinMint ?? "")}
                                </span>
                                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                                  {fmtUsd(r.biggestWinPnlUsd, { signed: true })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1.5 flex-wrap">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7"
                                onClick={() => triggerAnalyzeRow(r.walletAddress)}
                                title="Open Wallet Analyzer for this wallet"
                              >
                                <Wand2 className="h-3 w-3 mr-1" />
                                Analyze
                              </Button>
                              {r.isMine && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                  onClick={() => void onRemoveMyWallet(r.walletAddress)}
                                  disabled={busyAddress === r.walletAddress}
                                  title="Remove from my wallets"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              )}
                              {isOwner && !r.isGlobal && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7"
                                  onClick={() => void onPromoteRow(r.walletAddress, r.label)}
                                  disabled={busyAddress === r.walletAddress}
                                  title="Promote to global (visible to all users)"
                                >
                                  <Globe className="h-3 w-3 mr-1" />
                                  Make global
                                </Button>
                              )}
                              {isOwner && r.isGlobal && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                  onClick={() => void onDemoteRow(r.walletAddress)}
                                  disabled={busyAddress === r.walletAddress}
                                  title="Remove from global (hide from all users; still available to anyone who added it personally)"
                                >
                                  <Globe className="h-3 w-3 mr-1" />
                                  Remove global
                                </Button>
                              )}
                              <a
                                href={`https://solscan.io/account/${r.walletAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                              >
                                Solscan <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                        </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>
              Last computed: <span className="font-medium">{fmtAgo(lastComputedAt) ?? "never"}</span>
              {lastComputedAt ? ` (${new Date(lastComputedAt).toLocaleString()})` : ""}
            </p>
            {methodology && (
              <p className="leading-relaxed">
                <Info className="inline h-3 w-3 mr-1 -mt-0.5" />
                {methodology}
              </p>
            )}
            <p>
              How successful traders find these coins: they monitor first-buys from known smart-money wallets,
              watch Telegram/Twitter for early calls, screen Pump.fun &amp; Raydium pools for sudden volume +
              liquidity spikes, and route micro-buys when 3+ tracked wallets enter the same token. NovaStaris
              already automates the wallet-tracking and 3+ buyer alerts above.
            </p>
          </div>
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-5 w-5 text-violet-500" />
                Discover smart-money wallets
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDiscoverOpen((v) => !v)}
                >
                  {discoverOpen ? "Hide" : "Show"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={onDiscover}
                  disabled={discovering}
                >
                  <Search className={`h-4 w-4 mr-1 ${discovering ? "animate-pulse" : ""}`} />
                  {discovering ? "Scanning…" : "Scan trending memes"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {discoverOpen && (
            <CardContent className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Surfaces wallets that appear as top holders of one or more trending Solana meme tokens.
                Wallets seen across 2+ trending memes are marked
                {" "}<span className="font-medium text-violet-600 dark:text-violet-300">high confidence</span>.
                Click <span className="font-medium">Add</span> to track a candidate, or
                {" "}<span className="font-medium">Analyze</span> to inspect its PnL and holdings.
              </p>
              {discoveryMsg && (
                <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-900/20 px-3 py-2 text-xs text-violet-700 dark:text-violet-200">
                  {discoveryMsg}
                </div>
              )}
              {candidates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {discovering
                    ? "Scanning trending pairs… this can take 10–20 seconds."
                    : `Run a scan to surface candidate wallets${pairsScanned ? ` (last scan: ${pairsScanned} pairs)` : ""}.`}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Wallet</TableHead>
                        <TableHead className="text-right">Trending tokens held</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((c) => {
                        const isAdded = addedCandidates.has(c.walletAddress);
                        const rowError = candidateErrors[c.walletAddress];
                        return (
                        <TableRow key={c.walletAddress}>
                          <TableCell>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <a
                                href={`https://solscan.io/account/${c.walletAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-cyan-600 dark:text-cyan-400 hover:underline font-mono text-xs"
                              >
                                {shortenWallet(c.walletAddress)}
                              </a>
                              <button
                                type="button"
                                onClick={() => void copyAddress(`cand-${c.walletAddress}`, c.walletAddress)}
                                title="Copy wallet address"
                                className="opacity-70 hover:opacity-100"
                              >
                                {copiedKey === `cand-${c.walletAddress}` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                              {isAdded && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                  Tracked
                                </span>
                              )}
                            </div>
                            {rowError && (
                              <p className="text-[10px] mt-0.5 text-slate-600 dark:text-slate-300">{rowError}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="font-medium">{c.appearances}</span>
                              {c.appearances >= 2 ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                                  High confidence
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                  Single hit
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {c.mints.slice(0, 6).map((m) => (
                                <span
                                  key={m.mint}
                                  className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                                >
                                  {m.symbol ?? shortenWallet(m.mint)}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7"
                                onClick={() => triggerAnalyzeRow(c.walletAddress)}
                                title="Open Wallet Analyzer for this wallet"
                              >
                                <Wand2 className="h-3 w-3 mr-1" />
                                Analyze
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={isAdded ? "secondary" : "outline"}
                                className="h-7"
                                onClick={() =>
                                  onAddCandidate(
                                    c.walletAddress,
                                    `Discovered ${c.mints[0]?.symbol ?? "meme"} x${c.appearances}`,
                                  )
                                }
                                disabled={addingWallet === c.walletAddress || isAdded}
                                title={isAdded ? "Already in your tracked wallets" : "Add to my tracker"}
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="h-3 w-3 mr-1" />
                                    Added
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    {addingWallet === c.walletAddress ? "Adding…" : "Add"}
                                  </>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
