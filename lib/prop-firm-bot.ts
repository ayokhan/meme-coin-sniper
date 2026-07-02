export type ChallengeProfile = "topstep_50k" | "topstep_100k" | "custom";

export type PropFirmConfig = {
  profile: ChallengeProfile;
  accountSize: number;
  dailyLossLimit: number;
  maxDrawdownLimit: number;
  profitTarget: number;
  maxContracts: number;
  maxRiskPerTradePct: number;
  maxTradesPerDay: number;
};

export type SessionState = {
  startBalance: number;
  currentBalance: number;
  todaysPnl: number;
  openRiskUsd: number;
  tradesToday: number;
  challengeStartedAt: string | null;
};

export type SyncedPosition = {
  instId: string;
  posSide: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  margin: number | null;
  leverage: number | null;
};

export type PropFirmMetrics = {
  totalPnl: number;
  remainingToTarget: number;
  remainingDailyLoss: number;
  remainingDrawdown: number;
  perTradeRiskCap: number;
  breachDaily: boolean;
  breachDrawdown: boolean;
  profitTargetHit: boolean;
  riskBlocked: boolean;
  contractBlocked: boolean;
  canEnter: boolean;
};

export type GuardSeverity = "allow" | "caution" | "stop";

export type PropFirmGuards = {
  entry: { severity: GuardSeverity; headline: string; detail: string };
  exit: { severity: GuardSeverity; headline: string; detail: string };
  positionNotes: Array<{ instId: string; headline: string; detail: string; severity: GuardSeverity }>;
};

export const PROP_FIRM_STORAGE_KEY = "novastaris_prop_firm_bot_v1";

export function presetPropFirmConfig(profile: ChallengeProfile): PropFirmConfig {
  if (profile === "topstep_100k") {
    return {
      profile,
      accountSize: 100000,
      dailyLossLimit: 3000,
      maxDrawdownLimit: 4500,
      profitTarget: 6000,
      maxContracts: 6,
      maxRiskPerTradePct: 0.4,
      maxTradesPerDay: 8,
    };
  }
  if (profile === "topstep_50k") {
    return {
      profile,
      accountSize: 50000,
      dailyLossLimit: 1500,
      maxDrawdownLimit: 2000,
      profitTarget: 3000,
      maxContracts: 3,
      maxRiskPerTradePct: 0.35,
      maxTradesPerDay: 6,
    };
  }
  return {
    profile: "custom",
    accountSize: 50000,
    dailyLossLimit: 1500,
    maxDrawdownLimit: 2000,
    profitTarget: 3000,
    maxContracts: 3,
    maxRiskPerTradePct: 0.35,
    maxTradesPerDay: 6,
  };
}

export function defaultSessionState(accountSize: number): SessionState {
  return {
    startBalance: accountSize,
    currentBalance: accountSize,
    todaysPnl: 0,
    openRiskUsd: 0,
    tradesToday: 0,
    challengeStartedAt: null,
  };
}

export type PropFirmPersisted = {
  cfg: PropFirmConfig;
  state: SessionState;
  symbol: string;
  aiSetupNote: string;
  autoSync: boolean;
};

export function readPropFirmPersisted(): PropFirmPersisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROP_FIRM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PropFirmPersisted>;
    if (!parsed.cfg || !parsed.state) return null;
    return {
      cfg: { ...presetPropFirmConfig("topstep_50k"), ...parsed.cfg },
      state: { ...defaultSessionState(parsed.cfg.accountSize ?? 50000), ...parsed.state },
      symbol: parsed.symbol ?? "NQ",
      aiSetupNote: parsed.aiSetupNote ?? "Trade only A+ setups. No revenge trades. Pause after two losses.",
      autoSync: parsed.autoSync ?? true,
    };
  } catch {
    return null;
  }
}

export function writePropFirmPersisted(data: PropFirmPersisted): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROP_FIRM_STORAGE_KEY, JSON.stringify(data));
}

export function computePropFirmMetrics(
  cfg: PropFirmConfig,
  state: SessionState,
  openContracts = 0
): PropFirmMetrics {
  const totalPnl = state.currentBalance - cfg.accountSize;
  const remainingToTarget = Math.max(0, cfg.profitTarget - totalPnl);
  const remainingDailyLoss = cfg.dailyLossLimit + Math.min(0, state.todaysPnl) - state.openRiskUsd;
  const remainingDrawdown = cfg.maxDrawdownLimit + Math.min(0, totalPnl) - state.openRiskUsd;
  const perTradeRiskCap = (cfg.maxRiskPerTradePct / 100) * cfg.accountSize;
  const breachDaily = remainingDailyLoss <= 0;
  const breachDrawdown = remainingDrawdown <= 0;
  const profitTargetHit = totalPnl >= cfg.profitTarget;
  const riskBlocked = state.openRiskUsd > perTradeRiskCap;
  const contractBlocked = openContracts >= cfg.maxContracts;
  const canEnter =
    !breachDaily &&
    !breachDrawdown &&
    !profitTargetHit &&
    !riskBlocked &&
    !contractBlocked &&
    state.tradesToday < cfg.maxTradesPerDay;

  return {
    totalPnl,
    remainingToTarget,
    remainingDailyLoss,
    remainingDrawdown,
    perTradeRiskCap,
    breachDaily,
    breachDrawdown,
    profitTargetHit,
    riskBlocked,
    contractBlocked,
    canEnter,
  };
}

export function computePropFirmGuards(
  cfg: PropFirmConfig,
  state: SessionState,
  positions: SyncedPosition[] = [],
  proposedRiskUsd = 0
): PropFirmGuards {
  const openContracts = positions.reduce((s, p) => s + p.size, 0);
  const calc = computePropFirmMetrics(cfg, state, openContracts);
  const positionNotes: PropFirmGuards["positionNotes"] = [];

  for (const p of positions) {
    if (p.unrealizedPnl < 0 && Math.abs(p.unrealizedPnl) > calc.remainingDailyLoss * 0.4) {
      positionNotes.push({
        instId: p.instId,
        severity: "caution",
        headline: "High daily risk",
        detail: `${p.instId} unrealized ${p.unrealizedPnl.toFixed(2)} USD — consider cutting before daily limit.`,
      });
    }
    if (p.unrealizedPnl > 0 && calc.profitTargetHit) {
      positionNotes.push({
        instId: p.instId,
        severity: "caution",
        headline: "Target hit — protect",
        detail: `${p.instId} in profit; reduce or close to protect challenge pass.`,
      });
    }
    if (p.margin != null && p.margin > calc.perTradeRiskCap) {
      positionNotes.push({
        instId: p.instId,
        severity: "caution",
        headline: "Oversized margin",
        detail: `Margin $${p.margin.toFixed(2)} exceeds per-trade cap $${calc.perTradeRiskCap.toFixed(2)}.`,
      });
    }
  }

  let entrySeverity: GuardSeverity = "allow";
  let entryHeadline = "ENTRY ALLOWED";
  let entryDetail = "One A+ setup only — size to per-trade risk cap and hard stop.";

  if (calc.breachDaily) {
    entrySeverity = "stop";
    entryHeadline = "ENTRY BLOCKED — daily loss limit";
    entryDetail = "Daily loss guardrail reached. No new entries until next session.";
  } else if (calc.breachDrawdown) {
    entrySeverity = "stop";
    entryHeadline = "ENTRY BLOCKED — max drawdown";
    entryDetail = "Challenge drawdown limit reached. Stop trading for this evaluation.";
  } else if (calc.profitTargetHit) {
    entrySeverity = "stop";
    entryHeadline = "ENTRY BLOCKED — profit target hit";
    entryDetail = "Target reached. Protect gains — avoid unnecessary new risk.";
  } else if (state.tradesToday >= cfg.maxTradesPerDay) {
    entrySeverity = "stop";
    entryHeadline = "ENTRY PAUSED — trade count";
    entryDetail = `Already ${state.tradesToday} trades today (max ${cfg.maxTradesPerDay}).`;
  } else if (calc.contractBlocked) {
    entrySeverity = "stop";
    entryHeadline = "ENTRY BLOCKED — max contracts";
    entryDetail = `Open size ${openContracts} at max ${cfg.maxContracts} contracts.`;
  } else if (calc.riskBlocked) {
    entrySeverity = "caution";
    entryHeadline = "ENTRY CAUTION — open risk high";
    entryDetail = "Reduce open risk before adding size.";
  } else if (proposedRiskUsd > 0) {
    const afterRisk = state.openRiskUsd + proposedRiskUsd;
    if (afterRisk > calc.perTradeRiskCap) {
      entrySeverity = "stop";
      entryHeadline = "ENTRY BLOCKED — proposed risk too large";
      entryDetail = `Proposed $${proposedRiskUsd.toFixed(2)} + open $${state.openRiskUsd.toFixed(2)} exceeds cap $${calc.perTradeRiskCap.toFixed(2)}.`;
    } else if (proposedRiskUsd > calc.remainingDailyLoss) {
      entrySeverity = "stop";
      entryHeadline = "ENTRY BLOCKED — exceeds daily buffer";
      entryDetail = `Proposed risk $${proposedRiskUsd.toFixed(2)} exceeds remaining daily loss room $${calc.remainingDailyLoss.toFixed(2)}.`;
    } else if (proposedRiskUsd > calc.remainingDrawdown) {
      entrySeverity = "stop";
      entryHeadline = "ENTRY BLOCKED — exceeds drawdown room";
      entryDetail = `Proposed risk exceeds remaining drawdown buffer $${calc.remainingDrawdown.toFixed(2)}.`;
    } else {
      entrySeverity = "allow";
      entryHeadline = "ENTRY CLEAR";
      entryDetail = `Proposed risk $${proposedRiskUsd.toFixed(2)} is within challenge limits.`;
    }
  } else if (state.tradesToday >= cfg.maxTradesPerDay - 1) {
    entrySeverity = "caution";
    entryHeadline = "ENTRY CAUTION — last trade slot";
    entryDetail = "One trade left today — only highest conviction.";
  }

  let exitSeverity: GuardSeverity = "allow";
  let exitHeadline = "HOLD / MANAGE";
  let exitDetail = "Trail stops; respect playbook.";

  if (positions.length === 0) {
    exitHeadline = "NO OPEN POSITIONS";
    exitDetail = calc.canEnter ? "Flat — wait for A+ setup." : "Flat — guardrails block new entries.";
  } else if (calc.breachDaily || calc.breachDrawdown) {
    exitSeverity = "stop";
    exitHeadline = "EXIT — flatten risk";
    exitDetail = "Guardrail breached. Close or reduce all open positions.";
  } else if (calc.profitTargetHit) {
    exitSeverity = "caution";
    exitHeadline = "EXIT / PROTECT — near or at target";
    exitDetail = "Take partial or full profits; do not give back gains.";
  } else if (state.todaysPnl > cfg.dailyLossLimit * 0.6 && positions.some((p) => p.unrealizedPnl < 0)) {
    exitSeverity = "caution";
    exitHeadline = "EXIT CAUTION — daily buffer low";
    exitDetail = "Losing day with limited room — cut losers early.";
  } else if (calc.remainingToTarget < cfg.profitTarget * 0.15 && positions.some((p) => p.unrealizedPnl > 0)) {
    exitSeverity = "caution";
    exitHeadline = "PROTECT — close to target";
    exitDetail = "Small cushion to pass — secure winners.";
  }

  return {
    entry: { severity: entrySeverity, headline: entryHeadline, detail: entryDetail },
    exit: { severity: exitSeverity, headline: exitHeadline, detail: exitDetail },
    positionNotes,
  };
}

export function applyBlofinSyncToState(
  cfg: PropFirmConfig,
  state: SessionState,
  sync: {
    todaysRealizedPnl: number;
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    openRiskUsd: number;
    tradesToday: number;
    openContracts: number;
  }
): SessionState {
  const totalPnl = sync.totalRealizedPnl + sync.totalUnrealizedPnl;
  const todaysPnl = sync.todaysRealizedPnl + sync.totalUnrealizedPnl;
  return {
    ...state,
    startBalance: cfg.accountSize,
    currentBalance: cfg.accountSize + totalPnl,
    todaysPnl,
    openRiskUsd: sync.openRiskUsd,
    tradesToday: sync.tradesToday,
    challengeStartedAt: state.challengeStartedAt ?? new Date().toISOString(),
  };
}

export function guardSeverityClass(severity: GuardSeverity): string {
  if (severity === "stop") return "border-rose-400/70 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100";
  if (severity === "caution") return "border-amber-400/70 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100";
  return "border-emerald-400/70 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100";
}
