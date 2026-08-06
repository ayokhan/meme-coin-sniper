"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Clock, Crosshair, Layers, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseScalperInstrument } from "@/lib/nova-scalper-instrument";
import {
  clearNovaScalperPrefill,
  readNovaScalperPrefill,
  scalperEntryTriggerFor,
  scalperInstrumentPairFor,
} from "@/lib/nova-scalper-prefill";
import { BlofinPartnerPromoBanner } from "@/components/BlofinPartnerPromoBanner";

type ScalperConfig = {
  id: string;
  /** 1-based label: Config 1, Config 2, … */
  slot: number;
  enabled: boolean;
  /** True when owner used Admin → NovaScalper Disable; user cannot re-enable from here. */
  ownerForceOff?: boolean;
  mode: "demo" | "live";
  symbol: string;
  marginCurrency: string;
  /** Editable pair e.g. BTC/USDT — sent as `symbol` on save */
  instrumentPair: string;
  instId: string;
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

function normalizeConfigPayload(c: ScalperConfig): ScalperConfig {
  const pair =
    c.instrumentPair?.trim() ||
    `${String(c.symbol ?? "BTC").toUpperCase()}/${c.marginCurrency === "USDC" ? "USDC" : "USDT"}`;
  return {
    ...c,
    slot: typeof c.slot === "number" ? c.slot : 1,
    instrumentPair: pair,
    instId: String(c.instId ?? ""),
  };
}

export default function NovaScalperPanel() {
  const [configs, setConfigs] = useState<ScalperConfig[]>([]);
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
  const [autoSec, setAutoSec] = useState<0 | 15 | 30 | 60>(0);
  const [userBlofinConfigured, setUserBlofinConfigured] = useState<boolean | null>(null);
  const [blofinKeysForm, setBlofinKeysForm] = useState({
    apiKey: "",
    secretKey: "",
    passphrase: "",
    demoMode: true,
    brokerId: "",
  });
  const [savingBlofinKeys, setSavingBlofinKeys] = useState(false);
  const [clearingBlofinKeys, setClearingBlofinKeys] = useState(false);
  const [pnl, setPnl] = useState<{
    loading: boolean;
    upl: number | null;
    quote: string;
    hasPosition: boolean;
    markPrice: number | null;
    needsKeys?: boolean;
    err?: string | null;
  }>({
    loading: false,
    upl: null,
    quote: "USDT",
    hasPosition: false,
    markPrice: null,
  });

  const loadUserBlofinConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/user/blofin-config", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setUserBlofinConfigured(data.success && data.configured === true);
    } catch {
      setUserBlofinConfigured(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      void loadUserBlofinConfig();
      const res = await fetch("/api/admin/nova-scalper", { credentials: "include", cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        configs?: ScalperConfig[];
        maxConfigs?: number;
        error?: string;
      };
      if (data.success && Array.isArray(data.configs) && data.configs.length > 0) {
        const list = data.configs.map(normalizeConfigPayload);
        setConfigs(list);
        setMaxConfigs(typeof data.maxConfigs === "number" ? data.maxConfigs : 6);
        setActiveConfigId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0].id;
        });
      } else {
        setConfigs([]);
        setActiveConfigId("");
        setError(
          data.error ??
            (!res.ok ? `Request failed (${res.status}).` : "No config returned. Try again or check the server logs.")
        );
      }
    } catch (e) {
      setConfigs([]);
      setActiveConfigId("");
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [loadUserBlofinConfig]);

  useEffect(() => {
    void load();
  }, [load]);

  // Apply a "Scalp this trade" hand-off from Nova Scalp Agent onto the active config.
  // We only pre-fill the form; the user reviews and clicks Save (never auto-trades).
  useEffect(() => {
    if (prefillAppliedRef.current) return;
    if (loading || !activeConfigId || configs.length === 0) return;
    const prefill = readNovaScalperPrefill();
    if (!prefill) return;
    prefillAppliedRef.current = true;
    const leverage = Math.max(1, Math.min(125, Math.round(prefill.leverage) || 1));
    const pair = scalperInstrumentPairFor(prefill.symbol);
    setConfigs((list) =>
      list.map((c) =>
        c.id === activeConfigId
          ? {
              ...c,
              instrumentPair: pair,
              instId: "",
              side: prefill.side,
              entryTrigger: scalperEntryTriggerFor(prefill.side),
              entryPrice: prefill.entryPrice,
              exitPrice: prefill.exitPrice,
              stopLossPrice:
                prefill.stopLossPrice != null && Number.isFinite(prefill.stopLossPrice)
                  ? prefill.stopLossPrice
                  : null,
              leverage,
              positionSizeUsdt:
                Number.isFinite(prefill.marginUsd) && prefill.marginUsd > 0
                  ? prefill.marginUsd
                  : c.positionSizeUsdt,
            }
          : c
      )
    );
    setPrefillNotice(
      `Loaded ${prefill.side.toUpperCase()} ${pair} from ${prefill.source}. Review the levels below, then Save. Nothing is placed until you Save and run a tick.`
    );
    clearNovaScalperPrefill();
  }, [loading, activeConfigId, configs.length]);

  const fetchPositionPnl = useCallback(async () => {
    const cfg = configs.find((c) => c.id === activeConfigId);
    if (!cfg?.id) return;
    setPnl((prev) => ({ ...prev, loading: true, err: null }));
    try {
      const res = await fetch(
        `/api/admin/nova-scalper/position?configId=${encodeURIComponent(cfg.id)}`,
        { credentials: "include", cache: "no-store" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        upl?: number | null;
        quote?: string;
        hasPosition?: boolean;
        markPrice?: number | null;
        needsKeys?: boolean;
        error?: string;
      };
      if (!data.success) {
        setPnl({
          loading: false,
          upl: null,
          quote: cfg.marginCurrency === "USDC" ? "USDC" : "USDT",
          hasPosition: false,
          markPrice: null,
          err: data.error ?? "Could not load PnL",
        });
        return;
      }
      setPnl({
        loading: false,
        upl: data.upl ?? null,
        quote: data.quote ?? "USDT",
        hasPosition: !!data.hasPosition,
        markPrice: typeof data.markPrice === "number" ? data.markPrice : null,
        needsKeys: !!data.needsKeys,
        err: null,
      });
    } catch {
      setPnl((prev) => ({
        ...prev,
        loading: false,
        err: "Could not load PnL",
      }));
    }
  }, [configs, activeConfigId]);

  useEffect(() => {
    if (!activeConfigId || !configs.some((c) => c.id === activeConfigId)) return;
    void fetchPositionPnl();
  }, [activeConfigId, configs, fetchPositionPnl]);

  useEffect(() => {
    if (!activeConfigId || !configs.some((c) => c.id === activeConfigId)) return;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void fetchPositionPnl();
    }, 10_000);
    return () => clearInterval(id);
  }, [activeConfigId, configs, fetchPositionPnl]);

  /** Sync when returning to the tab — admin may have disabled NovaScalper or cleared the owner lock. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        void load();
        setTimeout(() => void fetchPositionPnl(), 600);
      }, 250);
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
  }, [load, fetchPositionPnl]);

  useEffect(() => {
    const config = configs.find((c) => c.id === activeConfigId);
    if (autoSec === 0 || !config?.enabled) return;
    const id = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch("/api/admin/nova-scalper/tick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ configId: config.id }),
          });
          await res.json().catch(() => ({}));
          await load();
          setTimeout(() => void fetchPositionPnl(), 500);
        } catch {
          /* ignore */
        }
      })();
    }, autoSec * 1000);
    return () => clearInterval(id);
  }, [autoSec, activeConfigId, configs, load, fetchPositionPnl]);

  const save = async (overrides?: Partial<ScalperConfig>) => {
    const config = configs.find((c) => c.id === activeConfigId);
    if (!config) return;
    const merged = { ...config, ...overrides };
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { instrumentPair, instId: _inst, ...rest } = merged;
      const normalizedSymbol = instrumentPair.trim().toUpperCase().replace(/-/g, "/");
      const res = await fetch("/api/admin/nova-scalper", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...rest, symbol: normalizedSymbol, configId: merged.id }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        const c = normalizeConfigPayload(data.config as ScalperConfig);
        setConfigs((list) => list.map((row) => (row.id === c.id ? c : row)));
        setSuccess(c.enabled ? "Saved — bot is ON for this config." : "NovaScalper saved.");
      } else setError(data.error ?? "Save failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleBotEnabled = async () => {
    const config = configs.find((c) => c.id === activeConfigId);
    if (!config || config.ownerForceOff) return;
    const next = !config.enabled;
    setConfigs((list) => list.map((c) => (c.id === activeConfigId ? { ...c, enabled: next } : c)));
    await save({ enabled: next });
  };

  const addConfig = async () => {
    setAddingConfig(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/nova-scalper", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.success && Array.isArray(data.configs)) {
        const list = (data.configs as ScalperConfig[]).map(normalizeConfigPayload);
        setConfigs(list);
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
      const res = await fetch(`/api/admin/nova-scalper?id=${encodeURIComponent(config.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.configs)) {
        const list = (data.configs as ScalperConfig[]).map(normalizeConfigPayload);
        setConfigs(list);
        setActiveConfigId(list[0]?.id ?? "");
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
      const res = await fetch("/api/admin/nova-scalper/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ configId: config.id }),
      });
      const data = await res.json();
      await load();
      setTimeout(() => void fetchPositionPnl(), 400);
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
      const res = await fetch("/api/admin/nova-scalper/reset", {
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
        setTimeout(() => void fetchPositionPnl(), 400);
      } else setError(data.error ?? "Reset failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading NovaScalper…</p>;
  }

  if (configs.length === 0) {
    return (
      <div className="space-y-4 max-w-2xl py-4">
        <p className="text-sm text-muted-foreground">
          NovaScalper could not load your saved settings. If the message below mentions the database or{" "}
          <code className="text-xs rounded bg-zinc-200/80 dark:bg-zinc-700/80 px-1">userId</code>, update production with{" "}
          <code className="text-xs rounded bg-zinc-200/80 dark:bg-zinc-700/80 px-1">npx prisma db push</code>.
        </p>
        {error && (
          <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300 space-y-2">
            <p>{error}</p>
            {(error.includes("does not exist") ||
              error.includes("column") ||
              error.includes("userId") ||
              error.includes("NovaScalperConfig") ||
              error.includes("prisma")) && (
              <p className="text-xs text-rose-600/90 dark:text-rose-400/90">
                Run <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">npx prisma db push</code> against the
                same <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">DATABASE_URL</code> Vercel (or your
                host) uses, then redeploy if needed.
              </p>
            )}
            {(error.toLowerCase().includes("sign in") || error.includes("401")) && (
              <p className="text-xs text-rose-600/90 dark:text-rose-400/90">Sign in, then open this tab again.</p>
            )}
          </div>
        )}
        {!error && (
          <p className="text-sm text-muted-foreground">No config was returned. Use Retry or check your connection.</p>
        )}
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const config = configs.find((c) => c.id === activeConfigId);
  if (!config) {
    return <p className="text-sm text-muted-foreground py-4">Loading NovaScalper…</p>;
  }

  const setField = <K extends keyof ScalperConfig>(key: K, value: ScalperConfig[K]) => {
    setConfigs((list) => list.map((c) => (c.id === activeConfigId ? { ...c, [key]: value } : c)));
  };

  const parsedInstrument = parseScalperInstrument(config.instrumentPair, config.marginCurrency);
  const priceQuote = parsedInstrument.quote;
  const displayInstId = parsedInstrument.instId || config.instId || "";

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        <strong className="text-cyan-600 dark:text-cyan-400">NovaScalper</strong> repeats{" "}
        <strong>enter → exit</strong> on Blofin futures using your prices. Use{" "}
        <strong className="text-foreground">Config 1, Config 2, …</strong> to run{" "}
        <strong className="text-foreground">different contracts in parallel</strong> (each has its own instrument and
        automation flag).{" "}
        <strong className="text-foreground">Check price</strong> and optional in-tab auto checks evaluate each enabled
        config. If your host runs <strong className="text-foreground">overnight automation</strong> (when turned on in
        admin), those runs do the same. Exits use{" "}
        <strong>close position</strong> when price crosses your exit target (TP orders optional).{" "}
        <strong>Entry, exit, and stop</strong> for this config are in {priceQuote} — same units as Blofin mark for{" "}
        <span className="font-mono text-xs">{displayInstId || "…"}</span>.
      </p>

      {prefillNotice && (
        <div className="rounded-lg border border-cyan-300/80 dark:border-cyan-700/80 bg-cyan-50/70 dark:bg-cyan-950/30 p-3 text-sm text-cyan-900 dark:text-cyan-100 flex items-start gap-2">
          <Zap className="h-4 w-4 mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <div className="flex-1 space-y-1">
            <p className="font-medium">Prefilled from Nova Scalp</p>
            <p className="text-cyan-800/90 dark:text-cyan-200/90">{prefillNotice}</p>
          </div>
          <button
            type="button"
            onClick={() => setPrefillNotice(null)}
            className="text-cyan-700/70 dark:text-cyan-300/70 hover:text-cyan-900 dark:hover:text-cyan-100 text-xs font-medium"
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
        <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300 space-y-2">
          <p>{error}</p>
          {(error.includes("does not exist") || error.includes("column") || error.includes("userId") || error.includes("NovaScalperConfig")) && (
            <p className="text-xs text-rose-600/90 dark:text-rose-400/90">
              Database may need updating. Run:{" "}
              <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">npx prisma db push</code> against your
              production <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">DATABASE_URL</code>.
            </p>
          )}
        </div>
      )}

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Your Blofin API keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <BlofinPartnerPromoBanner compact />
          <p className="text-sm text-muted-foreground">
            VIP and on-demand: save keys here so NovaScalper uses your account (encrypted; used only to call Blofin).
            Server-side <code className="text-xs rounded bg-zinc-200/80 dark:bg-zinc-700/80 px-1">BLOFIN_*</code> env keys are
            used when you have nothing saved here.
          </p>
          <p className="text-xs text-muted-foreground">
            For <strong className="text-foreground">Live</strong> trading, use API keys created for Blofin live, uncheck{" "}
            <strong className="text-foreground">Demo mode</strong> above when saving keys, and set NovaScalper{" "}
            <strong className="text-foreground">Mode</strong> below to Live so URLs and keys stay in sync.
          </p>
          {userBlofinConfigured === true && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Keys are configured. Ticks use your account.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">API Key</label>
              <input
                type="password"
                placeholder="••••••••"
                value={blofinKeysForm.apiKey}
                onChange={(e) => setBlofinKeysForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Secret Key</label>
              <input
                type="password"
                placeholder="••••••••"
                value={blofinKeysForm.secretKey}
                onChange={(e) => setBlofinKeysForm((f) => ({ ...f, secretKey: e.target.value }))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Passphrase</label>
              <input
                type="password"
                placeholder="••••••••"
                value={blofinKeysForm.passphrase}
                onChange={(e) => setBlofinKeysForm((f) => ({ ...f, passphrase: e.target.value }))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="nova-scalper-blofin-demo"
                checked={blofinKeysForm.demoMode}
                onChange={(e) => setBlofinKeysForm((f) => ({ ...f, demoMode: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="nova-scalper-blofin-demo" className="text-sm">
                Demo mode
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Broker ID (optional)</label>
              <input
                type="text"
                placeholder="Leave empty if not using broker key"
                value={blofinKeysForm.brokerId}
                onChange={(e) => setBlofinKeysForm((f) => ({ ...f, brokerId: e.target.value }))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={
                savingBlofinKeys || !blofinKeysForm.apiKey || !blofinKeysForm.secretKey || !blofinKeysForm.passphrase
              }
              onClick={async () => {
                setSavingBlofinKeys(true);
                try {
                  const res = await fetch("/api/user/blofin-config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      apiKey: blofinKeysForm.apiKey,
                      secretKey: blofinKeysForm.secretKey,
                      passphrase: blofinKeysForm.passphrase,
                      demoMode: blofinKeysForm.demoMode,
                      brokerId: blofinKeysForm.brokerId || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setUserBlofinConfigured(true);
                    setBlofinKeysForm((f) => ({ ...f, apiKey: "", secretKey: "", passphrase: "" }));
                    setSuccess("Blofin keys saved.");
                  } else setError(data.error ?? "Save failed");
                } finally {
                  setSavingBlofinKeys(false);
                }
              }}
            >
              {savingBlofinKeys ? "Saving…" : "Save keys"}
            </Button>
            {userBlofinConfigured && (
              <Button
                size="sm"
                variant="outline"
                disabled={clearingBlofinKeys}
                onClick={async () => {
                  setClearingBlofinKeys(true);
                  try {
                    const res = await fetch("/api/user/blofin-config", { method: "DELETE", credentials: "include" });
                    const data = await res.json();
                    if (data.success) {
                      setUserBlofinConfigured(false);
                      setSuccess("Blofin keys cleared.");
                    }
                  } finally {
                    setClearingBlofinKeys(false);
                    void loadUserBlofinConfig();
                  }
                }}
              >
                {clearingBlofinKeys ? "…" : "Clear keys"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="text-base font-semibold">NovaScalper configs</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-600/80">
              {configs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConfigId(c.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    c.id === activeConfigId
                      ? "bg-cyan-500 text-white dark:bg-cyan-600"
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
              NovaScalper was <strong>disabled by the owner</strong> in Admin. Start stays off until they enable you
              again. You can still change prices and save other settings.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="default"
              disabled={!!config.ownerForceOff || saving}
              onClick={() => void toggleBotEnabled()}
              className={
                config.enabled
                  ? "bg-rose-600 hover:bg-rose-700 text-white min-w-[9rem]"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white min-w-[9rem]"
              }
            >
              {saving ? "Saving…" : config.enabled ? "Stop bot" : "Start bot"}
            </Button>
            <div className="text-sm">
              <span
                className={
                  config.enabled
                    ? "font-semibold text-emerald-700 dark:text-emerald-400"
                    : "font-semibold text-zinc-500 dark:text-zinc-400"
                }
              >
                {config.enabled ? "Running" : "Stopped"}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">
                Start arms this config for each tick (Check price / Auto tick / server cron). It does not trade other
                configs. Use <strong className="text-foreground">Max repeat rounds</strong> to auto-stop after N
                successes (<strong className="text-foreground">0</strong> = keep going when flat).
              </p>
            </div>
          </div>

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
            <p className="text-xs text-muted-foreground mt-1">
              Demo vs Live chooses Blofin&apos;s demo or production API host. It must match the API keys you use (saved
              above or server env).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Instrument (pair)
              </label>
              <input
                value={config.instrumentPair}
                onChange={(e) => setField("instrumentPair", e.target.value.toUpperCase())}
                placeholder="BTC/USDT, XAU, XAG, GOLD, or SILVER"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Blofin instrument id: <span className="font-mono">{displayInstId || "—"}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Metals shortcuts: <span className="font-mono">XAU</span>/<span className="font-mono">GOLD</span> → <span className="font-mono">XAU-USDT</span>,{" "}
                <span className="font-mono">XAG</span>/<span className="font-mono">SILVER</span> → <span className="font-mono">XAG-USDT</span> on Blofin.
              </p>
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
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Margin ({priceQuote})
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={config.positionSizeUsdt}
                onChange={(e) => setField("positionSizeUsdt", parseFloat(e.target.value) || 1)}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">Notional = margin × leverage.</p>
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

          <div className="rounded-md border border-zinc-200/90 dark:border-zinc-600/80 bg-zinc-50/80 dark:bg-zinc-900/40 p-3 text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Exit target:</strong> when price crosses your exit level (same
              cross-style logic as entry, using last price), NovaScalper calls Blofin&apos;s{" "}
              <strong className="text-foreground">close position</strong> API—the same mechanism the Crypto Futures bot uses
              for manual <strong className="text-foreground">Close</strong> on that symbol.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Entry price ({priceQuote})
              </label>
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
                Exit price — take profit ({priceQuote})
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
              Stop loss (optional, {priceQuote})
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

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Max repeat rounds (full cycles)
            </label>
            <input
              type="number"
              min={0}
              value={config.maxRounds}
              onChange={(e) => setField("maxRounds", Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              <strong className="text-foreground">0</strong> = unlimited repeats.{" "}
              <strong className="text-foreground">1, 2, …</strong> = after that many successful exit (or stop) closes,
              NovaScalper turns off. While you already hold a position or have a pending order on this contract, no second
              entry is placed.
            </p>
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

          <div className="rounded-md border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 p-3 space-y-1.5">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.attachTpsl}
                onChange={(e) => setField("attachTpsl", e.target.checked)}
              />
              <span className="text-sm">Also attach Blofin TP/SL after entry</span>
            </label>
            <p className="text-xs text-muted-foreground pl-6">
              Uses the same <strong className="text-foreground">Exit price</strong> and{" "}
              <strong className="text-foreground">Stop loss</strong> above (absolute prices, not %). Soft cron close
              stays as backup.
            </p>
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
              <span className="text-xs text-slate-600 dark:text-slate-300">Runs only while this tab is open.</span>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              <strong>Reset last ref price</strong> clears the stored price used to detect entry/exit <em>crosses</em> (not
              margin mode). Next tick re-primes from the market. Also clears the internal &quot;in position&quot; flag unless
              you only reset rounds.
            </p>
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

      <Card className="overflow-hidden border-zinc-200/80 dark:border-zinc-700/80 bg-gradient-to-br from-zinc-50 via-white to-cyan-50/40 dark:from-zinc-950 dark:via-zinc-900 dark:to-cyan-950/30">
        <CardHeader className="pb-3 border-b border-zinc-200/60 dark:border-zinc-700/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              Status
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              {config.enabled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
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
        <CardContent className="pt-4 space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Contract</p>
              <p className="font-mono text-lg font-semibold text-foreground tracking-tight">
                {displayInstId || "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                In position (internal)
              </p>
              <p
                className={
                  config.inPosition
                    ? "text-sm font-semibold text-amber-700 dark:text-amber-300"
                    : "text-sm font-semibold text-zinc-500 dark:text-zinc-400"
                }
              >
                {config.inPosition ? "Yes" : "No"}
              </p>
            </div>
          </div>

          <div
            className={
              pnl.hasPosition && pnl.upl != null && Number.isFinite(pnl.upl)
                ? pnl.upl >= 0
                  ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3"
                  : "rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3"
                : "rounded-xl border border-zinc-200/80 dark:border-zinc-700/70 bg-zinc-100/50 dark:bg-zinc-950/40 px-4 py-3"
            }
            title="Unrealized PnL from your Blofin position for this contract. If the exchange does not return it directly, we estimate from mark vs average entry."
          >
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
              Live unrealized PnL
            </p>
            {pnl.needsKeys ? (
              <p className="text-sm text-muted-foreground">Save Blofin keys above to load from the exchange</p>
            ) : pnl.loading ? (
              <p className="text-sm text-muted-foreground animate-pulse">Fetching…</p>
            ) : !pnl.hasPosition ? (
              <p className="text-sm text-muted-foreground">
                Flat on Blofin{displayInstId ? ` · ${displayInstId}` : ""}
              </p>
            ) : pnl.upl != null && Number.isFinite(pnl.upl) ? (
              <p
                className={
                  pnl.upl >= 0
                    ? "text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                    : "text-2xl font-semibold tabular-nums text-rose-700 dark:text-rose-300"
                }
              >
                {pnl.upl >= 0 ? "+" : ""}
                {pnl.upl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                <span className="text-base font-medium opacity-80">{pnl.quote}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
            {pnl.err && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {pnl.err}
              </p>
            )}
            {pnl.hasPosition && pnl.markPrice != null && Number.isFinite(pnl.markPrice) && (
              <p className="mt-1 text-xs text-muted-foreground">
                Mark{" "}
                <span className="font-mono text-foreground/90">
                  {pnl.markPrice.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                </span>{" "}
                {pnl.quote}
              </p>
            )}
          </div>

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
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-700/80 dark:text-cyan-300/80 mb-0.5">
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
