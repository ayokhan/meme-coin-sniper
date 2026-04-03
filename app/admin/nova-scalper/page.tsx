"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, RefreshCw, Activity, Ban, RotateCcw } from "lucide-react";

type ScalperAdminRow = {
  id: string;
  slot: number;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  walletPreview: string | null;
  tradingBotOnDemand: boolean;
  enabled: boolean;
  ownerForceOff: boolean;
  mode: string;
  symbol: string;
  marginCurrency: string;
  instrumentPair: string;
  instId: string;
  side: string;
  inPosition: boolean;
  completedRounds: number;
  maxRounds: number;
  lastTickAt: string | null;
  lastError: string | null;
  lastAction: string | null;
  updatedAt: string;
};

export default function AdminNovaScalperPage() {
  const { status } = useSession();
  const [configs, setConfigs] = useState<ScalperAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyConfigId, setBusyConfigId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [cronFlagOn, setCronFlagOn] = useState<boolean | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/nova-scalper/manage")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.configs)) {
          setConfigs(data.configs);
          setCronFlagOn(typeof data.novaScalperCronFlagEnabled === "boolean" ? data.novaScalperCronFlagEnabled : null);
        } else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return configs;
    return configs.filter((c) => {
      const hay = [
        c.userEmail,
        c.userName,
        c.userId,
        c.instrumentPair,
        c.instId,
        c.walletPreview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [configs, search]);

  const runTick = async (configId: string) => {
    setBusyConfigId(configId);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/nova-scalper/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tick", configId }),
      });
      const data = await res.json();
      if (data.success) {
        setFlash(data.message ?? "Tick OK.");
        load();
      } else setFlash(data.error ?? "Tick failed");
    } catch {
      setFlash("Tick failed");
    } finally {
      setBusyConfigId(null);
    }
  };

  const runReset = async (configId: string, clearRounds: boolean) => {
    if (
      !window.confirm(
        clearRounds
          ? "Reset NovaScalper state, clear round count, last ref price, and in-position flag for this user?"
          : "Reset last ref price and in-position flag for this user? (Re-primes cross detection on next tick.)"
      )
    )
      return;
    setBusyConfigId(configId);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/nova-scalper/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", configId, clearRounds }),
      });
      const data = await res.json();
      if (data.success) {
        setFlash("Reset OK.");
        load();
      } else setFlash(data.error ?? "Reset failed");
    } catch {
      setFlash("Reset failed");
    } finally {
      setBusyConfigId(null);
    }
  };

  const setEnabled = async (configId: string, enabled: boolean) => {
    if (enabled && !window.confirm("Enable NovaScalper for this user? They must still meet Blofin key rules when trading.")) return;
    setBusyConfigId(configId);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/nova-scalper/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId, enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setFlash(
          enabled
            ? "NovaScalper automation enabled for this config (column “Scalper”)."
            : "NovaScalper automation disabled for this config (column “Scalper”)."
        );
        load();
      } else setFlash(data.error ?? "Update failed");
    } catch {
      setFlash("Update failed");
    } finally {
      setBusyConfigId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/admin" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            <Zap className="h-5 w-5 text-amber-500" />
            Nova Admin
          </Link>
          <span className="text-zinc-400">/</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">NovaScalper</span>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-500" />
              NovaScalper (all users)
            </CardTitle>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Owner-only overview: each row is one scalper config (users can have several contracts). Run a tick or reset using that user&apos;s saved keys
                (owner-only env fallback rules apply). The <strong className="text-zinc-700 dark:text-zinc-300">Scalper</strong> column
                is NovaScalper on/off — not the same as the purple badge.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>
                  <strong className="text-zinc-600 dark:text-zinc-400">Scalper yes/no</strong> —{" "}
                  <code className="text-[11px]">NovaScalperConfig.enabled</code> per config (automation + optional overnight
                  server runs when the flag below is on).
                </li>
                <li>
                  <strong className="text-zinc-600 dark:text-zinc-400">Purple badge</strong> —{" "}
                  <code className="text-[11px]">Trading Bot (on-demand)</code> from Admin → Customers: access to the{" "}
                  <em>AI Trading Bot</em> tab only. Does not turn NovaScalper on.
                </li>
                <li>
                  <strong className="text-zinc-600 dark:text-zinc-400">Overnight automation</strong> — feature flag{" "}
                  <code className="text-[11px]">nova_scalper_cron</code> in Admin → Feature flags; when off, the daily server
                  job does not run NovaScalper ticks even if Scalper is yes.
                </li>
              </ul>
              {cronFlagOn !== null && (
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  NovaScalper overnight automation (feature flag):{" "}
                  <span className={cronFlagOn ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}>
                    {cronFlagOn ? "ON" : "OFF"}
                  </span>
                  {" — "}
                  <Link href="/admin/feature-flags" className="text-cyan-600 dark:text-cyan-400 underline">
                    Feature flags
                  </Link>
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="search"
                placeholder="Filter by email, user id, pair…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => load()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            {error && (
              <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/80 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
                {error}
              </div>
            )}
            {flash && (
              <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/80 dark:bg-cyan-950/40 px-3 py-2 text-sm text-cyan-900 dark:text-cyan-100">
                {flash}
              </div>
            )}
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading configs…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows match.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/80 text-left">
                      <th className="p-2 font-medium">User</th>
                      <th className="p-2 font-medium">Cfg</th>
                      <th className="p-2 font-medium">Pair</th>
                      <th className="p-2 font-medium">Mode</th>
                      <th className="p-2 font-medium">Side</th>
                      <th className="p-2 font-medium" title="NovaScalper automation (not Trading Bot on-demand)">
                        Scalper
                      </th>
                      <th className="p-2 font-medium" title="Owner disable lock: user cannot re-enable from app">
                        Lock
                      </th>
                      <th className="p-2 font-medium">Pos</th>
                      <th className="p-2 font-medium">Rounds</th>
                      <th className="p-2 font-medium">Last tick</th>
                      <th className="p-2 font-medium min-w-[140px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const uid = c.userId;
                      const busy = busyConfigId === c.id;
                      return (
                        <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                          <td className="p-2">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{c.userEmail ?? "—"}</div>
                            {c.userName && <div className="text-xs text-muted-foreground">{c.userName}</div>}
                            {c.walletPreview && <div className="text-xs font-mono text-muted-foreground">{c.walletPreview}</div>}
                            {c.tradingBotOnDemand && (
                              <span
                                className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200 max-w-[220px]"
                                title="VIP can open the AI Trading Bot tab (set in Admin → Customers). This is not NovaScalper on/off."
                              >
                                AI Trading Bot (on-demand)
                              </span>
                            )}
                            {uid && <div className="text-[10px] font-mono text-zinc-400 mt-1 break-all">{uid}</div>}
                            {!uid && <span className="text-xs text-amber-600 dark:text-amber-400">No userId</span>}
                          </td>
                          <td className="p-2 text-center font-medium">{c.slot}</td>
                          <td className="p-2 font-mono text-xs">{c.instrumentPair}</td>
                          <td className="p-2">{c.mode}</td>
                          <td className="p-2">{c.side}</td>
                          <td className="p-2">{c.enabled ? "yes" : "no"}</td>
                          <td className="p-2">{c.ownerForceOff ? "yes" : "no"}</td>
                          <td className="p-2">{c.inPosition ? "yes" : "no"}</td>
                          <td className="p-2">
                            {c.completedRounds}
                            {c.maxRounds > 0 ? ` / ${c.maxRounds}` : ""}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground max-w-[140px]">
                            {c.lastTickAt ? new Date(c.lastTickAt).toLocaleString() : "—"}
                            {c.lastError && (
                              <div className="text-rose-600 dark:text-rose-400 truncate mt-0.5" title={c.lastError}>
                                {c.lastError}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            {uid ? (
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 text-xs"
                                  disabled={busy}
                                  onClick={() => void runTick(c.id)}
                                >
                                  Run tick
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  disabled={busy}
                                  onClick={() => void runReset(c.id, false)}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Reset state
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  disabled={busy}
                                  onClick={() => void runReset(c.id, true)}
                                >
                                  Reset + rounds
                                </Button>
                                {c.enabled ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 text-xs"
                                    disabled={busy}
                                    onClick={() => void setEnabled(c.id, false)}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    Disable
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-8 text-xs"
                                    disabled={busy}
                                    onClick={() => void setEnabled(c.id, true)}
                                  >
                                    Enable
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
