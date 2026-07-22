"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { normalizeForexSymbol, FOREX_MARKET_WATCH } from "@/lib/forex-market";
import { FOREX_BROKER_IDS, FOREX_BROKER_LABELS, type ForexBrokerId } from "@/lib/forex-broker-user-config";
import ForexBrokerConnectPanel from "@/components/ForexBrokerConnectPanel";

const TIMEFRAMES = [
  { id: "5m", label: "5 minutes" },
  { id: "15m", label: "15 minutes" },
  { id: "1h", label: "1 hour" },
  { id: "1d", label: "1 day" },
];

type BotConfig = {
  id: string;
  enabled: boolean;
  ownerForceOff: boolean;
  mode: "demo" | "live";
  broker: ForexBrokerId;
  symbol: string;
  timeframe: string;
  lotSize: number;
  fastMA: number;
  slowMA: number;
  stopLossPips: number | null;
  takeProfitPips: number | null;
  magic: number | null;
  inPosition: boolean;
  positionSide: "long" | "short" | null;
  lastRunAt: string | null;
  lastDecision: string | null;
  lastError: string | null;
};

type Connection = { broker: ForexBrokerId; connected: boolean };

export default function NovaForexBotPanel() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [enabledBrokers, setEnabledBrokers] = useState<ForexBrokerId[]>([...FOREX_BROKER_IDS]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/user/forex-broker-config", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setConnections((data.connections ?? []) as Connection[]);
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
      const res = await fetch("/api/nova-forex-bot/config", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.config) {
        setConfig(data.config as BotConfig);
      } else {
        setConfig(null);
        setError(data.error ?? "Failed to load Nova Forex Bot.");
      }
    } catch (e) {
      setConfig(null);
      setError(e instanceof Error ? e.message : "Failed to load Nova Forex Bot.");
    } finally {
      setLoading(false);
    }
  }, [loadConnections]);

  useEffect(() => {
    void load();
  }, [load]);

  const connectedBrokers = connections.filter((c) => c.connected).map((c) => c.broker);
  const connectedBrokersKey = connectedBrokers.join(",");

  // Prefer a connected broker in settings if current selection isn't connected
  useEffect(() => {
    if (!config) return;
    if (connectedBrokers.includes(config.broker)) return;
    if (connectedBrokers.length === 0) return;
    const next = connectedBrokers[0];
    setConfig((c) => (c && c.broker !== next ? { ...c, broker: next } : c));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connectedBrokersKey tracks list
  }, [config?.broker, connectedBrokersKey]);

  const setField = <K extends keyof BotConfig>(key: K, value: BotConfig[K]) => {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/nova-forex-bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled: config.enabled,
          mode: config.mode,
          broker: config.broker,
          symbol: config.symbol,
          timeframe: config.timeframe,
          lotSize: config.lotSize,
          fastMA: config.fastMA,
          slowMA: config.slowMA,
          stopLossPips: config.stopLossPips,
          takeProfitPips: config.takeProfitPips,
          magic: config.magic,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config as BotConfig);
        setSuccess("Nova Forex Bot saved.");
      } else setError(data.error ?? "Save failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const runTick = async () => {
    setTicking(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/nova-forex-bot/tick", { method: "POST", credentials: "include" });
      const data = await res.json();
      await load();
      if (data.success) setSuccess(data.message ?? "Tick OK.");
      else setError(data.error ?? "Tick failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tick failed.");
    } finally {
      setTicking(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading Nova Forex Bot…</p>;
  }

  if (!config) {
    return (
      <div className="space-y-4 max-w-2xl py-4">
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        <strong className="text-emerald-600 dark:text-emerald-400">Nova Forex Bot</strong> runs a simple{" "}
        <strong>MA crossover</strong> strategy on your connected MT4/MT5 account (Vantage or TIOmarkets, via MetaAPI).
        It opens or flips a position on a fast/slow moving-average crossover, sized by lot size, with optional
        TP/SL from pips.
      </p>

      <ForexBrokerConnectPanel onChange={() => void loadConnections()} />

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
          <CardTitle className="text-base font-semibold">Nova Forex Bot settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.ownerForceOff && (
            <div className="rounded-md border border-cyan-500/30 dark:border-cyan-600/40 bg-slate-50/90 dark:bg-slate-900/60 px-3 py-2 text-xs text-slate-900 dark:text-slate-100">
              Nova Forex Bot was <strong>disabled by the owner</strong> in Admin. The switch below stays off until they
              enable you again.
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
                list="nova-forex-bot-symbols"
                value={config.symbol}
                onChange={(e) => setField("symbol", e.target.value.toUpperCase())}
                onBlur={() => setField("symbol", normalizeForexSymbol(config.symbol) || config.symbol)}
                placeholder="EURUSD"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono"
              />
              <datalist id="nova-forex-bot-symbols">
                {FOREX_MARKET_WATCH.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.label}
                  </option>
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground mt-1">
                Type any symbol your broker offers (e.g. EURUSD, XAUUSD, NAS100). It must match the MT symbol name exactly.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Timeframe</label>
              <select
                value={config.timeframe}
                onChange={(e) => setField("timeframe", e.target.value)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              >
                {TIMEFRAMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
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
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Fast MA</label>
              <input
                type="number"
                min={1}
                value={config.fastMA}
                onChange={(e) => setField("fastMA", Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Slow MA</label>
              <input
                type="number"
                min={2}
                value={config.slowMA}
                onChange={(e) => setField("slowMA", Math.max(2, parseInt(e.target.value, 10) || 2))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Take profit (pips, optional)
              </label>
              <input
                type="number"
                min={0}
                placeholder="Leave empty for none"
                value={config.takeProfitPips ?? ""}
                onChange={(e) => setField("takeProfitPips", e.target.value === "" ? null : parseFloat(e.target.value))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Stop loss (pips, optional)
              </label>
              <input
                type="number"
                min={0}
                placeholder="Leave empty for none"
                value={config.stopLossPips ?? ""}
                onChange={(e) => setField("stopLossPips", e.target.value === "" ? null : parseFloat(e.target.value))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void runTick()} disabled={ticking || !config.enabled}>
              {ticking ? "Running…" : "Run tick"}
            </Button>
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
              {config.inPosition && config.positionSide && (
                <span
                  className={
                    config.positionSide === "long"
                      ? "rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                      : "rounded-full bg-rose-500/15 text-rose-800 dark:text-rose-200 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
                  }
                >
                  {config.positionSide}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Idle / Armed</strong> = bot switch.{" "}
            <strong className="text-foreground">Demo / Live</strong> = your preference label (use Demo mode on the
            broker connect for a demo MT login). <strong className="text-foreground">Long / Short</strong> appears when
            the bot holds a position.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/70 bg-white/70 dark:bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">In position</p>
              <p className="mt-0.5 font-semibold text-foreground">
                {config.inPosition ? (
                  <span className={config.positionSide === "long" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    Yes · {(config.positionSide ?? "—").toUpperCase()}
                  </span>
                ) : (
                  "No"
                )}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200/80 dark:border-zinc-700/70 bg-white/70 dark:bg-zinc-950/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last run
              </p>
              <p className="mt-0.5 text-xs font-medium text-foreground leading-snug">
                {config.lastRunAt ? new Date(config.lastRunAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>
          {config.lastDecision && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-700/80 dark:text-emerald-300/80 mb-0.5">
                Last decision
              </p>
              <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">{config.lastDecision}</p>
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
