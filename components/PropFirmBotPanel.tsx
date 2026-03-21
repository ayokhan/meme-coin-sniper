"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ChallengeProfile = "topstep_50k" | "topstep_100k" | "custom";

type PropFirmConfig = {
  profile: ChallengeProfile;
  accountSize: number;
  dailyLossLimit: number;
  maxDrawdownLimit: number;
  profitTarget: number;
  maxContracts: number;
  maxRiskPerTradePct: number;
};

type SessionState = {
  startBalance: number;
  currentBalance: number;
  todaysPnl: number;
  openRiskUsd: number;
  tradesToday: number;
};

function preset(profile: ChallengeProfile): PropFirmConfig {
  if (profile === "topstep_100k") {
    return {
      profile,
      accountSize: 100000,
      dailyLossLimit: 3000,
      maxDrawdownLimit: 4500,
      profitTarget: 6000,
      maxContracts: 6,
      maxRiskPerTradePct: 0.4,
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
    };
  }
  return {
    profile,
    accountSize: 50000,
    dailyLossLimit: 1500,
    maxDrawdownLimit: 2000,
    profitTarget: 3000,
    maxContracts: 3,
    maxRiskPerTradePct: 0.35,
  };
}

export default function PropFirmBotPanel() {
  const [cfg, setCfg] = useState<PropFirmConfig>(preset("topstep_50k"));
  const [state, setState] = useState<SessionState>({
    startBalance: 50000,
    currentBalance: 50000,
    todaysPnl: 0,
    openRiskUsd: 0,
    tradesToday: 0,
  });
  const [symbol, setSymbol] = useState("NQ");
  const [aiSetupNote, setAiSetupNote] = useState(
    "Trade only A+ setups. No revenge trades. Pause after two losses."
  );

  const calc = useMemo(() => {
    const totalPnl = state.currentBalance - cfg.accountSize;
    const remainingToTarget = Math.max(0, cfg.profitTarget - totalPnl);
    const remainingDailyLoss = cfg.dailyLossLimit + Math.min(0, state.todaysPnl) - state.openRiskUsd;
    const remainingDrawdown = cfg.maxDrawdownLimit + Math.min(0, totalPnl) - state.openRiskUsd;
    const perTradeRiskCap = (cfg.maxRiskPerTradePct / 100) * cfg.accountSize;
    const breachDaily = remainingDailyLoss <= 0;
    const breachDrawdown = remainingDrawdown <= 0;
    const riskBlocked = state.openRiskUsd > perTradeRiskCap;
    return {
      totalPnl,
      remainingToTarget,
      remainingDailyLoss,
      remainingDrawdown,
      perTradeRiskCap,
      breachDaily,
      breachDrawdown,
      riskBlocked,
      canTrade: !breachDaily && !breachDrawdown && !riskBlocked,
    };
  }, [cfg, state]);

  const aiDecision = useMemo(() => {
    if (calc.breachDaily) return "STOP: Daily loss guardrail reached.";
    if (calc.breachDrawdown) return "STOP: Max drawdown guardrail reached.";
    if (calc.riskBlocked) return "REDUCE RISK: Open risk is above per-trade cap.";
    if (state.tradesToday >= 6) return "PAUSE: Trade count is high for challenge consistency.";
    if (calc.remainingToTarget <= 0) return "PASS STATE: Protect capital; avoid unnecessary trades.";
    return "ALLOW 1 SETUP: One high-confidence setup only, with hard stop.";
  }, [calc, state.tradesToday]);

  return (
    <div className="mx-6 py-8 max-w-4xl space-y-5">
      <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent">
        NovaStaris AI Prop Firm Bot (Owner)
      </h2>
      <p className="text-sm text-muted-foreground">
        Owner-only challenge assistant for prop-firm style rules (Topstep profile included). It focuses on rule protection and disciplined execution to improve pass probability.
      </p>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Challenge setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs mb-1">Profile</label>
              <select
                value={cfg.profile}
                onChange={(e) => {
                  const next = e.target.value as ChallengeProfile;
                  const p = preset(next);
                  setCfg(p);
                  setState((s) => ({ ...s, startBalance: p.accountSize, currentBalance: p.accountSize }));
                }}
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
              >
                <option value="topstep_50k">Topstep-like 50k</option>
                <option value="topstep_100k">Topstep-like 100k</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Instrument focus</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs mb-1">Max contracts</label>
              <input
                type="number"
                value={cfg.maxContracts}
                onChange={(e) => setCfg((c) => ({ ...c, maxContracts: Number(e.target.value) || 1 }))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Account", "accountSize"],
              ["Daily loss", "dailyLossLimit"],
              ["Max drawdown", "maxDrawdownLimit"],
              ["Profit target", "profitTarget"],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs mb-1">{label} (USD)</label>
                <input
                  type="number"
                  value={cfg[key as keyof PropFirmConfig] as number}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, [key]: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Live challenge state</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ["Start balance", "startBalance"],
              ["Current balance", "currentBalance"],
              ["Today PnL", "todaysPnl"],
              ["Open risk USD", "openRiskUsd"],
              ["Trades today", "tradesToday"],
            ].map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs mb-1">{label}</label>
                <input
                  type="number"
                  value={state[key as keyof SessionState] as number}
                  onChange={(e) =>
                    setState((s) => ({ ...s, [key]: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Remaining daily loss</p>
              <p className={calc.remainingDailyLoss > 0 ? "text-emerald-600" : "text-rose-600"}>
                ${calc.remainingDailyLoss.toFixed(2)}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Remaining drawdown</p>
              <p className={calc.remainingDrawdown > 0 ? "text-emerald-600" : "text-rose-600"}>
                ${calc.remainingDrawdown.toFixed(2)}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Remaining to target</p>
              <p>${calc.remainingToTarget.toFixed(2)}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Per-trade risk cap</p>
              <p>${calc.perTradeRiskCap.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">NovaStaris AI guardrail decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            rows={3}
            value={aiSetupNote}
            onChange={(e) => setAiSetupNote(e.target.value)}
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
            placeholder="Add your playbook notes for challenge discipline..."
          />
          <div className="rounded border border-cyan-300/60 bg-cyan-50/70 dark:bg-cyan-950/20 p-3">
            <p className="text-xs text-muted-foreground mb-1">Decision for {symbol}</p>
            <p className="font-medium">{aiDecision}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Playbook note: {aiSetupNote}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setState((s) => ({ ...s, tradesToday: 0, todaysPnl: 0, openRiskUsd: 0 }))}
            >
              Reset trading day
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Important: this module is a discipline and risk-control copilot. It cannot guarantee passing every challenge.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

