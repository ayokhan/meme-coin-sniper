/** Local trade journal entries (browser storage). */

export type TradeJournalEntry = {
  id: string;
  savedAt: string;
  periodLabel: string;
  modeLabel: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  totalRealizedUsdt: number;
  note: string;
};

const KEY = "novastaris-trade-journal-v1";
const MAX = 40;

export function loadTradeJournal(): TradeJournalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as TradeJournalEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTradeJournalEntry(
  entry: Omit<TradeJournalEntry, "id" | "savedAt">
): TradeJournalEntry[] {
  const list = loadTradeJournal();
  const row: TradeJournalEntry = {
    ...entry,
    id: `tj-${Date.now()}`,
    savedAt: new Date().toISOString(),
  };
  const next = [row, ...list].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function deleteTradeJournalEntry(id: string): TradeJournalEntry[] {
  const next = loadTradeJournal().filter((e) => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
