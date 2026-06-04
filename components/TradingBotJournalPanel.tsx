"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { JournalEntryDto } from "@/lib/trading-bot-journal";
import { loadNovaRadarLastRun, type NovaRadarLastRunSnapshot } from "@/lib/nova-radar-last-run";

type ClosedTradeForSync = {
  id: string;
  instId: string;
  displaySymbol: string;
  direction: "long" | "short";
  openPrice: number;
  closePrice: number;
  realizedPnlUsdt: number;
  roiPct: number;
  leverage: number;
  closedAt: string | null;
  source: "fills" | "orders";
};

type Props = {
  closedTrades: ClosedTradeForSync[];
  blofinMode: "demo" | "live";
};

export default function TradingBotJournalPanel({ closedTrades, blofinMode }: Props) {
  const [entries, setEntries] = useState<JournalEntryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastRadar, setLastRadar] = useState<NovaRadarLastRunSnapshot | null>(null);

  useEffect(() => {
    setLastRadar(loadNovaRadarLastRun());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trading-bot/journal?limit=40", { credentials: "include" });
      const data = await res.json();
      if (data.success && Array.isArray(data.entries)) {
        setEntries(data.entries as JournalEntryDto[]);
      } else {
        setError(data.error ?? "Failed to load journal");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journal");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncClosed = async () => {
    if (closedTrades.length === 0) return;
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/trading-bot/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "sync",
          trades: closedTrades,
          blofinMode,
          novaRadarSnapshot: lastRadar,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Synced ${data.synced ?? 0} closed trade(s) to your journal.`);
        await load();
      } else {
        setError(data.error ?? "Sync failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    try {
      await fetch("/api/trading-bot/journal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, notes }),
      });
      await load();
    } catch {
      /* ignore */
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this journal entry?")) return;
    await fetch(`/api/trading-bot/journal?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await load();
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Trade journal</p>
          <p className="text-xs text-muted-foreground">
            Track closed trades and notes — sync from Blofin closed list. Your last NovaRadar run attaches to matching symbols when you sync.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={load} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={syncing || closedTrades.length === 0}
            onClick={syncClosed}
          >
            {syncing ? "Syncing…" : `Sync ${closedTrades.length} closed`}
          </Button>
        </div>
      </div>
      {lastRadar && (
        <p className="text-xs text-violet-800 dark:text-violet-200 rounded border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/50 dark:bg-violet-950/30 px-2 py-1.5">
          Last NovaRadar ({lastRadar.symbol}):{" "}
          {lastRadar.recommendation?.headline ?? "—"}
          {lastRadar.plans.length > 0 &&
            ` · plans @ ${lastRadar.plans.map((p) => `$${p.targetPrice.toLocaleString()}`).join(", ")}`}
        </p>
      )}
      {message && <p className="text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {entries.length === 0 && !loading ? (
        <p className="text-xs text-muted-foreground">No journal entries yet — sync closed trades or they will appear after your next closes.</p>
      ) : (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Symbol</th>
                <th className="py-1 pr-2">Side</th>
                <th className="py-1 pr-2 text-right">PnL</th>
                <th className="py-1 pr-2">Notes</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                let radarNote: string | null = null;
                if (e.novaRadarSnapshot) {
                  try {
                    const snap = JSON.parse(e.novaRadarSnapshot) as NovaRadarLastRunSnapshot;
                    if (snap.recommendation?.headline) {
                      radarNote = snap.recommendation.headline;
                    }
                  } catch {
                    /* ignore */
                  }
                }
                return (
                <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">
                    {e.closedAt ? new Date(e.closedAt).toLocaleDateString() : new Date(e.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-1.5 pr-2 font-mono">{e.symbol}</td>
                  <td className="py-1.5 pr-2 capitalize">{e.side}</td>
                  <td
                    className={`py-1.5 pr-2 text-right tabular-nums font-medium ${
                      (e.realizedPnlUsdt ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {e.realizedPnlUsdt != null
                      ? `${e.realizedPnlUsdt >= 0 ? "+" : ""}${e.realizedPnlUsdt.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-2 min-w-[120px]">
                    <input
                      type="text"
                      defaultValue={e.notes ?? ""}
                      placeholder="Add note…"
                      className="w-full text-xs border border-zinc-300 dark:border-zinc-600 rounded px-1 py-0.5 bg-white dark:bg-zinc-800"
                      onBlur={(ev) => {
                        const v = ev.target.value.trim();
                        if (v !== (e.notes ?? "")) updateNotes(e.id, v);
                      }}
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      type="button"
                      className="text-rose-600 text-[10px]"
                      onClick={() => remove(e.id)}
                      aria-label="Delete entry"
                    >
                      Del
                    </button>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
