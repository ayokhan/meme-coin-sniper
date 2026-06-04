"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ClosedTradesAnalysis } from "@/lib/closed-trades";
import {
  deleteTradeJournalEntry,
  loadTradeJournal,
  saveTradeJournalEntry,
  type TradeJournalEntry,
} from "@/lib/trade-journal";

type Props = {
  periodLabel: string;
  modeLabel: string;
  analysis: ClosedTradesAnalysis;
};

export default function TradeJournalPanel({ periodLabel, modeLabel, analysis }: Props) {
  const [entries, setEntries] = useState<TradeJournalEntry[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    setEntries(loadTradeJournal());
  }, []);

  const save = () => {
    const next = saveTradeJournalEntry({
      periodLabel,
      modeLabel,
      totalTrades: analysis.totalTrades,
      wins: analysis.wins,
      losses: analysis.losses,
      winRatePct: analysis.winRatePct,
      totalRealizedUsdt: analysis.totalRealizedUsdt,
      note: note.trim(),
    });
    setEntries(next);
    setNote("");
  };

  if (analysis.totalTrades === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Trade journal (saved on this device)</p>
      <p className="text-[11px] text-muted-foreground">
        Snapshot your closed-trade stats and a short note—useful for reviewing what worked before changing strategy.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Only took XAU limits with 15x after dip to structure support…"
        rows={2}
        className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
      />
      <Button type="button" size="sm" variant="outline" onClick={save}>
        Save snapshot to journal
      </Button>
      {entries.length > 0 && (
        <ul className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-zinc-200 dark:border-zinc-700">
          {entries.slice(0, 8).map((e) => (
            <li key={e.id} className="text-[11px] text-zinc-700 dark:text-zinc-300">
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {new Date(e.savedAt).toLocaleDateString()} · {e.periodLabel} · {e.modeLabel}
                </span>
                <button
                  type="button"
                  className="text-rose-600 shrink-0"
                  onClick={() => setEntries(deleteTradeJournalEntry(e.id))}
                >
                  Delete
                </button>
              </div>
              <span className="text-muted-foreground">
                {e.totalTrades} trades · {e.winRatePct.toFixed(1)}% WR ·{" "}
                <span className={e.totalRealizedUsdt >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  {e.totalRealizedUsdt >= 0 ? "+" : ""}
                  {e.totalRealizedUsdt.toFixed(2)} USDT
                </span>
              </span>
              {e.note && <p className="mt-0.5 italic">{e.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
