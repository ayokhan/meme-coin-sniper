"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FOREX_BROKER_IDS,
  FOREX_BROKER_LABELS,
  type ForexBrokerId,
  type ForexBrokerPlatform,
} from "@/lib/forex-broker-user-config";
import { suggestedServersForBroker } from "@/lib/forex-broker-servers";
import { ForexBrokerPartnerPromoBanner } from "@/components/ForexBrokerPartnerPromoBanner";

type Connection = {
  broker: ForexBrokerId;
  platform: ForexBrokerPlatform;
  loginMasked: string;
  login?: string;
  server: string;
  demoMode: boolean;
  metaApiAccountId: string | null;
  connected: boolean;
};

type Remembered = {
  login: string;
  server: string;
  platform: ForexBrokerPlatform;
  demoMode: boolean;
};

type Props = {
  /** Called after connect/disconnect/demo toggle so parent panels can refresh their broker pickers. */
  onChange?: () => void;
  compact?: boolean;
};

function rememberKey(broker: ForexBrokerId) {
  return `novastaris-forex-remember-${broker}`;
}

function loadRemembered(broker: ForexBrokerId): Remembered | null {
  try {
    const raw = localStorage.getItem(rememberKey(broker));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Remembered;
    if (!parsed || typeof parsed.login !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveRemembered(broker: ForexBrokerId, data: Remembered) {
  try {
    localStorage.setItem(rememberKey(broker), JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

function clearRemembered(broker: ForexBrokerId) {
  try {
    localStorage.removeItem(rememberKey(broker));
  } catch {
    /* ignore */
  }
}

export default function ForexBrokerConnectPanel({ onChange, compact = false }: Props) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [enabledBrokers, setEnabledBrokers] = useState<ForexBrokerId[]>([...FOREX_BROKER_IDS]);
  const [metaApiConfigured, setMetaApiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBroker, setActiveBroker] = useState<ForexBrokerId>("vantage");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestedServers, setSuggestedServers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(true);
  const [form, setForm] = useState({
    platform: "mt5" as ForexBrokerPlatform,
    login: "",
    password: "",
    server: "",
    demoMode: true,
  });
  const [balances, setBalances] = useState<Record<string, { balance: number; equity: number; currency: string } | null>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>({});

  const brokerTabs = useMemo(
    () => FOREX_BROKER_IDS.filter((b) => enabledBrokers.includes(b)),
    [enabledBrokers]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/forex-broker-config", { credentials: "include", cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setConnections((data.connections ?? []) as Connection[]);
        const enabled = (data.enabledBrokers ?? FOREX_BROKER_IDS) as ForexBrokerId[];
        setEnabledBrokers(enabled);
        setMetaApiConfigured(!!data.metaApiConfigured);
        setActiveBroker((prev) => (enabled.length && !enabled.includes(prev) ? enabled[0] : prev));
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

  /** Prefill form from localStorage when switching brokers (if remember is on). */
  useEffect(() => {
    const remembered = loadRemembered(activeBroker);
    setRememberLogin(!!remembered);
    if (remembered) {
      setForm((f) => ({
        ...f,
        login: remembered.login,
        server: remembered.server,
        platform: remembered.platform,
        demoMode: remembered.demoMode,
        password: "",
      }));
    } else {
      setForm({
        platform: "mt5",
        login: "",
        password: "",
        server: "",
        demoMode: true,
      });
    }
    setSuggestedServers([]);
    setError(null);
    setSuccess(null);
  }, [activeBroker]);

  const activeConnection = connections.find((c) => c.broker === activeBroker) ?? null;
  /** Saved but MetaAPI failed — show reconnect form instead of a dead-end card. */
  const needsReconnect = !!activeConnection && !activeConnection.connected;

  useEffect(() => {
    if (needsReconnect && activeConnection) {
      setForm((f) => ({
        ...f,
        platform: activeConnection.platform,
        login: activeConnection.login || f.login || "",
        server: activeConnection.server || f.server,
        demoMode: activeConnection.demoMode,
        password: "",
      }));
    }
  }, [needsReconnect, activeConnection?.broker, activeConnection?.server, activeConnection?.login, activeConnection?.platform, activeConnection?.demoMode]);

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

  const serverHints = useMemo(() => {
    const base = suggestedServersForBroker(activeBroker);
    const extra = suggestedServers.filter((s) => !base.includes(s));
    return [...extra, ...base];
  }, [activeBroker, suggestedServers]);

  const connect = async (opts?: { reuseSavedPassword?: boolean }) => {
    const reuse = opts?.reuseSavedPassword === true || (needsReconnect && !form.password.trim());
    if (!form.server.trim()) {
      setError("Server is required. Use the exact name from your MT4/MT5 terminal.");
      return;
    }
    if (!reuse && (!form.login.trim() || !form.password.trim())) {
      setError("Login, password, and server are required.");
      return;
    }
    if (reuse && !form.login.trim() && !activeConnection?.login) {
      setError("Login is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    setSuggestedServers([]);
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
          reuseSavedPassword: reuse,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (rememberLogin) {
          saveRemembered(activeBroker, {
            login: form.login.trim() || data.connection?.login || "",
            server: form.server.trim(),
            platform: form.platform,
            demoMode: form.demoMode,
          });
        } else {
          clearRemembered(activeBroker);
        }
        if (Array.isArray(data.suggestedServers)) setSuggestedServers(data.suggestedServers);
        if (data.provisionFailed || data.warning) {
          setError(data.warning ?? "Saved, but MetaAPI could not connect. Fix the server name and retry.");
          setSuccess(null);
        } else {
          setSuccess(`${FOREX_BROKER_LABELS[activeBroker]} connected.`);
        }
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
  const showForm = !activeConnection || needsReconnect;

  const formFields = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {needsReconnect && (
        <div className="sm:col-span-2 rounded-md border border-amber-300/70 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-medium">Saved, but not linked on MetaAPI yet</p>
          <p>
            MetaAPI needs the <span className="font-semibold">exact</span> server name from your MT4/MT5 terminal (e.g.{" "}
            <span className="font-mono">TIOMarkets-Live1</span>). Fix the server below and retry — leave password blank to
            reuse your saved password.
          </p>
        </div>
      )}
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
          autoComplete="username"
          className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          Password{needsReconnect ? " (optional — reuse saved)" : ""}
        </label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder={needsReconnect ? "Leave blank to reuse saved" : "••••••••"}
          autoComplete="current-password"
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
          className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm font-mono"
        />
        <datalist id={`forex-broker-servers-${activeBroker}`}>
          {serverHints.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {serverHints.slice(0, 10).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setForm((f) => ({ ...f, server: s }))}
              className={`rounded-md border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                form.server === s
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
                  : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Tip: In MT5 open your account in Navigator — the server name must match character-for-character (including{" "}
          <span className="font-mono">Live1</span> vs <span className="font-mono">Live</span>).
        </p>
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rememberLogin}
            onChange={(e) => {
              const on = e.target.checked;
              setRememberLogin(on);
              if (!on) clearRemembered(activeBroker);
            }}
          />
          Remember login details on this device
        </label>
      </div>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={() => void connect({ reuseSavedPassword: needsReconnect })}>
          {saving
            ? "Connecting…"
            : needsReconnect
              ? `Retry ${FOREX_BROKER_LABELS[activeBroker]}`
              : `Connect ${FOREX_BROKER_LABELS[activeBroker]}`}
        </Button>
        {needsReconnect && (
          <Button size="sm" variant="outline" disabled={removing} onClick={() => void disconnect()}>
            {removing ? "Disconnecting…" : "Disconnect / clear"}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="border-zinc-200/80 dark:border-zinc-700/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Forex broker connection (MT4/MT5)</CardTitle>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            Connect your broker MT4/MT5 login so Nova Forex bots can trade on your account via MetaAPI. Credentials are
            encrypted at rest. Available brokers are controlled by the site admin.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {brokerTabs.length > 0 && <ForexBrokerPartnerPromoBanner broker={activeBroker} compact />}

        {brokerTabs.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            No forex brokers are enabled right now. Ask the site owner to turn one on in Admin → Feature flags.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-600/80 w-fit">
            {brokerTabs.map((b) => (
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
        )}

        {metaApiConfigured === false && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            MetaAPI is not configured on the server (METAAPI_TOKEN). You can still save your login, but bots cannot trade
            until the server admin sets it.
          </p>
        )}
        {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400 whitespace-pre-wrap">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : brokerTabs.length === 0 ? null : showForm ? (
          formFields
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-300/60 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-sm space-y-1.5">
              <p>
                <span className="font-medium text-foreground">{FOREX_BROKER_LABELS[activeBroker]}</span> connected —{" "}
                <span className="font-mono">{activeConnection!.loginMasked}</span> on{" "}
                <span className="font-mono">{activeConnection!.server}</span> ({activeConnection!.platform.toUpperCase()})
              </p>
              {balanceLoading[activeBroker] ? (
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
              )}
              <label className="flex items-center gap-2 text-xs pt-1">
                <input
                  type="checkbox"
                  checked={activeConnection!.demoMode}
                  onChange={(e) => void toggleDemo(e.target.checked)}
                />
                Demo mode
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={removing} onClick={() => void disconnect()}>
                {removing ? "Disconnecting…" : "Disconnect"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void fetchBalance(activeBroker)}>
                Refresh balance
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
