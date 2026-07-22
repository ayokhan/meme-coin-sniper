"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, KeyRound } from "lucide-react";

type ForexBotUserRow = {
  userId: string;
  email: string | null;
  name: string | null;
  walletPreview: string | null;
  isVip: boolean;
  connections: Array<{
    broker: string;
    platform: string;
    demoMode: boolean;
    provisioned: boolean;
    updatedAt: string;
  }>;
  novaForexBot: {
    enabled: boolean;
    ownerForceOff: boolean;
    symbol: string;
    mode: string;
    inPosition: boolean;
    lastRunAt: string | null;
  } | null;
  novaForexScalper: {
    slots: number;
    anyEnabled: boolean;
    inPosition: boolean;
    symbols: string[];
    lastTickAt: string | null;
  };
};

const BROKER_LABEL: Record<string, string> = {
  vantage: "Vantage",
  tiomarkets: "TIOmarkets",
};

export default function AdminForexBotUsersPage() {
  const { status } = useSession();
  const [users, setUsers] = useState<ForexBotUserRow[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/forex-bot-users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
          setNote(typeof data.note === "string" ? data.note : "");
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
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.walletPreview ?? "").toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q)
    );
  }, [users, search]);

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-500" />
            Nova Forex bot users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Users who connected a Vantage or TIOmarkets MT4/MT5 account for Nova Forex Bot / Scalper.
            Secrets are never shown.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Connected ({filtered.length}
            {search.trim() ? ` of ${users.length}` : ""})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, name, wallet…"
            className="w-full max-w-md rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          />
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users have connected a Vantage or TIOmarkets account yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">User</th>
                    <th className="p-2 font-medium">Brokers</th>
                    <th className="p-2 font-medium">VIP</th>
                    <th className="p-2 font-medium">Nova Forex Bot</th>
                    <th className="p-2 font-medium">Nova Forex Scalper</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.userId} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="p-2 align-top">
                        <p className="font-medium">{u.email ?? u.walletPreview ?? u.userId.slice(0, 8)}</p>
                        {u.name && <p className="text-xs text-muted-foreground">{u.name}</p>}
                        {u.walletPreview && u.email && (
                          <p className="text-[11px] font-mono text-muted-foreground">{u.walletPreview}</p>
                        )}
                      </td>
                      <td className="p-2 align-top text-xs space-y-1">
                        {u.connections.map((c) => (
                          <div key={c.broker} className="flex items-center gap-1.5">
                            <span className="font-medium">{BROKER_LABEL[c.broker] ?? c.broker}</span>
                            <span className="text-muted-foreground uppercase">{c.platform}</span>
                            <span
                              className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                c.demoMode
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                              }`}
                            >
                              {c.demoMode ? "Demo" : "Live"}
                            </span>
                            {c.provisioned && (
                              <span className="text-[10px] text-cyan-600 dark:text-cyan-400">MetaAPI ✓</span>
                            )}
                          </div>
                        ))}
                      </td>
                      <td className="p-2 align-top text-xs">{u.isVip ? "VIP" : "Free / expired"}</td>
                      <td className="p-2 align-top text-xs">
                        {!u.novaForexBot ? (
                          <span className="text-muted-foreground">No config</span>
                        ) : (
                          <>
                            <p>
                              {u.novaForexBot.enabled ? "Enabled" : "Off"}
                              {u.novaForexBot.ownerForceOff ? " · owner-forced off" : ""}
                              {u.novaForexBot.inPosition ? " · in position" : ""}
                            </p>
                            <p className="font-mono text-muted-foreground">
                              {u.novaForexBot.symbol} · {u.novaForexBot.mode}
                            </p>
                            {u.novaForexBot.lastRunAt && (
                              <p className="text-muted-foreground">
                                Last run {new Date(u.novaForexBot.lastRunAt).toLocaleString()}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="p-2 align-top text-xs">
                        {u.novaForexScalper.slots === 0 ? (
                          <span className="text-muted-foreground">No scalper config</span>
                        ) : (
                          <>
                            <p>
                              {u.novaForexScalper.anyEnabled ? "Enabled" : "Off"}
                              {u.novaForexScalper.inPosition ? " · in position" : ""}
                            </p>
                            {u.novaForexScalper.symbols.length > 0 && (
                              <p className="font-mono text-muted-foreground">
                                {u.novaForexScalper.symbols.join(", ")}
                              </p>
                            )}
                            {u.novaForexScalper.lastTickAt && (
                              <p className="text-muted-foreground">
                                Last tick {new Date(u.novaForexScalper.lastTickAt).toLocaleString()}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Also see{" "}
            <Link href="/admin/blofin-users" className="text-cyan-600 dark:text-cyan-400 hover:underline">
              Blofin / bot users
            </Link>{" "}
            and{" "}
            <Link href="/admin/feature-flags" className="text-cyan-600 dark:text-cyan-400 hover:underline">
              Feature flags
            </Link>{" "}
            to gate rollout.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
