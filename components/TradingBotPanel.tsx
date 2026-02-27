"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type PositionWithPnl = {
  instId: string;
  posSide: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
};

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
  marginMode: "cross" | "isolated";
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
  lastDecisionReason: string | null;
  monitorSymbols?: string[];
};

export default function TradingBotPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [closing, setClosing] = useState(false);
  const [positionsData, setPositionsData] = useState<{
    positions: PositionWithPnl[];
    totalUnrealizedPnl: number;
    markPrice: number | null;
  } | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [orderHistory, setOrderHistory] = useState<{ orderId: string; instId: string; side: string; orderType: string; size: string; price: string; state: string; fillPrice?: string; createdAt?: string; pnl?: string }[]>([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);
  const [openOrders, setOpenOrders] = useState<{ orderId: string; instId: string; side: string; orderType: string; size: string; price: string; state: string; createdAt?: string }[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"open_orders" | "positions" | "orders">("positions");
  const [limitOrderPrice, setLimitOrderPrice] = useState("");
  const [limitOrderSide, setLimitOrderSide] = useState<"long" | "short">("long");
  const [placingLimit, setPlacingLimit] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [monitorIntervalMins, setMonitorIntervalMins] = useState<0 | 5 | 10 | 15 | 60>(0);
  const [lastMonitorResult, setLastMonitorResult] = useState<string | null>(null);
  const [monitorBoardSymbols, setMonitorBoardSymbols] = useState<string[]>([]);
  const [monitorBoardInput, setMonitorBoardInput] = useState("");
  const [savingMonitorBoard, setSavingMonitorBoard] = useState(false);
  const [boardRefreshMins, setBoardRefreshMins] = useState<0 | 1 | 2 | 5>(0);
  const [lastBoardRefreshAt, setLastBoardRefreshAt] = useState<number | null>(null);
  const [cancelingAll, setCancelingAll] = useState(false);

  const [form, setForm] = useState<Partial<Config>>({});

  const fetchPositions = useCallback(async () => {
    try {
      setPositionsLoading(true);
      const res = await fetch("/api/admin/trading-bot/positions");
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.positions)) {
        setPositionsData({
          positions: data.positions,
          totalUnrealizedPnl: data.totalUnrealizedPnl ?? 0,
          markPrice: data.markPrice ?? null,
        });
      } else {
        setPositionsData(null);
      }
    } catch {
      setPositionsData(null);
    } finally {
      setPositionsLoading(false);
      setLastBoardRefreshAt(Date.now());
    }
  }, []);

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const loadConfig = async () => {
    try {
      setLoading(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot");
      const data = await res.json().catch(() => ({}));
      if (data.success && data.config) {
        setConfig(data.config);
        setMonitorBoardSymbols(Array.isArray(data.config.monitorSymbols) ? data.config.monitorSymbols : []);
        setForm({
          provider: "blofin",
          symbol: data.config.symbol,
          timeframe: data.config.timeframe,
          leverage: data.config.leverage,
          tpPct: data.config.tpPct,
          slPct: data.config.slPct,
          mode: data.config.mode,
          marginCurrency: data.config.marginCurrency ?? "USDT",
          marginMode: data.config.marginMode === "isolated" ? "isolated" : "cross",
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

  const fetchOrderHistory = useCallback(async () => {
    try {
      setOrderHistoryLoading(true);
      const res = await fetch("/api/admin/trading-bot/orders-history?limit=50");
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.orders)) setOrderHistory(data.orders);
      else setOrderHistory([]);
    } catch {
      setOrderHistory([]);
    } finally {
      setOrderHistoryLoading(false);
    }
  }, []);

  const fetchOpenOrders = useCallback(async () => {
    try {
      setOpenOrdersLoading(true);
      const res = await fetch("/api/admin/trading-bot/open-orders?limit=50");
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.orders)) setOpenOrders(data.orders);
      else setOpenOrders([]);
    } catch {
      setOpenOrders([]);
    } finally {
      setOpenOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config != null) fetchPositions();
  }, [config, fetchPositions]);

  useEffect(() => {
    if (positionsData?.positions?.length) {
      const interval = setInterval(fetchPositions, 30_000);
      return () => clearInterval(interval);
    }
  }, [positionsData?.positions?.length, fetchPositions]);

  useEffect(() => {
    if (activeTab === "open_orders") fetchOpenOrders();
  }, [activeTab, fetchOpenOrders]);

  // Monitoring board independent refresh (positions/PNL only)
  useEffect(() => {
    if (boardRefreshMins <= 0) return undefined;
    const intervalMs = boardRefreshMins * 60 * 1000;
    const t = setInterval(fetchPositions, intervalMs);
    fetchPositions();
    return () => clearInterval(t);
  }, [boardRefreshMins, fetchPositions]);

  // AI Monitor auto-refresh when interval is set
  useEffect(() => {
    if (monitorIntervalMins <= 0) return undefined;
    const runMonitor = async () => {
      try {
        setMonitoring(true);
        const res = await fetch("/api/admin/trading-bot/monitor", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        const msg = data.success ? (data.message ?? "Done.") : (data.error ?? "Failed.");
        setLastMonitorResult(msg);
        if (data.success && (data.closed ?? 0) > 0) fetchPositions();
      } catch {
        setLastMonitorResult("Failed.");
      } finally {
        setMonitoring(false);
      }
    };
    const intervalMs = monitorIntervalMins * 60 * 1000;
    const t = setInterval(runMonitor, intervalMs);
    runMonitor();
    return () => clearInterval(t);
  }, [monitorIntervalMins, fetchPositions]);

  useEffect(() => {
    if (activeTab === "orders") fetchOrderHistory();
  }, [activeTab, fetchOrderHistory]);

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
          marginMode: form.marginMode === "isolated" ? "isolated" : "cross",
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

  const placeLimitOrder = async () => {
    const price = parseFloat(limitOrderPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid entry price (e.g. from NovaStaris AI suggested entry).");
      return;
    }
    try {
      setPlacingLimit(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/place-limit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price, side: limitOrderSide }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? "Limit order placed.");
        setError(null);
        fetchOrderHistory();
        fetchOpenOrders();
      } else {
        setError(data.error ?? "Failed to place limit order.");
        setSuccess(null);
      }
    } catch {
      setError("Failed to place limit order.");
      setSuccess(null);
    } finally {
      setPlacingLimit(false);
    }
  };

  const runAIMonitor = async () => {
    try {
      setMonitoring(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/monitor", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? (data.closed ? "Positions closed." : "No positions closed."));
        setError(null);
        setPositionsData(null);
        fetchPositions();
      } else {
        setError(data.error ?? "Monitor failed.");
        setSuccess(null);
      }
    } catch {
      setError("Monitor failed.");
      setSuccess(null);
    } finally {
      setMonitoring(false);
    }
  };

  const cancelOpenOrder = async (orderId: string, instId: string) => {
    if (!window.confirm(`Cancel limit order ${instId} @ ${orderId}?`)) return;
    try {
      setCancelingOrderId(orderId);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, instId }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? "Order canceled.");
        setError(null);
        fetchOpenOrders();
      } else {
        setError(data.error ?? "Failed to cancel order.");
        setSuccess(null);
      }
    } catch {
      setError("Failed to cancel order.");
      setSuccess(null);
    } finally {
      setCancelingOrderId(null);
    }
  };

  const cancelAllOpenOrders = async () => {
    if (openOrders.length === 0) return;
    if (!window.confirm(`Cancel all ${openOrders.length} open order(s)? This cannot be undone.`)) return;
    try {
      setCancelingAll(true);
      clearFeedback();
      let ok = 0;
      let fail = 0;
      for (const o of openOrders) {
        const res = await fetch("/api/admin/trading-bot/cancel-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: o.orderId, instId: o.instId }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.success) ok++;
        else fail++;
      }
      if (ok > 0) setSuccess(`${ok} order(s) canceled.` + (fail > 0 ? ` ${fail} failed.` : ""));
      else setSuccess(null);
      if (fail > 0) setError(`${fail} order(s) could not be canceled.`);
      else setError(null);
      fetchOpenOrders();
    } catch {
      setError("Failed to cancel some or all orders.");
      setSuccess(null);
    } finally {
      setCancelingAll(false);
    }
  };

  const closePosition = async (instId?: string, closeAll?: boolean) => {
    const label = closeAll ? "all positions" : instId ?? config?.symbol ?? "position";
    if (!window.confirm(`Close ${label}? NovaStaris will use Blofin's close-position API to exit.`)) return;
    try {
      setClosing(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(closeAll ? { closeAll: true } : instId ? { instId } : {}),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? "Position closed.");
        setError(null);
        setPositionsData(null);
        fetchPositions();
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
        <strong className="text-cyan-600 dark:text-cyan-400">NovaStaris</strong> futures bot (long/short) via <strong>Blofin</strong>. Configure symbol, timeframe, leverage, take profit &amp; stop loss.
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
              Blofin
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
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Margin mode</label>
              <select
                value={form.marginMode ?? "cross"}
                onChange={(e) => setForm({ ...form, marginMode: e.target.value as "cross" | "isolated" })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="cross">Cross</option>
                <option value="isolated">Isolated</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Cross uses full account balance; isolated limits risk per position.</p>
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
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Position size (target notional)</label>
            <input
              type="number"
              min="1"
              max="1000000"
              step="1"
              value={form.positionSizeUsdt ?? 50}
              onChange={(e) => setForm({ ...form, positionSizeUsdt: Number(e.target.value) })}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-xs text-muted-foreground mt-1">Margin per trade in USDT/USDC. Notional = margin × leverage. Actual position may be rounded up to the exchange minimum contract size.</p>
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
          <p className="text-xs text-muted-foreground">
            TP/SL are sent to Blofin when the bot opens a position. If they don’t trigger, confirm with Blofin that <code className="rounded bg-zinc-200 dark:bg-zinc-700 px-0.5">order-tpsl</code> is supported for your account.          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Trailing stop:</strong> NovaStaris uses fixed TP/SL for automated risk. Blofin supports trailing stop on their platform; we can add API support here once Blofin exposes it in their API docs.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving} className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700">
              {saving ? "Saving…" : "Save config"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Place limit order &amp; AI Monitor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30 p-3 space-y-3">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Place limit order at entry price</p>
            <p className="text-xs text-muted-foreground">
              When NovaStaris AI suggests an entry price, set an order to be placed at that price (uses bot symbol, size, leverage).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Entry price</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 97234.5"
                  value={limitOrderPrice}
                  onChange={(e) => setLimitOrderPrice(e.target.value)}
                  className="w-32 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Side</label>
                <select
                  value={limitOrderSide}
                  onChange={(e) => setLimitOrderSide(e.target.value as "long" | "short")}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
              <Button onClick={placeLimitOrder} disabled={placingLimit} size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-white">
                {placingLimit ? "Placing…" : "Place limit order"}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30 p-3 space-y-3">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              Monitoring board
              {config != null && (
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${config.mode === "demo" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"}`}>
                  {config.mode === "demo" ? "Demo" : "Live"}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Pin positions or add symbols to choose which positions the AI monitor evaluates. <strong>Leave empty to monitor all</strong> open positions. Use <strong>Run now</strong> / <strong>Auto-refresh</strong> below to refresh PNL independently of the AI monitor.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="e.g. ETH-USDT"
                value={monitorBoardInput}
                onChange={(e) => setMonitorBoardInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = monitorBoardInput.trim().toUpperCase().replace("/", "-");
                    if (v && !monitorBoardSymbols.includes(v)) setMonitorBoardSymbols([...monitorBoardSymbols, v]);
                    setMonitorBoardInput("");
                  }
                }}
                className="w-36 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const v = monitorBoardInput.trim().toUpperCase().replace("/", "-");
                  if (v && !monitorBoardSymbols.includes(v)) setMonitorBoardSymbols([...monitorBoardSymbols, v]);
                  setMonitorBoardInput("");
                }}
              >
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={savingMonitorBoard}
                onClick={async () => {
                  try {
                    setSavingMonitorBoard(true);
                    clearFeedback();
                    const res = await fetch("/api/admin/trading-bot", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ monitorSymbols: monitorBoardSymbols }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data.success) {
                      setSuccess("Monitoring board saved.");
                      setError(null);
                    } else setError(data.error ?? "Failed to save.");
                  } catch {
                    setError("Failed to save.");
                  } finally {
                    setSavingMonitorBoard(false);
                  }
                }}
              >
                {savingMonitorBoard ? "Saving…" : "Save"}
              </Button>
              {positionsData && positionsData.positions.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const symbols = [...new Set(positionsData!.positions.map((p) => (p.instId ?? "").trim().toUpperCase().replace("/", "-")).filter(Boolean))];
                    const merged = [...new Set([...monitorBoardSymbols, ...symbols])];
                    setMonitorBoardSymbols(merged);
                  }}
                  className="border-cyan-500 text-cyan-700 dark:text-cyan-300"
                >
                  Pin all positions
                </Button>
              )}
            </div>
            {monitorBoardSymbols.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {monitorBoardSymbols.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-xs"
                  >
                    {s}
                    <button
                      type="button"
                      aria-label={`Remove ${s}`}
                      onClick={() => setMonitorBoardSymbols(monitorBoardSymbols.filter((x) => x !== s))}
                      className="hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-600">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Board refresh:</span>
              <select
                value={boardRefreshMins}
                onChange={(e) => setBoardRefreshMins(Number(e.target.value) as 0 | 1 | 2 | 5)}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
              >
                <option value={0}>Off</option>
                <option value={1}>Every 1 min</option>
                <option value={2}>Every 2 min</option>
                <option value={5}>Every 5 min</option>
              </select>
              <Button type="button" variant="outline" size="sm" onClick={fetchPositions} disabled={positionsLoading} className="border-zinc-500 text-zinc-700 dark:text-zinc-300">
                {positionsLoading ? "Refreshing…" : "Run now"}
              </Button>
              {lastBoardRefreshAt != null && !positionsLoading && (
                <span className="text-xs text-muted-foreground">
                  Last refreshed: {(() => {
                    const sec = Math.floor((Date.now() - lastBoardRefreshAt) / 1000);
                    if (sec < 10) return "just now";
                    if (sec < 60) return `${sec}s ago`;
                    const min = Math.floor(sec / 60);
                    return min === 1 ? "1 min ago" : `${min} min ago`;
                  })()}
                </span>
              )}
              <span className="text-xs text-muted-foreground">Refreshes positions &amp; PNL only (no AI).</span>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30 p-3 space-y-3">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              AI Monitor
              {config != null && (
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${config.mode === "demo" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"}`}>
                  {config.mode === "demo" ? "Demo" : "Live"}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Run NovaStaris AI to evaluate open positions{monitorBoardSymbols.length > 0 ? " on your monitoring board" : ""}. If the trend is opposite or the analysis is negative, the position will be closed automatically. Enable auto-refresh to run periodically. Uses the same account (<strong>{config?.mode === "demo" ? "Demo" : "Live"}</strong>) as the bot—positions above must be in that account to be seen.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Auto-refresh:</span>
              <select
                value={monitorIntervalMins}
                onChange={(e) => setMonitorIntervalMins(Number(e.target.value) as 0 | 5 | 10 | 15 | 60)}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
              >
                <option value={0}>Off</option>
                <option value={5}>Every 5 min</option>
                <option value={10}>Every 10 min</option>
                <option value={15}>Every 15 min</option>
                <option value={60}>Every 1 hour</option>
              </select>
              <Button onClick={runAIMonitor} disabled={monitoring} variant="outline" size="sm" className="border-cyan-500 text-cyan-700 dark:text-cyan-300">
                {monitoring ? "Running…" : "Run now"}
              </Button>
            </div>
            {lastMonitorResult != null && (
              <p className="text-xs text-muted-foreground">Last monitor: {lastMonitorResult}</p>
            )}
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
              {(config as { lastDecisionReason?: string | null }).lastDecisionReason && (
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 border-t border-emerald-200/60 dark:border-emerald-800/60 pt-2">
                  <span className="font-medium">Reason: </span>{(config as { lastDecisionReason?: string }).lastDecisionReason}
                </p>
              )}
            </div>
          )}
          {config != null && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-900/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">Open orders, positions &amp; history</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("open_orders")}
                    className={`px-2 py-0.5 rounded text-xs ${activeTab === "open_orders" ? "bg-zinc-300 dark:bg-zinc-600" : "bg-zinc-200/60 dark:bg-zinc-700/60"}`}
                  >
                    Open orders
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("positions")}
                    className={`px-2 py-0.5 rounded text-xs ${activeTab === "positions" ? "bg-zinc-300 dark:bg-zinc-600" : "bg-zinc-200/60 dark:bg-zinc-700/60"}`}
                  >
                    Positions
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className={`px-2 py-0.5 rounded text-xs ${activeTab === "orders" ? "bg-zinc-300 dark:bg-zinc-600" : "bg-zinc-200/60 dark:bg-zinc-700/60"}`}
                  >
                    Order history
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2 -mt-1">Open orders = pending (unfilled). Positions = open positions only. Order history = filled/canceled.</p>
              {activeTab === "open_orders" && (
                <div className="mt-2 max-h-64 overflow-auto">
                  {openOrdersLoading ? (
                    <p className="text-muted-foreground text-xs">Loading open orders…</p>
                  ) : openOrders.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No open (pending) orders.</p>
                  ) : (
                    <div className="space-y-1 text-xs">
                      {openOrders.map((o, i) => (
                        <div key={o.orderId || i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 p-1.5 rounded border border-zinc-200 dark:border-zinc-600">
                          <span className="font-medium">{o.instId}</span>
                          <span className={o.side === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{o.side.toUpperCase()}</span>
                          <span>{o.orderType}</span>
                          <span>size {o.size}</span>
                          <span>@ {o.price}</span>
                          <span className="text-muted-foreground">{o.state}</span>
                          {o.createdAt != null && <span className="text-muted-foreground">{new Date(Number(o.createdAt)).toLocaleString()}</span>}
                          <Button type="button" variant="outline" size="sm" className="ml-auto h-6 text-xs border-amber-500 text-amber-700 dark:text-amber-300" onClick={() => cancelOpenOrder(o.orderId, o.instId)} disabled={cancelingOrderId === o.orderId}>
                            {cancelingOrderId === o.orderId ? "Canceling…" : "Cancel"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchOpenOrders} disabled={openOrdersLoading}>
                      {openOrdersLoading ? "Refreshing…" : "Refresh"}
                    </Button>
                    {openOrders.length > 0 && (
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-rose-500 text-rose-700 dark:text-rose-300" onClick={cancelAllOpenOrders} disabled={cancelingAll}>
                        {cancelingAll ? "Canceling…" : "Cancel all"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {activeTab === "positions" && (
                <>
                  {positionsLoading && !positionsData ? (
                    <p className="text-muted-foreground text-xs">Loading…</p>
                  ) : positionsData && positionsData.positions.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {positionsData.positions.map((p, i) => {
                        const instIdNorm = (p.instId ?? "").trim().toUpperCase().replace("/", "-");
                        const isPinned = instIdNorm && monitorBoardSymbols.includes(instIdNorm);
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs p-2 rounded border border-zinc-200 dark:border-zinc-600">
                            <span className="text-zinc-600 dark:text-zinc-400 font-medium">{p.instId}</span>
                            <span className={p.posSide === "long" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{p.posSide.toUpperCase()}</span>
                            <span className="text-muted-foreground">Entry: {p.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            {(p.markPrice ?? positionsData.markPrice) != null && <span className="text-muted-foreground">Mark: {(p.markPrice ?? positionsData.markPrice)!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            <span className={p.unrealizedPnl >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>
                              PNL: {p.unrealizedPnl >= 0 ? "+" : ""}{p.unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                            </span>
                            {instIdNorm && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs border-cyan-500 text-cyan-700 dark:text-cyan-300"
                                onClick={() => {
                                  if (isPinned) setMonitorBoardSymbols(monitorBoardSymbols.filter((x) => x !== instIdNorm));
                                  else if (!monitorBoardSymbols.includes(instIdNorm)) setMonitorBoardSymbols([...monitorBoardSymbols, instIdNorm]);
                                }}
                              >
                                {isPinned ? "Unpin" : "Pin to board"}
                              </Button>
                            )}
                            <Button type="button" variant="outline" size="sm" className="h-6 text-xs border-amber-500 text-amber-700 dark:text-amber-300" onClick={() => closePosition(p.instId)} disabled={closing}>
                              Close
                            </Button>
                          </div>
                        );
                      })}
                      <p className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-600 font-semibold">
                        Total unrealized:{" "}
                        <span className={positionsData.totalUnrealizedPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {positionsData.totalUnrealizedPnl >= 0 ? "+" : ""}{positionsData.totalUnrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </span>
                      </p>
                      <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={fetchPositions} disabled={positionsLoading}>
                        {positionsLoading ? "Refreshing…" : "Refresh PNL"}
                      </Button>
                    </div>
                  ) : positionsData && positionsData.positions.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No open positions on exchange.</p>
                  ) : null}
                </>
              )}
              {activeTab === "orders" && (
                <div className="mt-2 max-h-64 overflow-auto">
                  {orderHistoryLoading ? (
                    <p className="text-muted-foreground text-xs">Loading order history…</p>
                  ) : orderHistory.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No orders in history.</p>
                  ) : (
                    <div className="space-y-1 text-xs">
                      {orderHistory.map((o, i) => (
                        <div key={o.orderId || i} className="flex flex-wrap gap-x-2 gap-y-0.5 p-1.5 rounded border border-zinc-200 dark:border-zinc-600">
                          <span className="font-medium">{o.instId}</span>
                          <span className={o.side === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{o.side.toUpperCase()}</span>
                          <span>{o.orderType}</span>
                          <span>size {o.size}</span>
                          {o.fillPrice != null && <span>@ {o.fillPrice}</span>}
                          {o.pnl != null && o.pnl !== "" && (
                            <span className={Number(o.pnl) >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>
                              PNL: {Number(o.pnl) >= 0 ? "+" : ""}{Number(o.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT
                            </span>
                          )}
                          <span className="text-muted-foreground">{o.state}</span>
                          {o.createdAt != null && <span className="text-muted-foreground">{new Date(Number(o.createdAt)).toLocaleString()}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={fetchOrderHistory} disabled={orderHistoryLoading}>
                    {orderHistoryLoading ? "Refreshing…" : "Refresh"}
                  </Button>
                </div>
              )}
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
              onClick={() => closePosition()}
              disabled={closing}
              variant="outline"
              className="border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            >
              {closing ? "Closing…" : "Close position"}
            </Button>
            {positionsData && positionsData.positions.length > 1 && (
              <Button
                onClick={() => closePosition(undefined, true)}
                disabled={closing}
                variant="outline"
                className="border-rose-500 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                Close all
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Close: uses Blofin close-position API for the configured symbol (or choose &quot;Close all&quot; when multiple positions). You will be asked to confirm.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Run now</strong> runs one cycle. If you already have a position, the bot skips opening (no second position). To add size at a specific price, use <strong>Place limit order</strong> above—no need to stop the bot.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
