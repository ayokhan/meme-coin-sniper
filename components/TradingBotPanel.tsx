"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Strategy = "simple" | "indicators" | "ai" | "hybrid";

type Config = {
  provider: "blofin";
  symbol: string;
  timeframe: string;
  leverage: number;
  tpPct: number;
  slPct: number;
  mode: "demo" | "live";
  marginCurrency: "USDT" | "USDC";
  positionSizeUsdt: number;
  strategy: Strategy;
  emaPeriod: number;
  fastMA: number;
  slowMA: number;
  rsiPeriod: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  lastDecision: string | null;
  lastDecisionMsg: string | null;
};

export default function TradingBotPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);

  const [form, setForm] = useState<Partial<Config>>({});

  const loadConfig = async () => {
    try {
      setLoading(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot");
      const data = await res.json().catch(() => ({}));
      if (data.success && data.config) {
        setConfig(data.config);
        setForm({
          provider: "blofin",
          symbol: data.config.symbol,
          timeframe: data.config.timeframe,
          leverage: data.config.leverage,
          tpPct: data.config.tpPct,
          slPct: data.config.slPct,
          mode: data.config.mode,
          marginCurrency: data.config.marginCurrency ?? "USDT",
          positionSizeUsdt: data.config.positionSizeUsdt ?? 50,
          strategy: data.config.strategy ?? "simple",
          emaPeriod: data.config.emaPeriod ?? 200,
          fastMA: data.config.fastMA ?? 9,
          slowMA: data.config.slowMA ?? 21,
          rsiPeriod: data.config.rsiPeriod ?? 14,
        });
      } else {
        setError(data.error ?? (res.status === 403 ? "Owner only." : "Failed to load config."));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const VALID_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];
  const validateForm = (): string | null => {
    const symbol = (form.symbol ?? "").trim().toUpperCase();
    if (!symbol) return "Symbol is required (e.g. BTC or BTC/USDT).";
    const tf = (form.timeframe ?? "").trim();
    if (!VALID_TIMEFRAMES.includes(tf)) return `Timeframe must be one of: ${VALID_TIMEFRAMES.join(", ")}.`;
    const lev = form.leverage ?? 0;
    if (lev < 1 || lev > 125) return "Leverage must be between 1 and 125.";
    const tp = form.tpPct ?? 0;
    if (tp <= 0 || tp > 100) return "Take profit % must be between 0.1 and 100.";
    const sl = form.slPct ?? 0;
    if (sl <= 0 || sl > 100) return "Stop loss % must be between 0.1 and 100.";
    const pos = form.positionSizeUsdt ?? 0;
    if (pos <= 0 || pos > 1_000_000) return "Position size must be between 1 and 1,000,000.";
    return null;
  };

  const saveConfig = async () => {
    const err = validateForm();
    if (err) {
      setError(err);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/admin/trading-bot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "blofin",
          symbol: (form.symbol ?? "").trim().toUpperCase(),
          timeframe: (form.timeframe ?? "").trim(),
          leverage: form.leverage ?? 5,
          tpPct: form.tpPct ?? 2,
          slPct: form.slPct ?? 1,
          mode: form.mode ?? "demo",
          marginCurrency: form.marginCurrency ?? "USDT",
          positionSizeUsdt: form.positionSizeUsdt ?? 50,
          strategy: form.strategy ?? "simple",
          emaPeriod: form.emaPeriod ?? 200,
          fastMA: form.fastMA ?? 9,
          slowMA: form.slowMA ?? 21,
          rsiPeriod: form.rsiPeriod ?? 14,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setSuccess("Configuration saved successfully.");
        setError(null);
      } else {
        setError(data.error ?? "Failed to save");
        setSuccess(null);
      }
    } catch {
      setError("Failed to save");
      setSuccess(null);
    } finally {
      setSaving(false);
    }
  };

  const toggleBot = async (start: boolean) => {
    if (start) {
      const err = validateForm();
      if (err) {
        setError(err);
        return;
      }
    }
    try {
      setToggling(true);
      setError(null);
      const res = await fetch("/api/admin/trading-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: start ? "start" : "stop" }),
      });
      const data = await res.json();
      if (data.success && config) {
        setConfig({ ...config, enabled: data.enabled });
        setSuccess(start ? "Bot started. It will run on schedule." : "Bot stopped.");
        setError(null);
      } else {
        setError(data.error ?? "Failed to update");
        setSuccess(null);
      }
    } catch {
      setError("Failed to update");
      setSuccess(null);
    } finally {
      setToggling(false);
    }
  };

  const runNow = async () => {
    const err = validateForm();
    if (err) {
      setError(err);
      setSuccess(null);
      return;
    }
    try {
      setRunning(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ? `Run completed. ${data.message}` : "Run completed. Check last decision below.");
        setError(null);
        loadConfig();
      } else {
        setError(data.error ?? "Run failed");
        setSuccess(null);
      }
    } catch {
      setError("Run failed");
      setSuccess(null);
    } finally {
      setRunning(false);
    }
  };

  const closePosition = async () => {
    if (!config?.symbol || !window.confirm(`Close open position for ${config.symbol}? This will place a market order to exit.`)) return;
    try {
      setClosing(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/close", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? "Position closed.");
        setError(null);
        loadConfig();
      } else {
        setError(data.error ?? "Failed to close position");
        setSuccess(null);
      }
    } catch {
      setError("Failed to close position");
      setSuccess(null);
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-6 py-8">
        <p className="text-sm text-muted-foreground">Loading trading bot…</p>
      </div>
    );
  }

  return (
    <div className="mx-6 py-8 max-w-2xl space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-blue-300 dark:to-cyan-400">
        Crypto Futures Trading Bot
      </h2>
      <p className="text-sm text-muted-foreground">
        Crypto futures bot (long/short) via <strong>Blofin</strong>. Configure symbol, timeframe, leverage, take profit &amp; stop loss.
      </p>

      {success && (
        <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 text-sm text-emerald-800 dark:text-emerald-200 flex items-start justify-between gap-2">
          <p className="font-medium">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="shrink-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300 space-y-2">
          <p>{error}</p>
          {(error.includes("does not exist") || error.includes("column") || error.includes("relation") || error.includes("TradingBot")) && (
            <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-2">
              Database may need updating. Run: <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">npx prisma db push</code> against your production DATABASE_URL.
            </p>
          )}
          {error.toLowerCase().includes("brokerid") && (
            <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-2">
              Add <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">BLOFIN_BROKER_ID</code> to your server environment (e.g. Vercel env vars) with your Blofin broker ID, then redeploy.
            </p>
          )}
        </div>
      )}

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Provider</label>
            <p className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
              Blofin (API key + optional broker ID). Set <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">BLOFIN_API_KEY</code>, <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">BLOFIN_SECRET_KEY</code>, <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">BLOFIN_PASSPHRASE</code> in your server env (e.g. Vercel).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Symbol</label>
              <input
                type="text"
                placeholder="e.g. BTC, ETH or BTC/USDT"
                value={form.symbol ?? ""}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-muted-foreground mt-1">BTC or BTC/USDT both work; converted to Blofin format (e.g. BTC-USDT).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Timeframe</label>
              <select
                value={form.timeframe ?? "15m"}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {["1m", "5m", "15m", "1h", "4h", "1D"].map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Leverage</label>
              <select
                value={form.leverage ?? 5}
                onChange={(e) => setForm({ ...form, leverage: Number(e.target.value) })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {[1, 2, 3, 5, 10, 20, 50, 75, 100, 125].map((x) => (
                  <option key={x} value={x}>{x}x</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mode</label>
              <select
                value={form.mode ?? "demo"}
                onChange={(e) => setForm({ ...form, mode: e.target.value as "demo" | "live" })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="demo">Demo (test)</option>
                <option value="live">Live (real funds)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Margin (currency)</label>
              <select
                value={form.marginCurrency ?? "USDT"}
                onChange={(e) => setForm({ ...form, marginCurrency: e.target.value as "USDT" | "USDC" })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Strategy</label>
              <select
                value={form.strategy ?? "simple"}
                onChange={(e) => setForm({ ...form, strategy: e.target.value as Strategy })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="simple">Simple (price change)</option>
                <option value="indicators">Indicators (EMA, MA cross, RSI, S/R, candles)</option>
                <option value="ai">AI (LLM analysis)</option>
                <option value="hybrid">Hybrid (indicators + AI must agree)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Hybrid and Indicators use the settings below.</p>
            </div>
            {(form.strategy === "indicators" || form.strategy === "ai" || form.strategy === "hybrid") && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">EMA period</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={form.emaPeriod ?? 200}
                    onChange={(e) => setForm({ ...form, emaPeriod: Number(e.target.value) })}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Fast MA</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.fastMA ?? 9}
                    onChange={(e) => setForm({ ...form, fastMA: Number(e.target.value) })}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Slow MA</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={form.slowMA ?? 21}
                    onChange={(e) => setForm({ ...form, slowMA: Number(e.target.value) })}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">RSI period</label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={form.rsiPeriod ?? 14}
                    onChange={(e) => setForm({ ...form, rsiPeriod: Number(e.target.value) })}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Position size (USDT or USDC)</label>
            <input
              type="number"
              min="1"
              max="1000000"
              step="1"
              value={form.positionSizeUsdt ?? 50}
              onChange={(e) => setForm({ ...form, positionSizeUsdt: Number(e.target.value) })}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-xs text-muted-foreground mt-1">Amount in margin currency per trade (e.g. 50 = 50 USDT or 50 USDC).</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Take profit %</label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={form.tpPct ?? 2}
                onChange={(e) => setForm({ ...form, tpPct: Number(e.target.value) })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Stop loss %</label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={form.slPct ?? 1}
                onChange={(e) => setForm({ ...form, slPct: Number(e.target.value) })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving} className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700">
              {saving ? "Saving…" : "Save config"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Bot control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {config?.enabled ? "Bot is running." : "Bot is stopped. Start to begin automated trading."}
          </p>
          {config?.lastRunAt && (
            <p className="text-xs text-muted-foreground">Last run: {new Date(config.lastRunAt).toLocaleString()}</p>
          )}
          {config?.lastDecision && config.lastDecision !== "no_trade" && config?.lastDecisionMsg && (
            <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 text-sm">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Position opened</p>
              <p className="mt-1 text-emerald-700 dark:text-emerald-300 break-words">{config.lastDecisionMsg}</p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Direction: <span className={config.lastDecision === "long" ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>{config.lastDecision.toUpperCase()}</span>
              </p>
            </div>
          )}
          {(config?.lastDecision || config?.lastDecisionMsg) && (config?.lastDecision === "no_trade" || !config?.lastDecision) && (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/40 p-2 text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Last decision: </span>
              <span className="text-muted-foreground">No trade</span>
              {config.lastDecisionMsg && (
                <p className="mt-1 text-muted-foreground break-words">{config.lastDecisionMsg}</p>
              )}
            </div>
          )}
          {config?.lastError && (
            <>
              <p className="text-xs text-rose-600 dark:text-rose-400">Last error: {config.lastError}</p>
              {config.lastError.toLowerCase().includes("brokerid") && (
                <p className="text-xs text-muted-foreground mt-1">
                  Set <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">BLOFIN_BROKER_ID</code> in your server env (e.g. Vercel) to your Blofin broker ID, then redeploy.
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => toggleBot(true)}
              disabled={toggling || config?.enabled}
              className="bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              {toggling ? "Updating…" : "Start bot"}
            </Button>
            <Button
              onClick={() => toggleBot(false)}
              disabled={toggling || !config?.enabled}
              variant="destructive"
            >
              Stop bot
            </Button>
            <Button
              onClick={runNow}
              disabled={running || !config?.enabled}
              variant="outline"
              className="border-cyan-500 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50"
            >
              {running ? "Running…" : "Run now"}
            </Button>
            <Button
              onClick={closePosition}
              disabled={closing}
              variant="outline"
              className="border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            >
              {closing ? "Closing…" : "Close position"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Close position: closes any open position for the configured symbol with a market order. You will be asked to confirm.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
