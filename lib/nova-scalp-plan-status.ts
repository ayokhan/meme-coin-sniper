import type { NovaScalpAnalysis, ScalpSide } from "@/lib/nova-scalp-agent";

export type ScalpPlanStatus =
  | "active"
  | "at_entry"
  | "invalidated"
  | "target_hit"
  | "stale"
  | "no_entry";

export const SCALP_PLAN_STALE_MS = 30 * 60 * 1000;
export const SCALP_ENTRY_ZONE_PCT = 0.12;

export function formatPlanAge(analyzedAtIso: string | null | undefined, nowMs = Date.now()): string {
  if (!analyzedAtIso) return "";
  const t = Date.parse(analyzedAtIso);
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((nowMs - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m ago` : `${hrs}h ago`;
}

export function formatAnalyzedAtLocal(analyzedAtIso: string | null | undefined): string {
  if (!analyzedAtIso) return "";
  const d = new Date(analyzedAtIso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Signed % move from `from` to `to` (positive = price went up). */
export function priceMovePct(from: number, to: number): number {
  if (!from || !Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return ((to - from) / from) * 100;
}

export function formatDistanceLabel(
  livePrice: number,
  level: number,
  side: "long" | "short",
  kind: "entry" | "exit" | "stop"
): string {
  const pct = priceMovePct(livePrice, level);
  const abs = Math.abs(pct).toFixed(2);
  if (kind === "stop") {
    if (side === "long") {
      return pct <= 0 ? `${abs}% below (toward stop)` : `${abs}% above stop`;
    }
    return pct >= 0 ? `${abs}% above (toward stop)` : `${abs}% below stop`;
  }
  if (kind === "exit") {
    if (side === "long") {
      return pct >= 0 ? `${abs}% above (toward target)` : `${abs}% below target`;
    }
    return pct <= 0 ? `${abs}% below (toward target)` : `${abs}% above target`;
  }
  // entry
  if (side === "long") {
    return pct <= 0 ? `${abs}% below entry` : `${abs}% above entry`;
  }
  return pct >= 0 ? `${abs}% above entry` : `${abs}% below entry`;
}

export function computeScalpPlanStatus(input: {
  side: ScalpSide;
  livePrice: number | null;
  entryPrice: number | null;
  exitPrice: number | null;
  structuralStop: number | null;
  analyzedAtIso: string | null | undefined;
  entryMode?: "limit" | "market" | null;
  nowMs?: number;
}): ScalpPlanStatus {
  const now = input.nowMs ?? Date.now();
  if (input.side === "no_entry") return "no_entry";
  if (input.livePrice == null || !Number.isFinite(input.livePrice)) return "active";

  const analyzedAt = input.analyzedAtIso ? Date.parse(input.analyzedAtIso) : NaN;
  if (Number.isFinite(analyzedAt) && now - analyzedAt > SCALP_PLAN_STALE_MS) {
    return "stale";
  }

  const { side, livePrice, entryPrice, exitPrice, structuralStop } = input;
  if (entryPrice == null || exitPrice == null || structuralStop == null) return "active";

  const entryZone = (SCALP_ENTRY_ZONE_PCT / 100) * entryPrice;

  if (side === "long") {
    if (livePrice <= structuralStop) return "invalidated";
    if (livePrice >= exitPrice) return "target_hit";
    if (input.entryMode === "market" || Math.abs(livePrice - entryPrice) <= entryZone) {
      return "at_entry";
    }
    return "active";
  }

  if (side === "short") {
    if (livePrice >= structuralStop) return "invalidated";
    if (livePrice <= exitPrice) return "target_hit";
    if (input.entryMode === "market" || Math.abs(livePrice - entryPrice) <= entryZone) {
      return "at_entry";
    }
    return "active";
  }

  return "active";
}

export function planStatusLabel(status: ScalpPlanStatus): string {
  switch (status) {
    case "active":
      return "Active — waiting for entry";
    case "at_entry":
      return "At entry zone";
    case "invalidated":
      return "Invalidated — refresh plan";
    case "target_hit":
      return "Target reached (no entry) — re-scan";
    case "stale":
      return "Stale — refresh recommended";
    default:
      return "";
  }
}

export function planStatusTone(
  status: ScalpPlanStatus
): "neutral" | "good" | "warn" | "bad" {
  switch (status) {
    case "at_entry":
      return "good";
    case "invalidated":
    case "target_hit":
      return "bad";
    case "stale":
      return "warn";
    default:
      return "neutral";
  }
}

export function planStatusFromAnalysis(
  analysis: NovaScalpAnalysis,
  livePrice: number | null
): ScalpPlanStatus {
  return computeScalpPlanStatus({
    side: analysis.side,
    livePrice,
    entryPrice: analysis.entryPrice,
    exitPrice: analysis.exitPrice,
    structuralStop: analysis.stopLossPrice,
    analyzedAtIso: analysis.analyzedAt,
    entryMode: analysis.entryMode,
  });
}
