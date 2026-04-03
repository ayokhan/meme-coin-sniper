"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseScalperInstrument } from "@/lib/nova-scalper-instrument";

type ScalperConfig = {
  id: string;
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

export default function NovaScalperPanel() {
  const [config, setConfig] = useState<ScalperConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticking, setTicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
        config?: ScalperConfig;
        error?: string;
      };
      if (data.success && data.config) {
        const c = data.config;
        const pair =
          c.instrumentPair?.trim() ||
          `${String(c.symbol ?? "BTC").toUpperCase()}/${c.marginCurrency === "USDC" ? "USDC" : "USDT"}`;
        setConfig({
          ...c,
          instrumentPair: pair,
          instId: String(c.instId ?? ""),
        });
      } else {
        setConfig(null);
        setError(
          data.error ??
            (!res.ok ? `Request failed (${res.status}).` : "No config returned. Try again or check the server logs.")
        );
      }
    } catch (e) {
      setConfig(null);
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [loadUserBlofinConfig]);

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
      const { instrumentPair, instId, ...rest } = config;
      const normalizedSymbol = instrumentPair.trim().toUpperCase().replace(/-/g, "/");
      const res = await fetch("/api/admin/nova-scalper", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...rest, symbol: normalizedSymbol }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        const c = data.config as ScalperConfig;
        setConfig({
          ...c,
          instrumentPair: c.instrumentPair ?? `${c.symbol}/${c.marginCurrency === "USDC" ? "USDC" : "USDT"}`,
          instId: String(c.instId ?? ""),
        });
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
    return <p className="text-sm text-muted-foreground py-4">Loading NovaScalper…</p>;
  }

  if (!config) {
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

  const setField = <K extends keyof ScalperConfig>(key: K, value: ScalperConfig[K]) => {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  };

  const parsedInstrument = parseScalperInstrument(config.instrumentPair, config.marginCurrency);
  const priceQuote = parsedInstrument.quote;
  const displayInstId = parsedInstrument.instId || config.instId || "";

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        <strong className="text-cyan-600 dark:text-cyan-400">NovaScalper</strong> repeats{" "}
        <strong>enter → exit</strong> on Blofin futures using your prices. Exits use{" "}
        <strong>close position</strong> when price crosses your exit target (TP orders optional).{" "}
        <strong>Entry, exit, and stop</strong> are in the contract quote ({priceQuote}) — same units as Blofin mark for{" "}
        <span className="font-mono text-xs">{displayInstId || "…"}</span>.
      </p>

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
          <p className="text-sm text-muted-foreground">
            VIP and on-demand: save keys here so NovaScalper uses your account (encrypted; used only to call Blofin).
            Server-side <code className="text-xs rounded bg-zinc-200/80 dark:bg-zinc-700/80 px-1">BLOFIN_*</code> env keys are
            used when you have nothing saved here.{" "}
            <strong className="font-medium text-foreground">Owner:</strong> you do not need to paste keys again if global env
            keys are already set—only add keys here if you want this login to trade a different Blofin account.
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">NovaScalper config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.ownerForceOff && (
            <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              NovaScalper was <strong>disabled by the owner</strong> in Admin. The switch below stays off until they enable
              you again. You can still change prices and save other settings.
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
          <p className="text-xs text-muted-foreground -mt-2">
            Enabled means NovaScalper is allowed to trade on each <strong className="text-foreground">tick</strong> (Check
            price / Auto tick). It does not run in the background by itself while the tab is closed. Each{" "}
            <strong className="text-foreground">completed round</strong> is one full entry then exit (or stop); use{" "}
            <strong className="text-foreground">Max repeat rounds</strong> to stop after N successes (
            <strong className="text-foreground">0</strong> = keep going when flat).
          </p>

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
                placeholder="BTC/USDT or BTC/USDC"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Blofin instrument id: <span className="font-mono">{displayInstId || "—"}</span>
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

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1 text-zinc-700 dark:text-zinc-300">
          <p>
            Contract: <strong className="font-mono">{displayInstId || "—"}</strong>
          </p>
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
