"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ScalperConfig = {
  symbol: string;
  marginCurrency: string;
  marginMode: string;
  side: string;
  openWhen: string;
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number | null;
  marginUsdt: number;
  leverage: number;
  mode: string;
  enabled: boolean;
  runState: string;
  cyclesCompleted: number;
  lastMark: number | null;
  lastTickAt: string | null;
  lastActionAt: string | null;
  lastActionMsg: string | null;
  lastError: string | null;
};

export default function NovaScalperPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [autoTick, setAutoTick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastTickAction, setLastTickAction] = useState<string | null>(null);

  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<"long" | "short">("long");
  const [openWhen, setOpenWhen] = useState<"lte" | "gte">("lte");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [marginUsdt, setMarginUsdt] = useState("50");
  const [leverage, setLeverage] = useState("10");
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<Partial<ScalperConfig>>({});

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/nova-scalper", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.config) {
        setError(data.error ?? `Load failed (${res.status})`);
        return;
      }
      const c = data.config as ScalperConfig;
      setSymbol(c.symbol ?? "BTC");
      setSide(c.side === "short" ? "short" : "long");
      setOpenWhen(c.openWhen === "gte" ? "gte" : "lte");
      setEntryPrice(c.entryPrice > 0 ? String(c.entryPrice) : "");
      setExitPrice(c.exitPrice > 0 ? String(c.exitPrice) : "");
      setStopLossPrice(c.stopLossPrice != null && c.stopLossPrice > 0 ? String(c.stopLossPrice) : "");
      setMarginUsdt(String(c.marginUsdt ?? 50));
      setLeverage(String(c.leverage ?? 10));
      setMarginMode(c.marginMode === "isolated" ? "isolated" : "cross");
      setMode(c.mode === "live" ? "live" : "demo");
      setEnabled(!!c.enabled);
      setStatus(c);
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
    if (!autoTick || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      void tick();
    }, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick closure intentional
  }, [autoTick, enabled]);

  const save = async (nextEnabled?: boolean) => {
    setSaving(true);
    clearFeedback();
    try {
      const res = await fetch("/api/admin/trading-bot/nova-scalper", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          symbol,
          side,
          openWhen,
          entryPrice: parseFloat(entryPrice) || 0,
          exitPrice: parseFloat(exitPrice) || 0,
          stopLossPrice: stopLossPrice.trim() === "" ? null : parseFloat(stopLossPrice),
          marginUsdt: parseFloat(marginUsdt) || 50,
          leverage: parseInt(leverage, 10) || 10,
          marginMode,
          mode,
          enabled: nextEnabled ?? enabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.error ?? "Save failed");
        return;
      }
      setEnabled(!!data.config?.enabled);
      setStatus(data.config);
      setSuccess("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const tick = async () => {
    setTicking(true);
    try {
      const res = await fetch("/api/admin/trading-bot/nova-scalper/tick", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      setLastTickAction(data.action ?? (data.success ? "ok" : "error"));
      if (!data.success && data.error) setError(data.error);
      else if (data.message && data.action && data.action !== "hold") setSuccess(data.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tick failed");
    } finally {
      setTicking(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6">Loading NovaScalper…</p>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-lg border border-cyan-200/80 dark:border-cyan-900/60 bg-cyan-50/40 dark:bg-cyan-950/20 p-4">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">NovaScalper</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Blofin leverage scalper: opens when <strong>mark price</strong> hits your entry rule, closes at your exit price (or optional stop).
          Cycles repeat automatically. Uses the same API keys as the Crypto Futures Bot. Not financial advice—test on demo first.
        </p>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Symbol</label>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
            placeholder="BTC"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Side</label>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={side === "long" ? "default" : "outline"} onClick={() => setSide("long")}>
              Long
            </Button>
            <Button type="button" size="sm" variant={side === "short" ? "default" : "outline"} onClick={() => setSide("short")}>
              Short
            </Button>
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Open when mark is…</label>
          <select
            value={openWhen}
            onChange={(e) => setOpenWhen(e.target.value as "lte" | "gte")}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
          >
            <option value="lte">
              At or below entry (e.g. long: buy the dip; short: breakdown)
            </option>
            <option value="gte">
              At or above entry (e.g. long: breakout; short: fade rally)
            </option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Entry price</label>
          <input
            value={entryPrice}
            onChange={(e) => setEntryPrice(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Exit price (take profit)</label>
          <input
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Stop loss (optional)</label>
          <input
            value={stopLossPrice}
            onChange={(e) => setStopLossPrice(e.target.value)}
            inputMode="decimal"
            placeholder="Absolute price"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Leverage (×)</label>
          <input
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Margin (USDT)</label>
          <input
            value={marginUsdt}
            onChange={(e) => setMarginUsdt(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Notional ≈ margin × leverage (same as main bot).</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Margin mode</label>
          <select
            value={marginMode}
            onChange={(e) => setMarginMode(e.target.value as "cross" | "isolated")}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
          >
            <option value="cross">Cross</option>
            <option value="isolated">Isolated</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Blofin mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "demo" | "live")}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
          >
            <option value="demo">Demo</option>
            <option value="live">Live</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save config"}
        </Button>
        <Button
          type="button"
          variant={enabled ? "destructive" : "default"}
          onClick={() => void save(!enabled)}
          disabled={saving}
        >
          {enabled ? "Disable bot" : "Enable bot"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void tick()} disabled={ticking || !enabled}>
          {ticking ? "Running tick…" : "Run tick now"}
        </Button>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={autoTick && enabled} onChange={(e) => setAutoTick(e.target.checked)} />
          Auto tick every 15s (keep tab open)
        </label>
      </div>

      <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 text-xs space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Status</span>
          <Badge variant="outline">{status.runState === "in_position" ? "In position" : "Flat"}</Badge>
          {enabled ? (
            <Badge className="bg-emerald-600">Enabled</Badge>
          ) : (
            <Badge variant="secondary">Off</Badge>
          )}
          {lastTickAction && (
            <span className="text-muted-foreground">
              Last tick: <span className="font-mono">{lastTickAction}</span>
            </span>
          )}
        </div>
        <p>
          Cycles completed: <span className="font-mono">{status.cyclesCompleted ?? 0}</span>
        </p>
        {status.lastMark != null && Number.isFinite(status.lastMark) && (
          <p>
            Last mark: <span className="font-mono">${status.lastMark.toLocaleString()}</span>
          </p>
        )}
        {status.lastActionMsg && (
          <p className="text-zinc-700 dark:text-zinc-300">
            Last action: {status.lastActionMsg}
          </p>
        )}
        {status.lastError && <p className="text-rose-600 dark:text-rose-400">Error: {status.lastError}</p>}
        <p className="text-muted-foreground leading-relaxed">
          Optional: Vercel cron can call <code className="text-[11px]">GET /api/cron/nova-scalper</code> with{" "}
          <code className="text-[11px]">Authorization: Bearer CRON_SECRET</code> for server-side ticks.
        </p>
      </div>
    </div>
  );
}
