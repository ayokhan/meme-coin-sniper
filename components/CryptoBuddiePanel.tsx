"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CryptoBuddieRow } from "@/lib/crypto-buddie-score";

const INTERVALS_MS = [
  { label: "30 sec", ms: 30_000 },
  { label: "1 min", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
  { label: "5 min", ms: 300_000 },
] as const;

export default function CryptoBuddiePanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [rows, setRows] = useState<CryptoBuddieRow[]>([]);
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<CryptoBuddieRow | null>(null);
  const [focusLoading, setFocusLoading] = useState(false);

  const [monitorChain, setMonitorChain] = useState<"solana" | "bsc">("solana");
  const [monitorContract, setMonitorContract] = useState("");
  const [monitorOn, setMonitorOn] = useState(false);
  const [intervalMs, setIntervalMs] = useState(60_000);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [monitorMessage, setMonitorMessage] = useState<string | null>(null);
  const [lastFingerprint, setLastFingerprint] = useState<string | null>(null);
  const fpRef = useRef<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/futures/crypto-buddie", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.error ?? `Request failed (${res.status})`);
        setRows([]);
        return;
      }
      setDisclaimer(data.disclaimer ?? "");
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const runFocusSearch = async () => {
    const sym = search.trim().toUpperCase();
    if (!sym) {
      setFocus(null);
      return;
    }
    setFocusLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/futures/crypto-buddie?focus=${encodeURIComponent(sym)}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data?.error ?? "Lookup failed");
        setFocus(null);
        return;
      }
      setFocus(data.focus ?? null);
      if (!data.focus) setError(`No perp data for “${sym}”. Try a Hyperliquid symbol (e.g. BTC, SOL).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
      setFocus(null);
    } finally {
      setFocusLoading(false);
    }
  };

  const pollMonitor = useCallback(async () => {
    const c = monitorContract.trim();
    if (!c) return;
    setMonitorLoading(true);
    setMonitorError(null);
    try {
      const res = await fetch("/api/futures/crypto-buddie/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          chain: monitorChain,
          contract: c,
          previousFingerprint: fpRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMonitorError(data?.error ?? `Monitor failed (${res.status})`);
        return;
      }
      fpRef.current = data.fingerprint;
      setLastFingerprint(data.fingerprint);
      setMonitorMessage(data.message ?? null);
    } catch (e) {
      setMonitorError(e instanceof Error ? e.message : "Monitor failed");
    } finally {
      setMonitorLoading(false);
    }
  }, [monitorChain, monitorContract]);

  useEffect(() => {
    if (!monitorOn || !monitorContract.trim()) return;
    void pollMonitor();
    const id = window.setInterval(() => void pollMonitor(), intervalMs);
    return () => window.clearInterval(id);
  }, [monitorOn, intervalMs, monitorChain, monitorContract, pollMonitor]);

  const topSyms = new Set(rows.slice(0, 3).map((r) => r.coin));

  const fmt = (v: number | undefined) => (v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%");
  const cls = (v: number | undefined) =>
    v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 max-w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Crypto Buddie</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Same universe as <strong className="text-zinc-700 dark:text-zinc-300">Top Altcoins</strong> (major HL perps), ranked for tighter recent 15m ranges and short-term alignment—highlighting names that may be more “range-friendly” for quick plans. Search any HL symbol for detail. Solana/BSC monitor reuses the NovaStaris token AI (not perp order flow).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadRows()} disabled={loading}>
          {loading ? "Loading…" : "Refresh list"}
        </Button>
      </div>

      {disclaimer && <p className="text-[11px] text-muted-foreground leading-relaxed">{disclaimer}</p>}
      {error && !focusLoading && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-3 bg-zinc-50/50 dark:bg-zinc-900/30">
        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">AI monitor (Solana / BSC contract)</p>
        <p className="text-[11px] text-muted-foreground">
          Turn on to poll the same AI snapshot as the AI Agent. If the fingerprint changes between polls, we suggest reassessing or exiting; if unchanged, you might stay with your plan.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">Chain</label>
            <select
              value={monitorChain}
              onChange={(e) => setMonitorChain(e.target.value === "bsc" ? "bsc" : "solana")}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
            >
              <option value="solana">Solana</option>
              <option value="bsc">BSC</option>
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="text-[11px] text-muted-foreground block mb-0.5">Contract</label>
            <input
              value={monitorContract}
              onChange={(e) => setMonitorContract(e.target.value.trim())}
              placeholder={monitorChain === "bsc" ? "0x…" : "Mint address"}
              className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block mb-0.5">Interval</label>
            <select
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
            >
              {INTERVALS_MS.map((o) => (
                <option key={o.ms} value={o.ms}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            variant={monitorOn ? "destructive" : "default"}
            className={!monitorOn ? "bg-cyan-500 hover:bg-cyan-600 text-white" : ""}
            onClick={() => {
              if (!monitorOn) {
                fpRef.current = null;
                setLastFingerprint(null);
              }
              setMonitorOn((v) => !v);
            }}
            disabled={!monitorContract.trim()}
          >
            {monitorOn ? "Stop monitor" : "Start AI monitor"}
          </Button>
        </div>
        {monitorError && <p className="text-xs text-rose-600 dark:text-rose-400">{monitorError}</p>}
        {monitorOn && (
          <div className="text-xs space-y-1">
            {monitorLoading && <p className="text-muted-foreground">Fetching snapshot…</p>}
            {lastFingerprint && (
              <p className="font-mono text-[10px] text-muted-foreground break-all">Fingerprint: {lastFingerprint}</p>
            )}
            {monitorMessage && <p className="text-zinc-800 dark:text-zinc-200">{monitorMessage}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Search perp symbol</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value.toUpperCase())}
            placeholder="e.g. BTC, SOL"
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-36 bg-white dark:bg-zinc-800 font-mono"
          />
        </div>
        <Button size="sm" variant="secondary" onClick={() => void runFocusSearch()} disabled={focusLoading}>
          {focusLoading ? "…" : "Details"}
        </Button>
        {focus && (
          <Button size="sm" variant="ghost" onClick={() => { setFocus(null); setSearch(""); setError(null); }}>
            Clear
          </Button>
        )}
      </div>

      {focus && (
        <div className="rounded-md border border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold">{focus.coin}</span>
            <Badge variant="outline">Buddy score {focus.buddyScore}</Badge>
            <Badge variant="secondary" className="capitalize">
              Stability: {focus.stability}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{focus.stabilityNote}</p>
          <p className="text-xs">{focus.directionHint}</p>
          <p className="text-xs font-mono">
            5m {fmt(focus.pct5m)} · 1h {fmt(focus.pct1h)} · 4h {fmt(focus.pct4h)} · 24h {fmt(focus.dayPct)}
          </p>
          <a
            href={`https://app.hyperliquid.xyz/trade/${focus.coin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline inline-block"
          >
            Open on Hyperliquid
          </a>
        </div>
      )}

      {loading && rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data.</p>
      ) : (
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Symbol</TableHead>
                <TableHead className="text-right text-xs">Buddy</TableHead>
                <TableHead className="text-xs">Stability</TableHead>
                <TableHead className="text-right text-xs">5m</TableHead>
                <TableHead className="text-right text-xs">1h</TableHead>
                <TableHead className="text-right text-xs">4h</TableHead>
                <TableHead className="text-right text-xs">24h</TableHead>
                <TableHead className="text-right text-xs">Price</TableHead>
                <TableHead className="text-xs">Hint</TableHead>
                <TableHead className="text-right text-xs">Trade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const isTop = topSyms.has(p.coin);
                return (
                  <TableRow key={p.coin} className={isTop ? "bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-200/60 dark:ring-emerald-900/50" : ""}>
                    <TableCell className="font-mono text-xs">
                      {p.coin}
                      {isTop && (
                        <Badge className="ml-2 text-[10px] bg-emerald-600 hover:bg-emerald-600" variant="default">
                          Buddie pick
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">{p.buddyScore}</TableCell>
                    <TableCell className="text-xs capitalize">{p.stability}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${cls(p.pct5m)}`}>{fmt(p.pct5m)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${cls(p.pct1h)}`}>{fmt(p.pct1h)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${cls(p.pct4h)}`}>{fmt(p.pct4h)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${cls(p.dayPct)}`}>{fmt(p.dayPct)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px]">{p.directionHint}</TableCell>
                    <TableCell className="text-right">
                      <a href={`https://app.hyperliquid.xyz/trade/${p.coin}`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">
                        Trade
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
