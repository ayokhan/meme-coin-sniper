"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ScalperConfig = {
  id: string;
  enabled: boolean;
  mode: "demo" | "live";
  symbol: string;
  marginCurrency: string;
  marginMode: "cross" | "isolated";
  side: "long" | "short";
  entryTrigger: "cross_down" | "cross_up";
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number | null;
  positionSizeUsdt: number;
  maxRounds: number;
  completedRounds: number;
  inPosition: boolean;
  lastRefPrice: number | null;
  attachTpsl: boolean;
  tpslTpPct: number | null;
  tpslSlPct: number | null;
  lastTickAt: string | null;
  lastError: string | null;
  lastAction: string | null;
};

export default function NovaScalperPanel() {
  const [config, setConfig] = useState<ScalperConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [autoSec, setAutoSec] = useState<0 | 15 | 30 | 60>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/nova-scalper", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (data.success && data.config) setConfig(data.config as ScalperConfig);
      else setError(data.error ?? `Error ${res.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (autoSec === 0 || !config?.enabled) return;
    const id = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch("/api/admin/nova-scalper/tick", { method: "POST", credentials: "include" });
          const data = await res.json();
          if (data.success) await load();
        } catch {
          /* ignore */
        }
      })();
    }, autoSec * 1000);
    return () => clearInterval(id);
  }, [autoSec, config?.enabled, load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/nova-scalper", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setSuccess("NovaScalper saved.");
      } else setError(data.error ?? "Save failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const tick = async () => {
    setTicking(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/nova-scalper/tick", { method: "POST", credentials: "include" });
      const data = await res.json();
      await load();
      if (data.success) setSuccess(data.message ?? "Tick OK.");
      else setError(data.error ?? "Tick failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tick failed");
    } finally {
      setTicking(false);
    }
  };

  const resetState = async (clearRounds: boolean) => {
    setError(null);
    try {
      const res = await fetch("/api/admin/nova-scalper/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clearRounds }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(clearRounds ? "Reset reference, position flag, and round count." : "Reset reference and position flag.");
        await load();
      } else setError(data.error ?? "Reset failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  };

  if (loading || !config) {
    return <p className="text-sm text-muted-foreground py-4">{loading ? "Loading NovaScalper…" : "No config."}</p>;
  }

  const setField = <K extends keyof ScalperConfig>(key: K, value: ScalperConfig[K]) => {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        <strong className="text-cyan-600 dark:text-cyan-400">NovaScalper</strong> repeats{" "}
        <strong>enter → exit</strong> on Blofin futures using your prices. Exits use{" "}
        <strong>close position</strong> when price crosses your exit target (TP orders optional). Same Blofin keys as the AI
        bot.
      </p>

      {success && (
        <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 text-sm text-emerald-800 dark:text-emerald-200">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">NovaScalper config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={config.enabled} onChange={(e) => setField("enabled", e.target.checked)} />
            <span className="text-sm font-medium">Enabled</span>
          </label>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Mode</label>
            <select
              value={config.mode}
              onChange={(e) => setField("mode", e.target.value as "demo" | "live")}
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            >
              <option value="demo">Demo</option>
              <option value="live">Live</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Symbol</label>
              <input
                value={config.symbol}
                onChange={(e) => setField("symbol", e.target.value.toUpperCase())}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Side</label>
              <select
                value={config.side}
                onChange={(e) => setField("side", e.target.value as "long" | "short")}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Leverage</label>
              <input
                type="number"
                min={1}
                max={125}
                value={config.leverage}
                onChange={(e) => setField("leverage", Math.max(1, Math.min(125, parseInt(e.target.value, 10) || 1)))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Margin (USDT)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={config.positionSizeUsdt}
                onChange={(e) => setField("positionSizeUsdt", parseFloat(e.target.value) || 1)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Entry trigger</label>
            <select
              value={config.entryTrigger}
              onChange={(e) => setField("entryTrigger", e.target.value as "cross_down" | "cross_up")}
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
            >
              <option value="cross_down">
                Cross down (long: dip to entry · short: breakdown through entry)
              </option>
              <option value="cross_up">
                Cross up (long: breakout · short: rally to entry)
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Entry price</label>
              <input
                type="number"
                step="any"
                value={config.entryPrice}
                onChange={(e) => setField("entryPrice", parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Exit price (close target)</label>
              <input
                type="number"
                step="any"
                value={config.exitPrice}
                onChange={(e) => setField("exitPrice", parseFloat(e.target.value) || 0)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Stop loss (optional)</label>
            <input
              type="number"
              step="any"
              placeholder="Leave empty for no stop"
              value={config.stopLossPrice ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setField("stopLossPrice", v === "" ? null : parseFloat(v));
              }}
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Max rounds (0 = unlimited)</label>
            <input
              type="number"
              min={0}
              value={config.maxRounds}
              onChange={(e) => setField("maxRounds", Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Margin mode</label>
            <select
              value={config.marginMode}
              onChange={(e) => setField("marginMode", e.target.value as "cross" | "isolated")}
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
            >
              <option value="cross">Cross</option>
              <option value="isolated">Isolated</option>
            </select>
          </div>

          <div className="rounded-md border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.attachTpsl}
                onChange={(e) => setField("attachTpsl", e.target.checked)}
              />
              <span className="text-sm">Also attach Blofin TP/SL after entry (experimental; primary exit is still close at exit price)</span>
            </label>
            {config.attachTpsl && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="TP %"
                  value={config.tpslTpPct ?? ""}
                  onChange={(e) => setField("tpslTpPct", e.target.value === "" ? null : parseFloat(e.target.value))}
                  className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
                />
                <input
                  type="number"
                  placeholder="SL %"
                  value={config.tpslSlPct ?? ""}
                  onChange={(e) => setField("tpslSlPct", e.target.value === "" ? null : parseFloat(e.target.value))}
                  className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void tick()} disabled={ticking || !config.enabled}>
              {ticking ? "Checking…" : "Check price now"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Auto tick:</span>
            <select
              value={autoSec}
              onChange={(e) => setAutoSec(Number(e.target.value) as 0 | 15 | 30 | 60)}
              className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
            >
              <option value={0}>Off</option>
              <option value={15}>Every 15s</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 60s</option>
            </select>
            {config.enabled && autoSec > 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-300">Runs only while this tab is open.</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void resetState(false)}>
              Reset cross reference
            </Button>
            <Button size="sm" variant="outline" onClick={() => void resetState(true)}>
              Reset + clear round count
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-zinc-700 dark:text-zinc-300">
          <p>
            In position (internal): <strong>{config.inPosition ? "yes" : "no"}</strong>
          </p>
          <p>
            Completed rounds: <strong>{config.completedRounds}</strong>
            {config.maxRounds > 0 ? ` / ${config.maxRounds}` : ""}
          </p>
          <p>
            Last ref price:{" "}
            <strong>{config.lastRefPrice != null ? config.lastRefPrice.toLocaleString() : "—"}</strong>
          </p>
          <p>
            Last tick: <strong>{config.lastTickAt ? new Date(config.lastTickAt).toLocaleString() : "—"}</strong>
          </p>
          {config.lastAction && <p className="text-xs text-muted-foreground">Last action: {config.lastAction}</p>}
          {config.lastError && <p className="text-xs text-rose-600 dark:text-rose-400">Error: {config.lastError}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
