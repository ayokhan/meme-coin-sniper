/** Client-side saved NovaRadar setups (localStorage). */

import type { NovaRadarCapitalRiskTolerance } from "@/lib/nova-radar-capital-guard";

export type NovaRadarSavedSetup = {
  id: string;
  name: string;
  savedAt: string;
  plan1: { symbol: string; limitPrice: string; side: "long" | "short"; takeProfit?: string; stopLoss?: string };
  plan2?: { symbol: string; limitPrice: string; side: "long" | "short"; takeProfit?: string; stopLoss?: string };
  usePlan2: boolean;
  leverage?: string;
  takeProfit?: string;
  stopLoss?: string;
  positionNotional?: string;
  investmentAmount?: string;
  capitalRiskTolerance?: NovaRadarCapitalRiskTolerance | "";
};

const STORAGE_KEY = "novastaris-nova-radar-setups-v1";
const MAX_SETUPS = 12;

export function loadNovaRadarSetups(): NovaRadarSavedSetup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NovaRadarSavedSetup[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNovaRadarSetup(setup: Omit<NovaRadarSavedSetup, "id" | "savedAt">): NovaRadarSavedSetup[] {
  const list = loadNovaRadarSetups();
  const entry: NovaRadarSavedSetup = {
    ...setup,
    id: `nr-${Date.now()}`,
    savedAt: new Date().toISOString(),
  };
  const next = [entry, ...list].slice(0, MAX_SETUPS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteNovaRadarSetup(id: string): NovaRadarSavedSetup[] {
  const next = loadNovaRadarSetups().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
