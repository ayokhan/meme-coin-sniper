"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, RefreshCw, Shield, ShieldAlert, ShieldCheck, Link2 } from "lucide-react";
import {
  computePropFirmGuards,
  computePropFirmMetrics,
  defaultSessionState,
  guardSeverityClass,
  presetPropFirmConfig,
  readPropFirmPersisted,
  writePropFirmPersisted,
  type ChallengeProfile,
  type PropFirmConfig,
  type PropFirmGuards,
  type SessionState,
  type SyncedPosition,
} from "@/lib/prop-firm-bot";

type BlofinStatus = {
  configured: boolean;
  blofinDemo?: boolean;
  credentialSource?: string;
  error?: string;
};

type SyncResponse = {
  success: boolean;
  error?: string;
  state?: SessionState;
  positions?: SyncedPosition[];
  metrics?: ReturnType<typeof computePropFirmMetrics>;
  guards?: PropFirmGuards;
  syncedAt?: string;
  blofinBalanceUsd?: number | null;
  syncMeta?: {
    todaysRealizedPnl: number;
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    openContracts: number;
    tradesToday: number;
  };
};

export default function PropFirmBotPanel() {
  const [cfg, setCfg] = useState<PropFirmConfig>(() => presetPropFirmConfig("topstep_50k"));
  const [state, setState] = useState<SessionState>(() => defaultSessionState(50000));
  const [symbol, setSymbol] = useState("NQ");
  const [aiSetupNote, setAiSetupNote] = useState(
    "Trade only A+ setups. No revenge trades. Pause after two losses."
  );
  const [autoSync, setAutoSync] = useState(true);
  const [proposedRiskUsd, setProposedRiskUsd] = useState("");
  const [positions, setPositions] = useState<SyncedPosition[]>([]);
  const [guards, setGuards] = useState<PropFirmGuards | null>(null);
  const [syncedMetrics, setSyncedMetrics] = useState<ReturnType<typeof computePropFirmMetrics> | null>(null);
  const [blofinStatus, setBlofinStatus] = useState<BlofinStatus>({ configured: false });
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [showBlofinForm, setShowBlofinForm] = useState(false);
  const [blofinKeys, setBlofinKeys] = useState({ apiKey: "", secretKey: "", passphrase: "", demoMode: true });
  const [savingKeys, setSavingKeys] = useState(false);
  const hydrated = useRef(false);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readPropFirmPersisted();
    if (saved) {
      setCfg(saved.cfg);
      setState(saved.state);
      setSymbol(saved.symbol);
      setAiSetupNote(saved.aiSetupNote);
      setAutoSync(saved.autoSync);
    }
    hydrated.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    writePropFirmPersisted({ cfg, state, symbol, aiSetupNote, autoSync });
  }, [cfg, state, symbol, aiSetupNote, autoSync]);

  const loadBlofinStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/prop-firm-bot/sync");
      const data = await res.json();
      setBlofinStatus({
        configured: !!data.configured,
        blofinDemo: data.blofin?.blofinDemo,
        credentialSource: data.blofin?.credentialSource,
        error: data.error,
      });
      return !!data.configured;
    } catch {
      setBlofinStatus({ configured: false, error: "Could not check Blofin status." });
      return false;
    }
  }, []);

  const runSync = useCallback(
    async (riskOverride?: number) => {
      setSyncing(true);
      setSyncError("");
      try {
        const proposed = riskOverride ?? (Number(proposedRiskUsd) || 0);
        const res = await fetch("/api/prop-firm-bot/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cfg, state, proposedRiskUsd: proposed }),
        });
        const data = (await res.json()) as SyncResponse;
        if (!res.ok || !data.success) {
          setSyncError(data.error ?? "Sync failed.");
          if (data.error?.toLowerCase().includes("blofin")) setShowBlofinForm(true);
          return;
        }
        if (data.state) setState(data.state);
        if (data.positions) setPositions(data.positions);
        if (data.guards) setGuards(data.guards);
        if (data.metrics) setSyncedMetrics(data.metrics);
        if (data.syncedAt) setLastSyncedAt(data.syncedAt);
        setBlofinStatus((s) => ({ ...s, configured: true }));
      } catch {
        setSyncError("Sync failed — check connection.");
      } finally {
        setSyncing(false);
      }
    },
    [cfg, state, proposedRiskUsd]
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void loadBlofinStatus().then((ok) => {
      if (!cancelled && ok) void runSync(0);
    });
    return () => {
      cancelled = true;
    };
    // Initial Blofin sync once when panel is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!autoSync || !blofinStatus.configured) return;
    const id = setInterval(() => void runSync(0), 30000);
    return () => clearInterval(id);
  }, [autoSync, blofinStatus.configured, runSync]);

  const localMetrics = useMemo(
    () => computePropFirmMetrics(cfg, state, positions.reduce((s, p) => s + p.size, 0)),
    [cfg, state, positions]
  );

  const localGuards = useMemo(
    () => computePropFirmGuards(cfg, state, positions, Number(proposedRiskUsd) || 0),
    [cfg, state, positions, proposedRiskUsd]
  );

  const activeGuards = guards ?? localGuards;
  const activeMetrics = syncedMetrics ?? localMetrics;

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
      setBlofinKeys({ apiKey: "", secretKey: "", passphrase: "", demoMode: blofinKeys.demoMode });
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
    setGuards(null);
  };

  const resetTradingDay = () => {
    setState((s) => ({ ...s, tradesToday: 0, todaysPnl: 0, openRiskUsd: 0 }));
    void runSync(0);
  };

  const GuardIcon = ({ severity }: { severity: "allow" | "caution" | "stop" }) => {
    if (severity === "stop") return <ShieldAlert className="h-5 w-5 shrink-0" />;
    if (severity === "caution") return <Shield className="h-5 w-5 shrink-0" />;
    return <ShieldCheck className="h-5 w-5 shrink-0" />;
  };

  return (
    <div className="mx-6 py-8 max-w-4xl space-y-5">
      <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent flex items-center gap-2 flex-wrap">
        <Flame className="h-7 w-7 text-amber-500 dark:text-amber-400 shrink-0 animate-flame-flicker" aria-hidden />
        <span>Nova Prop Firm Bot</span>
      </h2>
      <p className="text-sm text-muted-foreground">
        Challenge guardrail copilot — syncs with Blofin to track PnL and risk, then blocks or warns on{" "}
        <strong>entries</strong> and guides <strong>exits</strong> based on your prop-firm rules. Not auto-trading;
        you execute on Blofin; this protects your evaluation.
      </p>

      <Card className="border-cyan-200/60 dark:border-cyan-800/50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Blofin sync
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowBlofinForm((v) => !v)}>
                {blofinStatus.configured ? "Update keys" : "Connect Blofin"}
              </Button>
              <Button type="button" size="sm" onClick={() => void runSync()} disabled={syncing || !blofinStatus.configured}>
                <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                Sync now
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {blofinStatus.configured ? (
            <p className="text-emerald-700 dark:text-emerald-300">
              Connected ({blofinStatus.blofinDemo ? "Demo" : "Live"}, {blofinStatus.credentialSource ?? "saved"} keys)
              {lastSyncedAt && (
                <span className="text-muted-foreground ml-2">
                  · Last sync {new Date(lastSyncedAt).toLocaleTimeString()}
                </span>
              )}
            </p>
          ) : (
            <p className="text-amber-700 dark:text-amber-300">
              Connect Blofin API keys to auto-track PnL, open risk, and enforce challenge guardrails.
            </p>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            Auto-sync every 30s when connected
          </label>
          {syncError && <p className="text-rose-600 dark:text-rose-400 text-xs">{syncError}</p>}
          {showBlofinForm && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Keys are encrypted and used only for your account.</p>
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className={`border-2 ${guardSeverityClass(activeGuards.entry.severity)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GuardIcon severity={activeGuards.entry.severity} />
              Entry guard
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
          <Button type="button" variant="outline" size="sm" onClick={() => void runSync(Number(proposedRiskUsd) || 0)}>
            Check entry
          </Button>
          <p className="text-xs text-muted-foreground">
            Enter max loss at your stop before opening on Blofin. Cap: ${activeMetrics.perTradeRiskCap.toFixed(0)}
          </p>
        </CardContent>
      </Card>

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
                  const p = presetPropFirmConfig(next);
                  setCfg(p);
                  setState(defaultSessionState(p.accountSize));
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
            <Button type="button" onClick={startChallenge}>
              Start new challenge
            </Button>
            <Button type="button" variant="outline" onClick={resetTradingDay}>
              Reset trading day
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Live challenge state</CardTitle>
          <p className="text-xs text-muted-foreground">
            {blofinStatus.configured
              ? "Auto-updated from Blofin on sync. Manual edits saved locally."
              : "Manual mode — connect Blofin for live sync."}
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

      {positions.length > 0 && (
        <Card className="border-zinc-200/80 dark:border-zinc-700/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Open positions (Blofin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {positions.map((p) => (
              <div
                key={`${p.instId}-${p.posSide}`}
                className="flex flex-wrap justify-between gap-2 rounded border p-3 text-sm"
              >
                <span className="font-medium">
                  {p.instId} · {p.posSide} · {p.size} ct
                </span>
                <span className={p.unrealizedPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
                  ${p.unrealizedPnl.toFixed(2)} uPnL
                </span>
              </div>
            ))}
            {activeGuards.positionNotes.map((n) => (
              <div key={n.instId + n.headline} className={`rounded border p-2 text-xs ${guardSeverityClass(n.severity)}`}>
                <strong>{n.instId}:</strong> {n.headline} — {n.detail}
              </div>
            ))}
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
            placeholder="Your challenge discipline notes..."
          />
          <p className="text-xs text-muted-foreground">
            Guardrails use challenge math + Blofin positions. Passing a prop evaluation still requires your edge and
            discipline — this tool prevents rule violations, not market risk.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
