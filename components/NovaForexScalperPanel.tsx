"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Clock, Crosshair, Layers, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { normalizeForexSymbol, FOREX_MARKET_WATCH } from "@/lib/forex-market";
import { FOREX_BROKER_IDS, FOREX_BROKER_LABELS, type ForexBrokerId } from "@/lib/forex-broker-user-config";
import {
  clearNovaForexScalperPrefill,
  forexScalperEntryTriggerFor,
  readNovaForexScalperPrefill,
} from "@/lib/nova-forex-scalper-prefill";
import { estimateForexLotsFromMargin } from "@/lib/forex-lot-size";
import ForexBrokerConnectPanel from "@/components/ForexBrokerConnectPanel";

type ForexScalperConfig = {
  id: string;
  slot: number;
  enabled: boolean;
  ownerForceOff?: boolean;
  mode: "demo" | "live";
  broker: ForexBrokerId;
  symbol: string;
  side: "long" | "short";
  entryTrigger: "cross_down" | "cross_up";
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number | null;
  lotSize: number;
  maxRounds: number;
  completedRounds: number;
  inPosition: boolean;
  lastRefPrice: number | null;
  lastTickAt: string | null;
  lastError: string | null;
  lastAction: string | null;
};

export default function NovaForexScalperPanel() {
  const [configs, setConfigs] = useState<ForexScalperConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string>("");
  const [maxConfigs, setMaxConfigs] = useState(6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [addingConfig, setAddingConfig] = useState(false);
  const [removingConfig, setRemovingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);
  const prefillAppliedRef = useRef(false);
  /** Margin from Scalp plan (editable for sizing). */
  const [planMarginUsd, setPlanMarginUsd] = useState(10);
  /** Leverage from connected MT account (read-only). null = not loaded yet. */
  const [accountLeverage, setAccountLeverage] = useState<number | null>(null);
  const [leverageLoading, setLeverageLoading] = useState(false);
  const [autoSec, setAutoSec] = useState<0 | 15 | 30 | 60>(0);
  const [connections, setConnections] = useState<{ broker: ForexBrokerId; connected: boolean }[]>([]);
  const [enabledBrokers, setEnabledBrokers] = useState<ForexBrokerId[]>([...FOREX_BROKER_IDS]);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/user/forex-broker-config", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setConnections((data.connections ?? []) as { broker: ForexBrokerId; connected: boolean }[]);
        if (Array.isArray(data.enabledBrokers)) setEnabledBrokers(data.enabledBrokers as ForexBrokerId[]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      void loadConnections();
      const res = await fetch("/api/nova-forex-scalper/config", { credentials: "include", cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        configs?: ForexScalperConfig[];
        maxConfigs?: number;
        error?: string;
      };
      if (data.success && Array.isArray(data.configs) && data.configs.length > 0) {
        setConfigs(data.configs);
        setMaxConfigs(typeof data.maxConfigs === "number" ? data.maxConfigs : 6);
        setActiveConfigId((prev) => {
          if (prev && data.configs!.some((c) => c.id === prev)) return prev;
          return data.configs![0].id;
        });
      } else {
        setConfigs([]);
        setActiveConfigId("");
        setError(data.error ?? "No config returned. Try again.");
      }
    } catch (e) {
      setConfigs([]);
      setActiveConfigId("");
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [loadConnections]);

  useEffect(() => {
    void load();
  }, [load]);

  // Apply a "Scalp this trade" hand-off from Nova Forex Agent onto the active config.
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (loading || !activeConfigId || configs.length === 0) return;
    const prefill = readNovaForexScalperPrefill();
    if (!prefill) return;
    prefillAppliedRef.current = true;
    const marginUsd =
      prefill.marginUsd != null && Number.isFinite(prefill.marginUsd) && prefill.marginUsd > 0
        ? prefill.marginUsd
        : 10;
    setPlanMarginUsd(marginUsd);
    const levForLots =
      accountLeverage && accountLeverage > 0 ? accountLeverage : Math.max(1, Number(prefill.leverage) || 20);
    const lotFromPlan =
      Number.isFinite(prefill.lotSize) && prefill.lotSize > 0
        ? prefill.lotSize
        : estimateForexLotsFromMargin({
            symbol: prefill.symbol,
            entryPrice: prefill.entryPrice,
            marginUsd,
            leverage: levForLots,
          });
    setConfigs((list) =>
      list.map((c) =>
        c.id === activeConfigId
          ? {
              ...c,
              symbol: normalizeForexSymbol(prefill.symbol) || prefill.symbol,
              side: prefill.side,
              entryTrigger: forexScalperEntryTriggerFor(prefill.side),
              entryPrice: prefill.entryPrice,
              exitPrice: prefill.exitPrice,
              stopLossPrice:
                prefill.stopLossPrice != null && Number.isFinite(prefill.stopLossPrice) ? prefill.stopLossPrice : null,
              lotSize: lotFromPlan,
            }
          : c
      )
    );
    setPrefillNotice(
      `Loaded ${prefill.side.toUpperCase()} ${prefill.symbol} from ${prefill.source} · $${marginUsd} margin → ~${lotFromPlan} lots. Review below, then Save.`
    );
    clearNovaForexScalperPrefill();
  }, [loading, activeConfigId, configs.length]);

  const activeConfig = configs.find((c) => c.id === activeConfigId) ?? null;
  const sizingLeverage = accountLeverage && accountLeverage > 0 ? accountLeverage : 20;

  /** Load account leverage from the selected connected broker (MT5 — read-only). */
  useEffect(() => {
    if (!activeConfig?.broker) {
      setAccountLeverage(null);
      return;
    }
    const connected = connections.some((c) => c.broker === activeConfig.broker && c.connected);
    if (!connected) {
      setAccountLeverage(null);
      return;
    }
    let cancelled = false;
    setLeverageLoading(true);
    fetch(`/api/user/forex-broker-config/account?broker=${activeConfig.broker}&period=1d&wait=1`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const lev = data?.account?.leverage;
        setAccountLeverage(typeof lev === "number" && lev > 0 ? lev : null);
      })
      .catch(() => {
        if (!cancelled) setAccountLeverage(null);
      })
      .finally(() => {
        if (!cancelled) setLeverageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeConfig?.broker, connections]);

  /** When MT leverage arrives, re-estimate lots from current margin (does not change MT leverage). */
  useEffect(() => {
    if (!activeConfig || !accountLeverage || accountLeverage <= 0) return;
    const nextLots = estimateForexLotsFromMargin({
      symbol: activeConfig.symbol,
      entryPrice: activeConfig.entryPrice,
      marginUsd: planMarginUsd,
      leverage: accountLeverage,
    });
    if (Math.abs(nextLots - activeConfig.lotSize) < 0.001) return;
    setConfigs((list) =>
      list.map((c) => (c.id === activeConfig.id ? { ...c, lotSize: nextLots } : c))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when leverage / margin / symbol / entry change
  }, [accountLeverage, planMarginUsd, activeConfig?.id, activeConfig?.symbol, activeConfig?.entryPrice]);

  /** Sync when returning to the tab. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void load(), 250);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  useEffect(() => {
    const config = configs.find((c) => c.id === activeConfigId);
    if (autoSec === 0 || !config?.enabled) return;
    const id = setInterval(() => {
      void (async () => {
        try {
          await fetch("/api/nova-forex-scalper/tick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ configId: config.id }),
          });
          await load();
        } catch {
          /* ignore */
        }
      })();
    }, autoSec * 1000);
    return () => clearInterval(id);
  }, [autoSec, activeConfigId, configs, load]);

  const save = async () => {
    const config = configs.find((c) => c.id === activeConfigId);
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/nova-forex-scalper/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...config, configId: config.id }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfigs((list) => list.map((row) => (row.id === data.config.id ? data.config : row)));
        setSuccess("Nova Forex Scalper saved.");
      } else setError(data.error ?? "Save failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addConfig = async () => {
    setAddingConfig(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/nova-forex-scalper/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addSlot: true }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.configs)) {
        setConfigs(data.configs);
        if (data.config?.id) setActiveConfigId(String(data.config.id));
        setSuccess("Added config.");
      } else setError(data.error ?? "Could not add config.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add config.");
    } finally {
      setAddingConfig(false);
    }
  };

  const removeActiveConfig = async () => {
    const config = configs.find((c) => c.id === activeConfigId);
    if (!config || configs.length <= 1) return;
    if (!window.confirm(`Remove Config ${config.slot}? This deletes its settings and state.`)) return;
    setRemovingConfig(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/nova-forex-scalper/config?id=${encodeURIComponent(config.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.configs)) {
        setConfigs(data.configs);
        setActiveConfigId(data.configs[0]?.id ?? "");
        setSuccess("Config removed.");
      } else setError(data.error ?? "Remove failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setRemovingConfig(false);
    }
  };

  const tick = async () => {
    const config = configs.find((c) => c.id === activeConfigId);
    if (!config) return;
    setTicking(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/nova-forex-scalper/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ configId: config.id }),
      });
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
    const config = configs.find((c) => c.id === activeConfigId);
    if (!config) return;
    setError(null);
    try {
      const res = await fetch("/api/nova-forex-scalper/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ clearRounds, configId: config.id }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(
          clearRounds
            ? "Reset last ref price, position flag, and round count."
            : "Reset last ref price and position flag."
        );
        await load();
      } else setError(data.error ?? "Reset failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading Nova Forex Scalper…</p>;
  }

  if (configs.length === 0) {
    return (
      <div className="space-y-4 max-w-2xl py-4">
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const config = configs.find((c) => c.id === activeConfigId);
  if (!config) {
    return <p className="text-sm text-muted-foreground py-4">Loading Nova Forex Scalper…</p>;
  }

  const setField = <K extends keyof ForexScalperConfig>(key: K, value: ForexScalperConfig[K]) => {
    setConfigs((list) => list.map((c) => (c.id === activeConfigId ? { ...c, [key]: value } : c)));
  };

  const connectedBrokers = connections.filter((c) => c.connected).map((c) => c.broker);

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        <strong className="text-emerald-600 dark:text-emerald-400">Nova Forex Scalper</strong> repeats{" "}
        <strong>enter → exit</strong> on your MT4/MT5 account using your prices. Use{" "}
        <strong className="text-foreground">Config 1, Config 2, …</strong> to run{" "}
        <strong className="text-foreground">different symbols in parallel</strong>.
      </p>

      <ForexBrokerConnectPanel onChange={() => void loadConnections()} />

      {prefillNotice && (
        <div className="rounded-lg border border-emerald-300/80 dark:border-emerald-700/80 bg-emerald-50/70 dark:bg-emerald-950/30 p-3 text-sm text-emerald-900 dark:text-emerald-100 flex items-start gap-2">
          <Zap className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1 space-y-1">
            <p className="font-medium">Prefilled from Nova Forex</p>
            <p className="text-emerald-800/90 dark:text-emerald-200/90">{prefillNotice}</p>
          </div>
          <button
            type="button"
            onClick={() => setPrefillNotice(null)}
            className="text-emerald-700/70 dark:text-emerald-300/70 hover:text-emerald-900 dark:hover:text-emerald-100 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
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
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="text-base font-semibold">Nova Forex Scalper configs</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-600/80">
              {configs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConfigId(c.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    c.id === activeConfigId
                      ? "bg-emerald-500 text-white dark:bg-emerald-600"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
                  }`}
                >
                  Config {c.slot}
                </button>
              ))}
            </div>
            {configs.length < maxConfigs && (
              <Button type="button" size="sm" variant="outline" disabled={addingConfig} onClick={() => void addConfig()}>
                {addingConfig ? "Adding…" : "+ Add config"}
              </Button>
            )}
            {configs.length > 1 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-rose-600 dark:text-rose-400"
                disabled={removingConfig}
                onClick={() => void removeActiveConfig()}
              >
                {removingConfig ? "Removing…" : `Remove config ${config.slot}`}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Editing <strong className="text-foreground">Config {config.slot}</strong>. Save applies only to this config.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.ownerForceOff && (
            <div className="rounded-md border border-cyan-500/30 dark:border-cyan-600/40 bg-slate-50/90 dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-900 dark:text-slate-100">
              Nova Forex Scalper was <strong>disabled by the owner</strong> in Admin. The switch below stays off until
              they enable you again.
            </div>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.enabled}
              disabled={!!config.ownerForceOff}
              onChange={(e) => setField("enabled", e.target.checked)}
            />
            <span className="text-sm font-medium">Enabled</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Broker</label>
              <select
                value={config.broker}
                onChange={(e) => setField("broker", e.target.value as ForexBrokerId)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              >
                {enabledBrokers.map((b) => (
                  <option key={b} value={b}>
                    {FOREX_BROKER_LABELS[b]}
                    {connectedBrokers.includes(b) ? " (connected)" : ""}
                  </option>
                ))}
              </select>
              {!connectedBrokers.includes(config.broker) && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                  Connect this broker above before enabling.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Symbol</label>
              <input
                list="nova-forex-scalper-symbols"
                value={config.symbol}
                onChange={(e) => setField("symbol", e.target.value.toUpperCase())}
                onBlur={() => setField("symbol", normalizeForexSymbol(config.symbol) || config.symbol)}
                placeholder="EURUSD"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono"
              />
              <datalist id="nova-forex-scalper-symbols">
                {FOREX_MARKET_WATCH.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.label}
                  </option>
                ))}
              </datalist>
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

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Entry trigger</label>
            <select
              value={config.entryTrigger}
              onChange={(e) => setField("entryTrigger", e.target.value as "cross_down" | "cross_up")}
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
            >
              <option value="cross_down">Cross down (long: dip to entry · short: breakdown through entry)</option>
              <option value="cross_up">Cross up (long: breakout · short: rally to entry)</option>
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
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Exit price — take profit
              </label>
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
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Stop loss (optional)
            </label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Amount (USD margin)
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={planMarginUsd}
                onChange={(e) => {
                  const marginUsd = Math.max(1, parseFloat(e.target.value) || 1);
                  setPlanMarginUsd(marginUsd);
                  setField(
                    "lotSize",
                    estimateForexLotsFromMargin({
                      symbol: config.symbol,
                      entryPrice: config.entryPrice,
                      marginUsd,
                      leverage: sizingLeverage,
                    })
                  );
                }}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Account leverage
              </label>
              <div className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 px-2 py-1.5 text-sm font-mono">
                {leverageLoading
                  ? "…"
                  : accountLeverage
                    ? `1:${accountLeverage}`
                    : "— (connect broker above)"}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Margin is from your Scalp plan (edit to re-size lots).{" "}
            <strong className="text-foreground">Leverage comes from your MT5 account</strong> and cannot be changed in
            NovaStaris — set it in MetaTrader or your broker portal, then refresh the connection.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Lot size</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={config.lotSize}
                onChange={(e) => setField("lotSize", Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Max repeat rounds
              </label>
              <input
                type="number"
                min={0}
                value={config.maxRounds}
                onChange={(e) => setField("maxRounds", Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            <strong className="text-foreground">0</strong> = unlimited repeats.{" "}
            <strong className="text-foreground">1, 2, …</strong> = after that many successful exit (or stop) closes,
            Nova Forex Scalper turns off.
          </p>

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
              <span className="text-xs text-slate-600 dark:text-slate-300">Runs only while this tab is open.</span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void resetState(false)} title="Clears last ref price and in-position flag">
                Reset last ref price
              </Button>
              <Button size="sm" variant="outline" onClick={() => void resetState(true)} title="Same reset plus completedRounds → 0">
                Reset + clear round count
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-zinc-200/80 dark:border-zinc-700/80 bg-gradient-to-br from-zinc-50 via-white to-emerald-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/30">
        <CardHeader className="pb-3 border-b border-zinc-200/60 dark:border-zinc-700/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Status
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              {config.enabled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                  Armed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                  Idle
                </span>
              )}
              <span
                className={
                  config.mode === "live"
                    ? "rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                    : "rounded-full bg-sky-500/15 text-sky-800 dark:text-sky-200 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                }
              >
                {config.mode}
              </span>
              <span
                className={
                  config.side === "long"
                    ? "rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                    : "rounded-full bg-rose-600 text-white px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                }
              >
                {config.side}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div
              className={
                config.inPosition
                  ? "rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5"
                  : "rounded-lg border border-zinc-200/80 dark:border-zinc-700/70 bg-white/70 dark:bg-zinc-950/50 px-3 py-2.5"
              }
            >
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">In position</p>
              <p
                className={
                  config.inPosition
                    ? "mt-0.5 font-semibold text-amber-700 dark:text-amber-300"
                    : "mt-0.5 font-semibold text-zinc-500 dark:text-zinc-400"
                }
              >
                {config.inPosition ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/70 bg-white/70 dark:bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Rounds
              </p>
              <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                {config.completedRounds}
                {config.maxRounds > 0 ? (
                  <span className="text-muted-foreground font-medium"> / {config.maxRounds}</span>
                ) : null}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/70 bg-white/70 dark:bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1">
                <Crosshair className="h-3 w-3" />
                Last ref
              </p>
              <p className="mt-0.5 font-mono font-semibold tabular-nums text-foreground">
                {config.lastRefPrice != null ? config.lastRefPrice.toLocaleString() : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/70 bg-white/70 dark:bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last tick
              </p>
              <p className="mt-0.5 text-xs font-medium text-foreground leading-snug">
                {config.lastTickAt ? new Date(config.lastTickAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          {config.lastAction && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-700/80 dark:text-emerald-300/80 mb-0.5">
                Last action
              </p>
              <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{config.lastAction}</p>
            </div>
          )}
          {config.lastError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{config.lastError}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
