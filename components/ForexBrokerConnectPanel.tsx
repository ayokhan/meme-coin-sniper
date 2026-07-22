"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FOREX_BROKER_IDS, FOREX_BROKER_LABELS, type ForexBrokerId, type ForexBrokerPlatform } from "@/lib/forex-broker-user-config";
import { suggestedServersForBroker } from "@/lib/forex-broker-servers";
import { ForexBrokerPartnerPromoBanner } from "@/components/ForexBrokerPartnerPromoBanner";

type Connection = {
  broker: ForexBrokerId;
  platform: ForexBrokerPlatform;
  loginMasked: string;
  server: string;
  demoMode: boolean;
  metaApiAccountId: string | null;
  connected: boolean;
};

type Props = {
  /** Called after connect/disconnect/demo toggle so parent panels can refresh their broker pickers. */
  onChange?: () => void;
  compact?: boolean;
};

export default function ForexBrokerConnectPanel({ onChange, compact = false }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [metaApiConfigured, setMetaApiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBroker, setActiveBroker] = useState<ForexBrokerId>("vantage");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState({
    platform: "mt5" as ForexBrokerPlatform,
    login: "",
    password: "",
    server: "",
    demoMode: true,
  });
  const [balances, setBalances] = useState<Record<string, { balance: number; equity: number; currency: string } | null>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/forex-broker-config", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setConnections((data.connections ?? []) as Connection[]);
        setMetaApiConfigured(!!data.metaApiConfigured);
      } else setError(data.error ?? "Failed to load broker connections.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load broker connections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeConnection = connections.find((c) => c.broker === activeBroker) ?? null;

  const fetchBalance = useCallback(async (broker: ForexBrokerId) => {
    setBalanceLoading((prev) => ({ ...prev, [broker]: true }));
    try {
      const res = await fetch(`/api/user/forex-broker-config/account?broker=${broker}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.account) {
        setBalances((prev) => ({
          ...prev,
          [broker]: { balance: data.account.balance, equity: data.account.equity, currency: data.account.currency },
        }));
      } else {
        setBalances((prev) => ({ ...prev, [broker]: null }));
      }
    } catch {
      setBalances((prev) => ({ ...prev, [broker]: null }));
    } finally {
      setBalanceLoading((prev) => ({ ...prev, [broker]: false }));
    }
  }, []);

  useEffect(() => {
    if (activeConnection?.connected) void fetchBalance(activeBroker);
  }, [activeConnection?.connected, activeBroker, fetchBalance]);

  const connect = async () => {
    if (!form.login.trim() || !form.password.trim() || !form.server.trim()) {
      setError("Login, password, and server are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/user/forex-broker-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          broker: activeBroker,
          platform: form.platform,
          login: form.login.trim(),
          password: form.password,
          server: form.server.trim(),
          demoMode: form.demoMode,
          provision: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.warning ?? `${FOREX_BROKER_LABELS[activeBroker]} connected.`);
        setForm((f) => ({ ...f, password: "" }));
        await load();
        onChange?.();
      } else setError(data.error ?? "Connect failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed.");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!activeConnection) return;
    if (!window.confirm(`Disconnect ${FOREX_BROKER_LABELS[activeBroker]}? Bots using this broker will stop trading.`)) return;
    setRemoving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/user/forex-broker-config?broker=${activeBroker}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`${FOREX_BROKER_LABELS[activeBroker]} disconnected.`);
        await load();
        onChange?.();
      } else setError(data.error ?? "Disconnect failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed.");
    } finally {
      setRemoving(false);
    }
  };

  const toggleDemo = async (demoMode: boolean) => {
    if (!activeConnection) return;
    setError(null);
    try {
      const res = await fetch("/api/user/forex-broker-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ broker: activeBroker, demoMode }),
      });
      const data = await res.json();
      if (data.success) {
        await load();
        onChange?.();
      } else setError(data.error ?? "Update failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    }
  };

  const balance = balances[activeBroker];

  return (
    <Card className="border-zinc-200/80 dark:border-zinc-700/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Forex broker connection (MT4/MT5)</CardTitle>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            Connect your Vantage Markets, TIOmarkets, or Assexmarkets MT4/MT5 login so Nova Forex bots can trade on
            your account via MetaAPI. Credentials are encrypted at rest.
            Credentials are encrypted at rest.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <ForexBrokerPartnerPromoBanner broker={activeBroker} compact />

        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-600/80 w-fit">
          {FOREX_BROKER_IDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setActiveBroker(b)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                b === activeBroker
                  ? "bg-emerald-500 text-white dark:bg-emerald-600"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
              }`}
            >
              {FOREX_BROKER_LABELS[b]}
              {connections.find((c) => c.broker === b)?.connected ? " ✓" : ""}
            </button>
          ))}
        </div>

        {metaApiConfigured === false && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            MetaAPI is not configured on the server (METAAPI_TOKEN). You can still save your login, but bots cannot trade
            until the server admin sets it.
          </p>
        )}
        {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activeConnection ? (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-300/60 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-sm space-y-1.5">
              <p>
                <span className="font-medium text-foreground">{FOREX_BROKER_LABELS[activeBroker]}</span> connected —{" "}
                <span className="font-mono">{activeConnection.loginMasked}</span> on{" "}
                <span className="font-mono">{activeConnection.server}</span> ({activeConnection.platform.toUpperCase()})
              </p>
              {activeConnection.connected ? (
                balanceLoading[activeBroker] ? (
                  <p className="text-xs text-muted-foreground">Loading balance…</p>
                ) : balance ? (
                  <p className="text-sm">
                    Balance{" "}
                    <span className="font-mono font-semibold">
                      {balance.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {balance.currency}
                    </span>{" "}
                    · Equity{" "}
                    <span className="font-mono">{balance.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Balance unavailable right now.</p>
                )
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">Not provisioned on MetaAPI yet — reconnect below.</p>
              )}
              <label className="flex items-center gap-2 text-xs pt-1">
                <input
                  type="checkbox"
                  checked={activeConnection.demoMode}
                  onChange={(e) => void toggleDemo(e.target.checked)}
                />
                Demo mode
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={removing} onClick={() => void disconnect()}>
                {removing ? "Disconnecting…" : "Disconnect"}
              </Button>
              {activeConnection.connected && (
                <Button size="sm" variant="ghost" onClick={() => void fetchBalance(activeBroker)}>
                  Refresh balance
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as ForexBrokerPlatform }))}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              >
                <option value="mt5">MT5</option>
                <option value="mt4">MT4</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id={`forex-broker-demo-${activeBroker}`}
                checked={form.demoMode}
                onChange={(e) => setForm((f) => ({ ...f, demoMode: e.target.checked }))}
              />
              <label htmlFor={`forex-broker-demo-${activeBroker}`} className="text-sm">
                Demo mode
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Login (account number)</label>
              <input
                value={form.login}
                onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
                placeholder="e.g. 12345678"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Server</label>
              <input
                list={`forex-broker-servers-${activeBroker}`}
                value={form.server}
                onChange={(e) => setForm((f) => ({ ...f, server: e.target.value }))}
                placeholder={suggestedServersForBroker(activeBroker)[0] ?? "Broker-Server"}
                className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
              <datalist id={`forex-broker-servers-${activeBroker}`}>
                {suggestedServersForBroker(activeBroker).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="sm:col-span-2">
              <Button size="sm" disabled={saving} onClick={() => void connect()}>
                {saving ? "Connecting…" : `Connect ${FOREX_BROKER_LABELS[activeBroker]}`}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
