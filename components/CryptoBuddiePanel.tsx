"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CryptoBuddieRow } from "@/lib/crypto-buddie-score";

export default function CryptoBuddiePanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [rows, setRows] = useState<CryptoBuddieRow[]>([]);
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<CryptoBuddieRow | null>(null);
  const [focusLoading, setFocusLoading] = useState(false);

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
            Same universe as <strong className="text-zinc-700 dark:text-zinc-300">Top Altcoins</strong> (major HL perps), ranked for tighter recent 15m ranges, short-term momentum, and net direction of recent 15m closes (a simple “close path” read — not drawn trendlines). Search any HL symbol for detail. For Solana/BSC token auto-refresh monitoring, use{" "}
            <strong className="text-zinc-700 dark:text-zinc-300">NovaStaris AI Agent → AI monitor</strong>.
          </p>
          <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-2 max-w-2xl rounded-md border border-amber-200/60 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/25 px-2 py-1.5">
            <strong className="text-zinc-800 dark:text-zinc-200">Buddie pick</strong> means the row scored highest for this screen’s heuristics (liquidity + tight ranges + alignment). It is{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">not</strong> an automatic “open long.” Use the <strong className="text-zinc-800 dark:text-zinc-200">Bias</strong> column for a simple long / short / neutral read from 5m–1h momentum; use <strong className="text-zinc-800 dark:text-zinc-200">15m trend</strong> for whether recent closes drifted up or down across ~2h. Always confirm on your own chart and risk rules.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadRows()} disabled={loading}>
          {loading ? "Loading…" : "Refresh list"}
        </Button>
      </div>

      {disclaimer && <p className="text-[11px] text-muted-foreground leading-relaxed">{disclaimer}</p>}
      {error && !focusLoading && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

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
          <p className="text-xs">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Bias:</span>{" "}
            <span className={focus.bias === "long" ? "text-emerald-600 dark:text-emerald-400" : focus.bias === "short" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}>
              {focus.bias === "long" ? "Long" : focus.bias === "short" ? "Short" : "Neutral"}
            </span>
            {" · "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">15m trend:</span>{" "}
            {focus.trend15m === "up" ? "Up" : focus.trend15m === "down" ? "Down" : "Sideways"}{" "}
            <span className="font-mono text-muted-foreground">
              ({focus.trend15mNetPct >= 0 ? "+" : ""}
              {focus.trend15mNetPct.toFixed(2)}%)
            </span>
          </p>
          <p className="text-[11px] text-muted-foreground">{focus.trendContext}</p>
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
                <TableHead className="text-xs">Bias</TableHead>
                <TableHead className="text-xs" title="Net change of 15m closes over the loaded window (~2h), not drawn trendlines">
                  15m trend
                </TableHead>
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
                    <TableCell className="text-xs font-medium">
                      <span
                        className={
                          p.bias === "long"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : p.bias === "short"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                        }
                      >
                        {p.bias === "long" ? "Long" : p.bias === "short" ? "Short" : "Neutral"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      <span className={p.trend15m === "up" ? "text-emerald-600 dark:text-emerald-400" : p.trend15m === "down" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}>
                        {p.trend15m === "up" ? "Up" : p.trend15m === "down" ? "Down" : "Flat"}
                      </span>{" "}
                      <span className="text-muted-foreground text-[10px]">
                        ({p.trend15mNetPct >= 0 ? "+" : ""}
                        {p.trend15mNetPct.toFixed(2)}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{p.stability}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${cls(p.pct5m)}`}>{fmt(p.pct5m)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${cls(p.pct1h)}`}>{fmt(p.pct1h)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${cls(p.pct4h)}`}>{fmt(p.pct4h)}</TableCell>
                    <TableCell className={`text-right font-mono text-xs ${cls(p.dayPct)}`}>{fmt(p.dayPct)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">${Number(p.markPx).toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}</TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground min-w-[240px] max-w-[420px] whitespace-normal break-words leading-relaxed"
                      title={p.directionHint}
                    >
                      {p.directionHint}
                    </TableCell>
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
