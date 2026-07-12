"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, RefreshCw, Shield, ShieldAlert, ShieldCheck, Link2, Hand, ListOrdered, LineChart, Sparkles } from "lucide-react";
import type { NovaScalpAnalysis } from "@/lib/nova-scalp-agent";
import { SCALP_TIMEFRAMES } from "@/lib/nova-scalp-agent";
import {
  combinePropFirmVerdict,
  riskAtStopFromSetup,
  verdictSeverityClass,
} from "@/lib/prop-firm-setup";
import {
  computePropFirmGuards,
  computePropFirmMetrics,
  defaultSessionState,
  guardSeverityClass,
  presetPropFirmConfig,
  PROP_FIRM_PRIMARY_MARKETS,
  readPropFirmPersisted,
  writePropFirmPersisted,
  type ChallengeProfile,
  type PropFirmConfig,
  type PropFirmGuards,
  type PropFirmTrackingMode,
  type SessionState,
  type SyncedPosition,
} from "@/lib/prop-firm-bot";
import { BlofinPartnerPromoBanner } from "@/components/BlofinPartnerPromoBanner";

type BlofinStatus = {
  configured: boolean;
  blofinDemo?: boolean;
  credentialSource?: string;
  error?: string;
  blofinIntegrationEnabled?: boolean;
};

type SyncResponse = {
  success: boolean;
  error?: string;
  state?: SessionState;
  positions?: SyncedPosition[];
  metrics?: ReturnType<typeof computePropFirmMetrics>;
  guards?: PropFirmGuards;
  syncedAt?: string;
};

export default function PropFirmBotPanel() {
  const [cfg, setCfg] = useState<PropFirmConfig>(() => presetPropFirmConfig("topstep_50k"));
  const [state, setState] = useState<SessionState>(() => defaultSessionState(50000));
  const [symbol, setSymbol] = useState("BTC");
  const [customSymbol, setCustomSymbol] = useState("");
  const [aiSetupNote, setAiSetupNote] = useState(
    "Trade only A+ setups. No revenge trades. Pause after two losses."
  );
  const [trackingMode, setTrackingMode] = useState<PropFirmTrackingMode>("manual");
  const [autoSync, setAutoSync] = useState(true);
  const [blofinSyncDemo, setBlofinSyncDemo] = useState(true);
  const [proposedRiskUsd, setProposedRiskUsd] = useState("");
  const [positions, setPositions] = useState<SyncedPosition[]>([]);
  const [challengeActive, setChallengeActive] = useState(false);
  const [blofinStatus, setBlofinStatus] = useState<BlofinStatus>({ configured: false, blofinIntegrationEnabled: true });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [showBlofinForm, setShowBlofinForm] = useState(false);
  const [blofinKeys, setBlofinKeys] = useState({ apiKey: "", secretKey: "", passphrase: "", demoMode: true });
  const [savingKeys, setSavingKeys] = useState(false);
  const [entryCheckedAt, setEntryCheckedAt] = useState<string | null>(null);
  const [setup, setSetup] = useState<NovaScalpAnalysis | null>(null);
  const [setupChart, setSetupChart] = useState<{
    closes: number[];
    currentPrice: number | null;
    timeframeLabel: string;
  } | null>(null);
  const [resetMsg, setResetMsg] = useState("");
  const [analyzingSetup, setAnalyzingSetup] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupTimeframe, setSetupTimeframe] = useState("15m");
  const hydrated = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readPropFirmPersisted();
    if (saved) {
      setCfg(saved.cfg);
      setState(saved.state);
      setSymbol(
        PROP_FIRM_PRIMARY_MARKETS.some((m) => m.value === saved.symbol) ? saved.symbol : "CUSTOM"
      );
      if (!PROP_FIRM_PRIMARY_MARKETS.some((m) => m.value === saved.symbol)) {
        setCustomSymbol(saved.symbol);
      }
      setAiSetupNote(saved.aiSetupNote);
      setAutoSync(saved.autoSync);
      setBlofinSyncDemo(saved.blofinSyncDemo);
      setTrackingMode(saved.trackingMode);
      setChallengeActive(!!saved.state.challengeStartedAt);
    }
    hydrated.current = true;
    setReady(true);
  }, []);

  const blofinIntegrationEnabled = blofinStatus.blofinIntegrationEnabled !== false;

  useEffect(() => {
    if (!ready || blofinIntegrationEnabled) return;
    if (trackingMode === "blofin") setTrackingMode("manual");
  }, [ready, blofinIntegrationEnabled, trackingMode]);

  const displaySymbol = symbol === "CUSTOM" ? customSymbol.trim().toUpperCase() || "CUSTOM" : symbol;
  const openContracts = positions.reduce((s, p) => s + p.size, 0);

  useEffect(() => {
    if (!hydrated.current) return;
    writePropFirmPersisted({
      cfg,
      state,
      symbol: displaySymbol,
      aiSetupNote,
      autoSync,
      blofinSyncDemo,
      trackingMode,
    });
  }, [cfg, state, displaySymbol, aiSetupNote, autoSync, blofinSyncDemo, trackingMode]);

  const localMetrics = useMemo(
    () => computePropFirmMetrics(cfg, state, openContracts),
    [cfg, state, openContracts]
  );

  const localGuards = useMemo(
    () => computePropFirmGuards(cfg, state, positions, Number(proposedRiskUsd) || 0),
    [cfg, state, positions, proposedRiskUsd]
  );

  const activeGuards = localGuards;
  const activeMetrics = localMetrics;
  const combined = useMemo(
    () => combinePropFirmVerdict(activeGuards, setup, Number(proposedRiskUsd) || 0),
    [activeGuards, setup, proposedRiskUsd]
  );

  const analyzeSetup = async () => {
    setAnalyzingSetup(true);
    setSetupError("");
    try {
      const res = await fetch("/api/prop-firm-bot/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: displaySymbol,
          timeframeId: setupTimeframe,
          perTradeRiskCapUsd: activeMetrics.perTradeRiskCap,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSetupError(data.error ?? "Setup analysis failed.");
        return;
      }
      setSetup(data.analysis as NovaScalpAnalysis);
      if (data.chart) {
        setSetupChart({
          closes: data.chart.closes ?? [],
          currentPrice: data.chart.currentPrice ?? null,
          timeframeLabel: data.chart.timeframeLabel ?? setupTimeframe,
        });
      }
      const risk = data.proposedRiskUsd ?? riskAtStopFromSetup(data.analysis);
      if (risk > 0) setProposedRiskUsd(String(risk));
    } catch {
      setSetupError("Setup analysis failed.");
    } finally {
      setAnalyzingSetup(false);
    }
  };

  const loadBlofinStatus = useCallback(async () => {
    try {
      const [syncRes, configRes] = await Promise.all([
        fetch("/api/prop-firm-bot/sync"),
        fetch("/api/user/blofin-config"),
      ]);
      const data = await syncRes.json();
      const configData = await configRes.json().catch(() => ({}));
      if (typeof configData.demoMode === "boolean") {
        setBlofinSyncDemo(configData.demoMode);
        setBlofinKeys((k) => ({ ...k, demoMode: configData.demoMode }));
      }
      setBlofinStatus({
        configured: !!data.configured,
        blofinDemo: data.blofin?.blofinDemo ?? configData.demoMode,
        credentialSource: data.blofin?.credentialSource ?? configData.credentialSource,
        error: data.error,
        blofinIntegrationEnabled: data.blofinIntegrationEnabled !== false,
      });
      return !!data.configured && data.blofinIntegrationEnabled !== false;
    } catch {
      setBlofinStatus({ configured: false, error: "Could not check Blofin status." });
      return false;
    }
  }, []);

  const runSync = useCallback(
    async (riskOverride?: number, stateOverride?: SessionState) => {
      if (trackingMode !== "blofin" || blofinStatus.blofinIntegrationEnabled === false) return;
      setSyncing(true);
      setSyncError("");
      try {
        const proposed = riskOverride ?? (Number(proposedRiskUsd) || 0);
        const res = await fetch("/api/prop-firm-bot/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cfg,
            state: stateOverride ?? state,
            proposedRiskUsd: proposed,
            blofinDemo: blofinSyncDemo,
          }),
        });
        const data = (await res.json()) as SyncResponse;
        if (!res.ok || !data.success) {
          setSyncError(data.error ?? "Sync failed.");
          if (data.error?.toLowerCase().includes("blofin")) setShowBlofinForm(true);
          return;
        }
        if (data.state) setState(data.state);
        if (data.positions) setPositions(data.positions);
        if (data.syncedAt) setLastSyncedAt(data.syncedAt);
        setBlofinStatus((s) => ({ ...s, configured: true }));
      } catch {
        setSyncError("Sync failed — check connection.");
      } finally {
        setSyncing(false);
      }
    },
    [cfg, state, proposedRiskUsd, blofinSyncDemo, trackingMode, blofinStatus.blofinIntegrationEnabled]
  );

  useEffect(() => {
    if (!ready || trackingMode !== "blofin" || !blofinIntegrationEnabled) return;
    let cancelled = false;
    void loadBlofinStatus().then((ok) => {
      if (!cancelled && ok) void runSync(0);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, trackingMode]);

  useEffect(() => {
    if (!ready) return;
    void loadBlofinStatus();
  }, [ready, loadBlofinStatus]);

  useEffect(() => {
    if (trackingMode !== "blofin" || !autoSync || !blofinStatus.configured || !blofinIntegrationEnabled) return;
    const id = setInterval(() => void runSync(0), 30000);
    return () => clearInterval(id);
  }, [trackingMode, autoSync, blofinStatus.configured, blofinIntegrationEnabled, runSync]);

  const checkEntry = () => {
    setEntryCheckedAt(new Date().toLocaleTimeString());
    if (trackingMode === "blofin" && blofinStatus.configured) {
      void runSync(Number(proposedRiskUsd) || 0);
    }
  };

  const setBlofinEnvironment = async (demo: boolean) => {
    setBlofinSyncDemo(demo);
    setBlofinKeys((k) => ({ ...k, demoMode: demo }));
    if (blofinStatus.configured && blofinStatus.credentialSource === "saved") {
      await fetch("/api/user/blofin-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoMode: demo }),
      }).catch(() => {});
    }
    if (trackingMode === "blofin") void runSync(Number(proposedRiskUsd) || 0);
  };

  const saveBlofinKeys = async () => {
    setSavingKeys(true);
    setSyncError("");
    try {
      const res = await fetch("/api/user/blofin-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(blofinKeys),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSyncError(data.error ?? "Failed to save Blofin keys.");
        return;
      }
      setShowBlofinForm(false);
      setBlofinSyncDemo(blofinKeys.demoMode);
      setBlofinKeys({ apiKey: "", secretKey: "", passphrase: "", demoMode: blofinKeys.demoMode });
      setTrackingMode("blofin");
      await loadBlofinStatus();
      await runSync(0);
    } catch {
      setSyncError("Failed to save Blofin keys.");
    } finally {
      setSavingKeys(false);
    }
  };

  const startChallenge = () => {
    const next = defaultSessionState(cfg.accountSize);
    next.challengeStartedAt = new Date().toISOString();
    setState(next);
    setPositions([]);
    setChallengeActive(true);
    setProposedRiskUsd("");
    setEntryCheckedAt(null);
    setSetup(null);
    setSetupChart(null);
  };

  const resetTradingDay = () => {
    const nowIso = new Date().toISOString();
    const next: SessionState = {
      ...state,
      tradesToday: 0,
      todaysPnl: 0,
      openRiskUsd: trackingMode === "blofin" ? state.openRiskUsd : 0,
      dayResetAt: nowIso,
    };
    setState(next);
    setResetMsg(
      trackingMode === "blofin"
        ? "Trading day counters reset. Next Blofin sync only counts fills after now (open positions still show)."
        : "Trading day counters cleared for manual tracking."
    );
    window.setTimeout(() => setResetMsg(""), 6000);
    if (trackingMode === "blofin" && blofinStatus.configured) {
      void runSync(0, next);
    }
  };

  const GuardIcon = ({ severity }: { severity: "allow" | "caution" | "stop" }) => {
    if (severity === "stop") return <ShieldAlert className="h-5 w-5 shrink-0" />;
    if (severity === "caution") return <Shield className="h-5 w-5 shrink-0" />;
    return <ShieldCheck className="h-5 w-5 shrink-0" />;
  };

  function MiniSetupChart({
    closes,
    entry,
    stop,
    target,
  }: {
    closes: number[];
    entry: number | null;
    stop: number | null;
    target: number | null;
  }) {
    if (closes.length < 2) return null;
    const min = Math.min(...closes, ...(stop != null ? [stop] : []), ...(target != null ? [target] : []));
    const max = Math.max(...closes, ...(entry != null ? [entry] : []), ...(target != null ? [target] : []));
    const range = max - min || 1;
    const w = 320;
    const h = 100;
    const pad = 4;
    const toY = (p: number) => pad + (h - pad * 2) * (1 - (p - min) / range);
    const toX = (i: number) => pad + ((w - pad * 2) * i) / (closes.length - 1);
    const line = closes.map((c, i) => `${toX(i)},${toY(c)}`).join(" ");
    const level = (price: number | null, color: string, label: string) => {
      if (price == null || !Number.isFinite(price)) return null;
      const y = toY(price);
      return (
        <g key={label}>
          <line x1={pad} y1={y} x2={w - pad} y2={y} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.85} />
          <text x={w - pad} y={y - 2} textAnchor="end" fontSize={8} fill={color}>
            {label}
          </text>
        </g>
      );
    };
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md h-24 rounded border border-zinc-700/50 bg-zinc-950/50">
        <polyline points={line} fill="none" stroke="#22d3ee" strokeWidth={1.5} />
        {level(entry, "#34d399", "Entry")}
        {level(stop, "#f87171", "Stop")}
        {level(target, "#a78bfa", "Target")}
      </svg>
    );
  }

  return (
    <div className="mx-6 py-8 max-w-4xl space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent flex items-center gap-2 flex-wrap">
          <Flame className="h-7 w-7 text-amber-500 dark:text-amber-400 shrink-0 animate-flame-flicker" aria-hidden />
          <span>Nova Prop Firm Challenge</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Challenge workbook — rules + live setup plan</p>
      </div>

      <Card className={`border-2 ${verdictSeverityClass(combined.verdict)}`}>
        <CardContent className="py-4">
          <p className="text-lg font-bold tracking-wide">{combined.headline}</p>
          <p className="text-xs mt-2 opacity-90">{combined.detail}</p>
        </CardContent>
      </Card>

      <Card className="border-violet-200/60 dark:border-violet-800/50 bg-violet-50/30 dark:bg-violet-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            This is a <strong>challenge workbook</strong> — not an auto-trader. You set firm rules (daily loss, drawdown,
            profit target), then use a <strong>live setup plan</strong> for entry / stop / target. You still place
            orders on Blofin (or manually).
          </p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>
              <strong>Tracking mode</strong> — Manual (type PnL) or Blofin sync (auto from your keys).
            </li>
            <li>
              <strong>Start new challenge</strong> — sets your evaluation baseline.
            </li>
            <li>
              <strong>Analyze setup</strong> — pick a timeframe (incl. 4H / 1D), then get side, entry, stop, target.
            </li>
            <li>
              <strong>Read the top verdict</strong> — DO NOT ENTER / WAIT / CLEAR combines rules + setup quality.
            </li>
            <li>
              <strong>Entry / Exit guards</strong> — go / no-go for challenge risk (Blofin mode also sees open positions).
            </li>
            <li>
              <strong>Reset trading day</strong> — zeros today&apos;s trade count &amp; day PnL (Blofin: only counts
              fills after the reset).
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Tracking mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={trackingMode === "manual" ? "default" : "outline"}
              className={trackingMode === "manual" ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""}
              onClick={() => setTrackingMode("manual")}
            >
              <Hand className="h-4 w-4 mr-1" />
              Manual{blofinIntegrationEnabled ? " (no Blofin)" : ""}
            </Button>
            {blofinIntegrationEnabled && (
              <Button
                type="button"
                size="sm"
                variant={trackingMode === "blofin" ? "default" : "outline"}
                className={trackingMode === "blofin" ? "bg-cyan-600 hover:bg-cyan-700 text-white" : ""}
                onClick={() => setTrackingMode("blofin")}
              >
                <Link2 className="h-4 w-4 mr-1" />
                Blofin auto-sync
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {!blofinIntegrationEnabled
              ? "Blofin auto-sync is turned off by admin. Use manual tracking — type PnL, open risk, and trades; guardrails still run."
              : trackingMode === "manual"
                ? "No exchange connection needed. You type PnL, open risk, and trades — guardrails still run."
                : "Connect Blofin keys below to pull positions and PnL automatically."}
          </p>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Challenge setup</CardTitle>
          {challengeActive && state.challengeStartedAt && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Challenge active since {new Date(state.challengeStartedAt).toLocaleString()}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs mb-1">Profile</label>
              <select
                value={cfg.profile}
                onChange={(e) => {
                  const next = e.target.value as ChallengeProfile;
                  const p = presetPropFirmConfig(next);
                  setCfg(p);
                  setState(defaultSessionState(p.accountSize));
                  setChallengeActive(false);
                }}
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
              >
                <option value="topstep_50k">Topstep-like 50k</option>
                <option value="topstep_100k">Topstep-like 100k</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1">Primary market</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
              >
                {PROP_FIRM_PRIMARY_MARKETS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {symbol === "CUSTOM" && (
                <input
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. DOGE"
                  className="mt-2 w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-xs mb-1">Max contracts (challenge rule)</label>
              <input
                type="number"
                value={cfg.maxContracts}
                onChange={(e) => setCfg((c) => ({ ...c, maxContracts: Number(e.target.value) || 1 }))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                ["Account", "accountSize"],
                ["Daily loss", "dailyLossLimit"],
                ["Max drawdown", "maxDrawdownLimit"],
                ["Profit target", "profitTarget"],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs mb-1">{label} (USD)</label>
                <input
                  type="number"
                  value={cfg[key]}
                  onChange={(e) => setCfg((c) => ({ ...c, [key]: Number(e.target.value) || 0 }))}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={startChallenge}
              className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-700 font-semibold"
            >
              Start new challenge
            </Button>
            <Button type="button" variant="outline" onClick={resetTradingDay}>
              Reset trading day
            </Button>
          </div>
          {resetMsg && <p className="text-xs text-emerald-600 dark:text-emerald-400">{resetMsg}</p>}
          {state.dayResetAt && (
            <p className="text-[11px] text-muted-foreground">
              Day counters anchored at {new Date(state.dayResetAt).toLocaleString()}
              {trackingMode === "blofin" ? " (Blofin fills before this are ignored for today)." : "."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-cyan-200/60 dark:border-cyan-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-500" />
            Live setup plan
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pulls live candles for {displaySymbol} — not a full TradingView chart, but real market structure for
            entry / stop / target.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs mb-1">Timeframe</label>
              <select
                value={setupTimeframe}
                onChange={(e) => setSetupTimeframe(e.target.value)}
                className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
              >
                {SCALP_TIMEFRAMES.filter((t) =>
                  ["5m", "15m", "30m", "1h", "2h", "4h", "1d"].includes(t.id)
                ).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
              disabled={analyzingSetup}
              onClick={() => void analyzeSetup()}
            >
              <LineChart className={`h-4 w-4 mr-1 ${analyzingSetup ? "animate-pulse" : ""}`} />
              {analyzingSetup ? "Analyzing…" : "Analyze setup"}
            </Button>
            {setupChart?.currentPrice != null && (
              <span className="text-xs text-muted-foreground">
                Live {displaySymbol}: <strong>{setupChart.currentPrice}</strong> · {setupChart.timeframeLabel}
              </span>
            )}
          </div>
          {setupError && <p className="text-xs text-rose-500">{setupError}</p>}
          {setupChart && setupChart.closes.length > 1 && (
            <MiniSetupChart
              closes={setupChart.closes}
              entry={setup?.entryPrice ?? null}
              stop={setup?.recommendedStopPrice ?? null}
              target={setup?.exitPrice ?? null}
            />
          )}
          {setup && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="rounded border p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Side</p>
                <p className="font-semibold capitalize">{setup.side.replace("_", " ")}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Entry</p>
                <p className="font-mono">{setup.entryPrice ?? "—"}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Stop</p>
                <p className="font-mono text-rose-600">{setup.recommendedStopPrice ?? "—"}</p>
              </div>
              <div className="rounded border p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Target</p>
                <p className="font-mono text-emerald-600">{setup.exitPrice ?? "—"}</p>
              </div>
            </div>
          )}
          {setup?.rationale && (
            <p className="text-xs text-muted-foreground border-l-2 border-cyan-500 pl-3">{setup.rationale}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className={`border-2 ${guardSeverityClass(activeGuards.entry.severity)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GuardIcon severity={activeGuards.entry.severity} />
              Entry guard · {displaySymbol}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{activeGuards.entry.headline}</p>
            <p className="text-xs mt-1 opacity-90">{activeGuards.entry.detail}</p>
          </CardContent>
        </Card>
        <Card className={`border-2 ${guardSeverityClass(activeGuards.exit.severity)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GuardIcon severity={activeGuards.exit.severity} />
              Exit guard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{activeGuards.exit.headline}</p>
            <p className="text-xs mt-1 opacity-90">{activeGuards.exit.detail}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Pre-entry risk check</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs mb-1">Planned risk at stop (USD)</label>
            <input
              type="number"
              min={0}
              value={proposedRiskUsd}
              onChange={(e) => setProposedRiskUsd(e.target.value)}
              placeholder="e.g. 175"
              className="w-36 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={checkEntry}
            className="bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            Check entry
          </Button>
          <p className="text-xs text-muted-foreground">
            Max loss if stop hits, before you open the trade. Per-trade cap: ${activeMetrics.perTradeRiskCap.toFixed(0)}
            {entryCheckedAt && (
              <span className="block text-emerald-600 dark:text-emerald-400 mt-1">Checked at {entryCheckedAt}</span>
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Live challenge state</CardTitle>
          <p className="text-xs text-muted-foreground">
            {trackingMode === "manual"
              ? "Manual mode — update these fields after each trade so guardrails stay accurate."
              : blofinStatus.configured
                ? "Blofin sync updates these; you can still edit manually."
                : "Connect Blofin in the section below for auto-updates."}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {(
              [
                ["Start balance", "startBalance"],
                ["Current balance", "currentBalance"],
                ["Today PnL", "todaysPnl"],
                ["Open risk USD", "openRiskUsd"],
                ["Trades today", "tradesToday"],
              ] as const
            ).map(([label, key]) => (
              <div key={key}>
                <label className="block text-xs mb-1">{label}</label>
                <input
                  type="number"
                  value={state[key]}
                  onChange={(e) => setState((s) => ({ ...s, [key]: Number(e.target.value) || 0 }))}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Total PnL</p>
              <p className={activeMetrics.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
                ${activeMetrics.totalPnl.toFixed(2)}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Remaining daily loss</p>
              <p className={activeMetrics.remainingDailyLoss > 0 ? "text-emerald-600" : "text-rose-600"}>
                ${activeMetrics.remainingDailyLoss.toFixed(2)}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Remaining drawdown</p>
              <p className={activeMetrics.remainingDrawdown > 0 ? "text-emerald-600" : "text-rose-600"}>
                ${activeMetrics.remainingDrawdown.toFixed(2)}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-xs text-muted-foreground">Remaining to target</p>
              <p>${activeMetrics.remainingToTarget.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {trackingMode === "blofin" && blofinIntegrationEnabled && (
        <Card className="border-cyan-200/60 dark:border-cyan-800/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Blofin sync (optional)
              </CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={blofinSyncDemo ? "default" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => void setBlofinEnvironment(true)}
                  >
                    Demo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!blofinSyncDemo ? "default" : "ghost"}
                    className="h-7 text-xs"
                    onClick={() => void setBlofinEnvironment(false)}
                  >
                    Live
                  </Button>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowBlofinForm((v) => !v)}>
                  {blofinStatus.configured ? "Update keys" : "Connect Blofin"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void runSync()}
                  disabled={syncing || !blofinStatus.configured}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                  Sync now
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <BlofinPartnerPromoBanner compact />
            {blofinStatus.configured ? (
              <p className="text-emerald-700 dark:text-emerald-300">
                Connected — {blofinSyncDemo ? "Demo" : "Live"}
                {lastSyncedAt && (
                  <span className="text-muted-foreground ml-2">
                    · Last sync {new Date(lastSyncedAt).toLocaleTimeString()}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-slate-600 dark:text-slate-300">
                Add Blofin API keys to auto-pull positions and PnL.
              </p>
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
              Auto-sync every 30s when connected
            </label>
            {syncError && <p className="text-rose-600 dark:text-rose-400 text-xs">{syncError}</p>}
            {showBlofinForm && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <input
                  type="password"
                  placeholder="API key"
                  value={blofinKeys.apiKey}
                  onChange={(e) => setBlofinKeys((k) => ({ ...k, apiKey: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 text-sm bg-white dark:bg-zinc-900"
                />
                <input
                  type="password"
                  placeholder="Secret key"
                  value={blofinKeys.secretKey}
                  onChange={(e) => setBlofinKeys((k) => ({ ...k, secretKey: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 text-sm bg-white dark:bg-zinc-900"
                />
                <input
                  type="password"
                  placeholder="Passphrase"
                  value={blofinKeys.passphrase}
                  onChange={(e) => setBlofinKeys((k) => ({ ...k, passphrase: e.target.value }))}
                  className="w-full rounded border px-2 py-1.5 text-sm bg-white dark:bg-zinc-900"
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={blofinKeys.demoMode}
                    onChange={(e) => setBlofinKeys((k) => ({ ...k, demoMode: e.target.checked }))}
                  />
                  Demo account (uncheck for live)
                </label>
                <Button type="button" size="sm" onClick={() => void saveBlofinKeys()} disabled={savingKeys}>
                  {savingKeys ? "Saving…" : "Save & sync"}
                </Button>
              </div>
            )}
            <div className="space-y-2">
              {positions.length > 0 ? (
                positions.map((p) => (
                  <div
                    key={`${p.instId}-${p.posSide}`}
                    className="flex flex-wrap justify-between gap-2 rounded border p-3 text-sm"
                  >
                    <span className="font-medium">
                      {p.instId} · {p.posSide} · {p.size} contracts
                    </span>
                    <span className={p.unrealizedPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      ${p.unrealizedPnl.toFixed(2)} uPnL
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  No open contracts on Blofin {blofinSyncDemo ? "Demo" : "Live"} yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Playbook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            rows={3}
            value={aiSetupNote}
            onChange={(e) => setAiSetupNote(e.target.value)}
            className="w-full rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}
