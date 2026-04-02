"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, RefreshCw, Activity, Ban, RotateCcw } from "lucide-react";

type ScalperAdminRow = {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  walletPreview: string | null;
  tradingBotOnDemand: boolean;
  enabled: boolean;
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
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/nova-scalper/manage")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.configs)) setConfigs(data.configs);
        else setError(data.error ?? "Failed to load");
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

  const runTick = async (userId: string) => {
    setBusyUserId(userId);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/nova-scalper/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tick", userId }),
      });
      const data = await res.json();
      if (data.success) {
        setFlash(data.message ?? "Tick OK.");
        load();
      } else setFlash(data.error ?? "Tick failed");
    } catch {
      setFlash("Tick failed");
    } finally {
      setBusyUserId(null);
    }
  };

  const runReset = async (userId: string, clearRounds: boolean) => {
    if (!window.confirm(clearRounds ? "Reset state and clear round count for this user?" : "Reset cross reference and in-position flag?")) return;
    setBusyUserId(userId);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/nova-scalper/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", userId, clearRounds }),
      });
      const data = await res.json();
      if (data.success) {
        setFlash("Reset OK.");
        load();
      } else setFlash(data.error ?? "Reset failed");
    } catch {
      setFlash("Reset failed");
    } finally {
      setBusyUserId(null);
    }
  };

  const setEnabled = async (userId: string, enabled: boolean) => {
    if (enabled && !window.confirm("Enable NovaScalper for this user? They must still meet Blofin key rules when trading.")) return;
    setBusyUserId(userId);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/nova-scalper/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setFlash(enabled ? "Enabled." : "Disabled.");
        load();
      } else setFlash(data.error ?? "Update failed");
    } catch {
      setFlash("Update failed");
    } finally {
      setBusyUserId(null);
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
            <p className="text-sm text-muted-foreground">
              Owner-only overview: per-user Blofin scalper configs. Run a tick or reset state using the user&apos;s saved keys
              (or server env if they have none). Disabling stops automated ticks until they re-enable in the app.
            </p>
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
                      <th className="p-2 font-medium">Pair</th>
                      <th className="p-2 font-medium">Mode</th>
                      <th className="p-2 font-medium">Side</th>
                      <th className="p-2 font-medium">On</th>
                      <th className="p-2 font-medium">Pos</th>
                      <th className="p-2 font-medium">Rounds</th>
                      <th className="p-2 font-medium">Last tick</th>
                      <th className="p-2 font-medium min-w-[140px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const uid = c.userId;
                      const busy = uid != null && busyUserId === uid;
                      return (
                        <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                          <td className="p-2">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{c.userEmail ?? "—"}</div>
                            {c.userName && <div className="text-xs text-muted-foreground">{c.userName}</div>}
                            {c.walletPreview && <div className="text-xs font-mono text-muted-foreground">{c.walletPreview}</div>}
                            {c.tradingBotOnDemand && (
                              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
                                Bot on-demand
                              </span>
                            )}
                            {uid && <div className="text-[10px] font-mono text-zinc-400 mt-1 break-all">{uid}</div>}
                            {!uid && <span className="text-xs text-amber-600 dark:text-amber-400">No userId</span>}
                          </td>
                          <td className="p-2 font-mono text-xs">{c.instrumentPair}</td>
                          <td className="p-2">{c.mode}</td>
                          <td className="p-2">{c.side}</td>
                          <td className="p-2">{c.enabled ? "yes" : "no"}</td>
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
                                  onClick={() => void runTick(uid)}
                                >
                                  Run tick
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  disabled={busy}
                                  onClick={() => void runReset(uid, false)}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Reset state
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  disabled={busy}
                                  onClick={() => void runReset(uid, true)}
                                >
                                  Reset + rounds
                                </Button>
                                {c.enabled ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 text-xs"
                                    disabled={busy}
                                    onClick={() => void setEnabled(uid, false)}
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
                                    onClick={() => void setEnabled(uid, true)}
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
