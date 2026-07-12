"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, KeyRound } from "lucide-react";

type BlofinUserRow = {
  userId: string;
  email: string | null;
  name: string | null;
  walletPreview: string | null;
  blofinDemoMode: boolean;
  keysUpdatedAt: string;
  brokerId: string | null;
  isVip: boolean;
  tradingBotOnDemand: boolean;
  propFirmBotOnDemand: boolean;
  novaScalper: {
    slots: number;
    anyEnabled: boolean;
    inPosition: boolean;
    lastTickAt: string | null;
    symbols: string[];
  };
};

export default function AdminBlofinUsersPage() {
  const { status } = useSession();
  const [users, setUsers] = useState<BlofinUserRow[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/blofin-users")
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
    <div className="space-y-4 p-4 sm:p-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-cyan-500" />
            Blofin / Nova bot users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Users who saved Blofin API keys for Trading Bot, NovaScalper, Prop Firm, or NovaRadar.
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
            <p className="text-sm text-muted-foreground">No users with Blofin keys saved yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">User</th>
                    <th className="p-2 font-medium">Keys mode</th>
                    <th className="p-2 font-medium">Keys updated</th>
                    <th className="p-2 font-medium">VIP / access</th>
                    <th className="p-2 font-medium">NovaScalper</th>
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
                      <td className="p-2 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            u.blofinDemoMode
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          }`}
                        >
                          {u.blofinDemoMode ? "Demo" : "Live"}
                        </span>
                      </td>
                      <td className="p-2 align-top text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(u.keysUpdatedAt).toLocaleString()}
                      </td>
                      <td className="p-2 align-top text-xs">
                        <p>{u.isVip ? "VIP" : "Free / expired"}</p>
                        {(u.tradingBotOnDemand || u.propFirmBotOnDemand) && (
                          <p className="text-muted-foreground mt-0.5">
                            {u.tradingBotOnDemand ? "Trading Bot on-demand" : ""}
                            {u.tradingBotOnDemand && u.propFirmBotOnDemand ? " · " : ""}
                            {u.propFirmBotOnDemand ? "Prop Firm on-demand" : ""}
                          </p>
                        )}
                      </td>
                      <td className="p-2 align-top text-xs">
                        {u.novaScalper.slots === 0 ? (
                          <span className="text-muted-foreground">No scalper config</span>
                        ) : (
                          <>
                            <p>
                              {u.novaScalper.anyEnabled ? "Enabled" : "Off"}
                              {u.novaScalper.inPosition ? " · in position" : ""}
                            </p>
                            {u.novaScalper.symbols.length > 0 && (
                              <p className="font-mono text-muted-foreground">{u.novaScalper.symbols.join(", ")}</p>
                            )}
                            {u.novaScalper.lastTickAt && (
                              <p className="text-muted-foreground">
                                Last tick {new Date(u.novaScalper.lastTickAt).toLocaleString()}
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
            <Link href="/admin/nova-scalper" className="text-cyan-600 dark:text-cyan-400 hover:underline">
              NovaScalper admin
            </Link>{" "}
            for live bot ticks.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
