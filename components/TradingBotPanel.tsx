"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Config = {
  symbol: string;
  timeframe: string;
  leverage: number;
  tpPct: number;
  slPct: number;
  mode: "demo" | "live";
  marginCurrency: "USDT" | "USDC";
  positionSizeUsdt: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
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
      setError(null);
      const res = await fetch("/api/admin/trading-bot");
      const data = await res.json().catch(() => ({}));
      if (data.success && data.config) {
        setConfig(data.config);
        setForm({
          symbol: data.config.symbol,
          timeframe: data.config.timeframe,
          leverage: data.config.leverage,
          tpPct: data.config.tpPct,
          slPct: data.config.slPct,
          mode: data.config.mode,
          marginCurrency: data.config.marginCurrency ?? "USDT",
          positionSizeUsdt: data.config.positionSizeUsdt ?? 50,
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

  const saveConfig = async () => {
    if (!form.symbol || !form.timeframe) {
      setError("Symbol and timeframe are required");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/admin/trading-bot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: form.symbol,
          timeframe: form.timeframe,
          leverage: form.leverage ?? 5,
          tpPct: form.tpPct ?? 2,
          slPct: form.slPct ?? 1,
          mode: form.mode ?? "demo",
          marginCurrency: form.marginCurrency ?? "USDT",
          positionSizeUsdt: form.positionSizeUsdt ?? 50,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      } else {
        setError(data.error ?? "Failed to save");
      }
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const toggleBot = async (start: boolean) => {
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
      } else {
        setError(data.error ?? "Failed to update");
      }
    } catch {
      setError("Failed to update");
    } finally {
      setToggling(false);
    }
  };

  const runNow = async () => {
    try {
      setRunning(true);
      setError(null);
      const res = await fetch("/api/admin/trading-bot/run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setError(null);
        loadConfig();
      } else {
        setError(data.error ?? "Run failed");
      }
    } catch {
      setError("Run failed");
    } finally {
      setRunning(false);
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
        Blofin-powered bot for futures (long/short). Configure symbol, timeframe, leverage, take profit &amp; stop loss. Demo mode for testing; switch to Live when ready.
      </p>

      {error && (
        <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300 space-y-2">
          <p>{error}</p>
          {(error.includes("does not exist") || error.includes("column") || error.includes("relation") || error.includes("TradingBot")) && (
            <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-2">
              Database may need updating. Run: <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">npx prisma db push</code> against your production DATABASE_URL.
            </p>
          )}
        </div>
      )}

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Symbol</label>
              <input
                type="text"
                placeholder="e.g. BTC, ETH"
                value={form.symbol ?? ""}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
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
          {config?.lastError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">Last error: {config.lastError}</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
