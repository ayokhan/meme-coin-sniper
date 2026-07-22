"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, KeyRound } from "lucide-react";
import { FOREX_BROKER_LABELS } from "@/lib/forex-broker-user-config";

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

const BROKER_LABEL: Record<string, string> = { ...FOREX_BROKER_LABELS };

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
        u.connections.some((c) => c.broker.includes(q) || (BROKER_LABEL[c.broker] ?? "").toLowerCase().includes(q))
    );
  }, [users, search]);

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>;
  }

  return (
    <div className="max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Forex bot users
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Users who connected a Vantage Markets, TIOmarkets, or Assexmarkets MT4/MT5 account for Nova Forex Bot /
            Scalper.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {note && !users.length && <p className="text-sm text-muted-foreground">{note}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Connected accounts ({filtered.length})
          </CardTitle>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email / name / broker…"
            className="mt-2 text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 w-full max-w-sm"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users have connected a Vantage Markets, TIOmarkets, or Assexmarkets account yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Brokers</th>
                    <th className="py-2 pr-3">Forex Bot</th>
                    <th className="py-2">Scalper</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.userId} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{u.email ?? u.name ?? u.userId.slice(0, 8)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {u.isVip ? "VIP" : "non-VIP"}
                          {u.walletPreview ? ` · ${u.walletPreview}` : ""}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <ul className="space-y-1">
                          {u.connections.map((c, i) => (
                            <li key={`${c.broker}-${i}`} className="text-xs">
                              <span className="font-medium">{BROKER_LABEL[c.broker] ?? c.broker}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                · {c.platform.toUpperCase()} · {c.demoMode ? "demo" : "live"}
                                {c.provisioned ? " · MetaAPI" : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {u.novaForexBot ? (
                          <>
                            {u.novaForexBot.enabled ? "ON" : "off"} · {u.novaForexBot.symbol} · {u.novaForexBot.mode}
                            {u.novaForexBot.inPosition ? " · in pos" : ""}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 text-xs">
                        {u.novaForexScalper.slots > 0 ? (
                          <>
                            {u.novaForexScalper.slots} slot(s)
                            {u.novaForexScalper.anyEnabled ? " · ON" : " · off"}
                            {u.novaForexScalper.symbols.length
                              ? ` · ${u.novaForexScalper.symbols.join(", ")}`
                              : ""}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            <Link href="/admin" className="underline">
              Back to admin
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
