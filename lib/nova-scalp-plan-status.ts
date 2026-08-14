import {
  rewardRiskRatio,
  SCALP_MIN_REWARD_RISK,
  type NovaScalpAnalysis,
  type ScalpSide,
} from "@/lib/nova-scalp-agent";

export type ScalpPlanStatus =
  | "active"
  | "at_entry"
  | "invalidated"
  | "target_hit"
  | "missed"
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

/**
 * Describe where live sits relative to a plan level (entry / exit / stop).
 * Wording is from the trader’s POV: e.g. live above a long limit → “above entry”.
 */
export function formatDistanceLabel(
  livePrice: number,
  level: number,
  side: "long" | "short",
  kind: "entry" | "exit" | "stop"
): string {
  // (live − level) / level — positive means live is above the level
  const liveVsLevel = priceMovePct(level, livePrice);
  const abs = Math.abs(liveVsLevel).toFixed(2);
  if (Math.abs(liveVsLevel) < 0.005) {
    if (kind === "entry") return "at entry";
    if (kind === "exit") return "at target";
    return "at stop";
  }

  if (kind === "stop") {
    if (side === "long") {
      return liveVsLevel < 0
        ? `${abs}% below (toward stop)`
        : `${abs}% above stop`;
    }
    return liveVsLevel > 0
      ? `${abs}% above (toward stop)`
      : `${abs}% below stop`;
  }

  if (kind === "exit") {
    if (side === "long") {
      return liveVsLevel > 0
        ? `${abs}% above (past target)`
        : `${abs}% below target`;
    }
    return liveVsLevel < 0
      ? `${abs}% below (past target)`
      : `${abs}% above target`;
  }

  // entry — waiting for fill
  if (side === "long") {
    return liveVsLevel > 0
      ? `${abs}% above entry — wait for pullback`
      : `${abs}% below entry`;
  }
  return liveVsLevel < 0
    ? `${abs}% below entry — wait for bounce`
    : `${abs}% above entry`;
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
  const inEntryZone = Math.abs(livePrice - entryPrice) <= entryZone;

  if (side === "long") {
    if (livePrice <= structuralStop) return "invalidated";
    if (livePrice >= exitPrice) return "target_hit";
    if (inEntryZone) return "at_entry";
    return "active";
  }

  if (side === "short") {
    if (livePrice >= structuralStop) return "invalidated";
    if (livePrice <= exitPrice) return "target_hit";
    if (inEntryZone) return "at_entry";
    // Already dumped through the short limit with no R:R left — don't wait 30 min for a bounce.
    if (livePrice < entryPrice) {
      const rr = rewardRiskRatio("short", livePrice, exitPrice, structuralStop);
      if (rr < SCALP_MIN_REWARD_RISK) return "missed";
    }
    return "active";
  }

  return "active";
}

export function planStatusLabel(
  status: ScalpPlanStatus,
  ctx?: {
    side?: "long" | "short";
    entryPrice?: number | null;
    stopPrice?: number | null;
    entryMode?: "limit" | "market" | null;
  }
): string {
  const entryFmt =
    ctx?.entryPrice != null && Number.isFinite(ctx.entryPrice)
      ? `$${ctx.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
      : null;
  const stopFmt =
    ctx?.stopPrice != null && Number.isFinite(ctx.stopPrice)
      ? `$${ctx.stopPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
      : null;

  switch (status) {
    case "active":
      if (ctx?.entryMode === "limit" && entryFmt) {
        return ctx.side === "long"
          ? `Waiting for price to reach limit entry ${entryFmt}`
          : ctx.side === "short"
            ? `Waiting for price to reach limit entry ${entryFmt}`
            : `Waiting for limit entry ${entryFmt}`;
      }
      if (ctx?.entryMode === "market") return "Enter now — price at entry zone";
      return "Active — waiting for entry";
    case "at_entry":
      return "At entry zone — you can enter now";
    case "invalidated":
      return stopFmt ? `Invalidated — price hit stop ${stopFmt}` : "Invalidated — refresh plan";
    case "target_hit":
      return "Target reached before entry — re-scan";
    case "missed":
      return "Too late to chase — remaining R:R under 1. Don't wait for a bounce.";
    case "stale":
      return "Stale (30+ min) — refresh recommended";
    default:
      return "";
  }
}

/** Extra line under the status badge — explains auto-updates. */
export function planStatusHint(
  status: ScalpPlanStatus,
  ctx?: {
    side?: "long" | "short";
    entryPrice?: number | null;
    entryMode?: "limit" | "market" | null;
    livePrice?: number | null;
  }
): string {
  if (status === "invalidated") {
    return "This plan is dead. Tap Refresh plan or Find quick wins below.";
  }
  if (status === "target_hit") {
    return "Price reached the exit target before you entered. Run a fresh scan.";
  }
  if (status === "missed") {
    return "Live already moved through the limit toward the target. Remaining reward is smaller than stop risk — skip this wait and refresh for a new plan.";
  }
  if (status === "stale") {
    return "Levels are old. Refresh for a new plan based on current structure.";
  }
  if (status === "at_entry") {
    return "Status updates automatically every ~12s while this page is open (or while Watch is on).";
  }
  if (status === "active" && ctx?.entryMode === "limit" && ctx.entryPrice != null && ctx.livePrice != null) {
    const need =
      ctx.side === "long"
        ? ctx.livePrice > ctx.entryPrice
          ? "drop"
          : "rise"
        : ctx.livePrice < ctx.entryPrice
          ? "rise"
          : "drop";
    return `Watching live price — flips to "At entry zone" when price ${need}s to your limit (~12s). Prefer Watch over Refresh: Refresh can wipe a waiting plan if structure turns mid-range.`;
  }
  return "Status updates automatically every ~12s. Turn on Watch to get alerts if you leave this tab.";
}

export function planStatusTone(
  status: ScalpPlanStatus
): "neutral" | "good" | "warn" | "bad" {
  switch (status) {
    case "at_entry":
      return "good";
    case "invalidated":
    case "target_hit":
    case "missed":
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

/** Post-entry: has live price hit take-profit or stop-loss? */
export function computeActiveTradeHit(input: {
  side: "long" | "short";
  livePrice: number | null;
  exitPrice: number | null;
  stopLossPrice: number | null;
}): "target_hit" | "stop_hit" | null {
  if (input.livePrice == null || !Number.isFinite(input.livePrice)) return null;
  const { side, livePrice, exitPrice, stopLossPrice } = input;
  if (side === "long") {
    if (stopLossPrice != null && Number.isFinite(stopLossPrice) && livePrice <= stopLossPrice) return "stop_hit";
    if (exitPrice != null && Number.isFinite(exitPrice) && livePrice >= exitPrice) return "target_hit";
    return null;
  }
  if (stopLossPrice != null && Number.isFinite(stopLossPrice) && livePrice >= stopLossPrice) return "stop_hit";
  if (exitPrice != null && Number.isFinite(exitPrice) && livePrice <= exitPrice) return "target_hit";
  return null;
}

export function activeTradeHitLabel(
  hit: "target_hit" | "stop_hit",
  ctx?: { exitPrice?: number | null; stopLossPrice?: number | null }
): string {
  const tp =
    ctx?.exitPrice != null && Number.isFinite(ctx.exitPrice)
      ? `$${ctx.exitPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
      : null;
  const sl =
    ctx?.stopLossPrice != null && Number.isFinite(ctx.stopLossPrice)
      ? `$${ctx.stopLossPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
      : null;
  if (hit === "target_hit") {
    return tp
      ? `Take profit reached at ${tp} — close the trade and mark Win`
      : "Take profit reached — close and mark Win";
  }
  return sl
    ? `Stop loss hit at ${sl} — close the trade and mark Loss`
    : "Stop loss hit — close and mark Loss";
}
