"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FOREX_BROKER_IDS,
  FOREX_BROKER_LABELS,
  isForexPartnerBrokerId,
  parseForexBrokerId,
  type ForexBrokerId,
  type ForexBrokerPlatform,
} from "@/lib/forex-broker-user-config";
import { suggestedServersForBroker } from "@/lib/forex-broker-servers";
import { ForexBrokerPartnerPromoBanner } from "@/components/ForexBrokerPartnerPromoBanner";
import { ForexPartnerRebateEnrollForm } from "@/components/ForexPartnerRebateEnrollForm";
import ForexBrokerAccountPanel from "@/components/ForexBrokerAccountPanel";
import { useI18n } from "@/components/I18nProvider";

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
  password: string;
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
  return `novastaris-forex-remember-v2-${broker}`;
}

function lastActiveBrokerKey() {
  return "novastaris-forex-active-broker";
}

function readLastActiveBroker(): ForexBrokerId | null {
  try {
    const raw = localStorage.getItem(lastActiveBrokerKey());
    return parseForexBrokerId(raw);
  } catch {
    return null;
  }
}

function writeLastActiveBroker(broker: ForexBrokerId) {
  try {
    localStorage.setItem(lastActiveBrokerKey(), broker);
  } catch {
    /* ignore */
  }
}

function loadRemembered(broker: ForexBrokerId): Remembered | null {
  try {
    const raw =
      localStorage.getItem(rememberKey(broker)) ??
      localStorage.getItem(`novastaris-forex-remember-${broker}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Remembered>;
    if (!parsed || typeof parsed.login !== "string") return null;
    return {
      login: parsed.login,
      password: typeof parsed.password === "string" ? parsed.password : "",
      server: typeof parsed.server === "string" ? parsed.server : "",
      platform: parsed.platform === "mt4" ? "mt4" : "mt5",
      demoMode: parsed.demoMode !== false,
    };
  } catch {
    return null;
  }
}

function saveRemembered(broker: ForexBrokerId, data: Remembered) {
  try {
    localStorage.setItem(rememberKey(broker), JSON.stringify(data));
    // Drop legacy key (no password) if present
    localStorage.removeItem(`novastaris-forex-remember-${broker}`);
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

/** Prefer last used broker, else a connected one, else keep/first enabled. */
function pickActiveBroker(
  prev: ForexBrokerId,
  enabled: ForexBrokerId[],
  connections: Connection[]
): ForexBrokerId {
  const connected = connections.filter((c) => c.connected).map((c) => c.broker);
  const stored = readLastActiveBroker();
  if (stored && enabled.includes(stored)) return stored;
  if (connected.length) {
    if (connected.includes(prev) && enabled.includes(prev)) return prev;
    const preferred = FOREX_BROKER_IDS.find((b) => connected.includes(b) && enabled.includes(b));
    if (preferred) return preferred;
  }
  if (enabled.includes(prev)) return prev;
  return enabled[0] ?? prev;
}

export default function ForexBrokerConnectPanel({ onChange, compact = false }: Props) {
  const { t } = useI18n();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [enabledBrokers, setEnabledBrokers] = useState<ForexBrokerId[]>([...FOREX_BROKER_IDS]);
  const [metaApiConfigured, setMetaApiConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBroker, setActiveBroker] = useState<ForexBrokerId>(() => readLastActiveBroker() ?? "vantage");
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
  const [balances, setBalances] = useState<Record<string, { balance: number; equity: number; currency: string; leverage?: number } | null>>({});
  const [balanceLoading, setBalanceLoading] = useState<Record<string, boolean>>({});
  const [balanceError, setBalanceError] = useState<Record<string, string | null>>({});

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
        const rows = (data.connections ?? []) as Connection[];
        setConnections(rows);
        const enabled = (data.enabledBrokers ?? FOREX_BROKER_IDS) as ForexBrokerId[];
        setEnabledBrokers(enabled);
        setMetaApiConfigured(!!data.metaApiConfigured);
        setActiveBroker((prev) => {
          const next = pickActiveBroker(prev, enabled, rows);
          writeLastActiveBroker(next);
          return next;
        });
      } else setError(data.error ?? t("forex.loadFailed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("forex.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        password: remembered.password,
        server: remembered.server,
        platform: remembered.platform,
        demoMode: remembered.demoMode,
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
      const remembered = loadRemembered(activeBroker);
      setForm((f) => ({
        ...f,
        platform: activeConnection.platform,
        login: activeConnection.login || f.login || remembered?.login || "",
        server: activeConnection.server || f.server,
        demoMode: activeConnection.demoMode,
        password: f.password || remembered?.password || "",
      }));
    }
  }, [needsReconnect, activeBroker, activeConnection?.broker, activeConnection?.server, activeConnection?.login, activeConnection?.platform, activeConnection?.demoMode]);

  const fetchBalance = useCallback(async (broker: ForexBrokerId) => {
    setBalanceLoading((prev) => ({ ...prev, [broker]: true }));
    setBalanceError((prev) => ({ ...prev, [broker]: null }));
    try {
      const res = await fetch(`/api/user/forex-broker-config/account?broker=${broker}&period=7d&wait=1`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.account) {
        setBalances((prev) => ({
          ...prev,
          [broker]: {
            balance: data.account.balance,
            equity: data.account.equity,
            currency: data.account.currency,
            leverage: data.account.leverage,
          },
        }));
      } else {
        setBalances((prev) => ({ ...prev, [broker]: null }));
        setBalanceError((prev) => ({
          ...prev,
          [broker]: data.accountError || data.error || "Balance unavailable — broker link may still be connecting.",
        }));
      }
    } catch {
      setBalances((prev) => ({ ...prev, [broker]: null }));
      setBalanceError((prev) => ({ ...prev, [broker]: "Network error loading balance." }));
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
      setError(t("forex.serverRequired"));
      return;
    }
    if (!reuse && (!form.login.trim() || !form.password.trim())) {
      setError(t("forex.credentialsRequired"));
      return;
    }
    if (reuse && !form.login.trim() && !activeConnection?.login) {
      setError(t("forex.loginRequired"));
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
          const pwd = form.password.trim() || loadRemembered(activeBroker)?.password || "";
          saveRemembered(activeBroker, {
            login: form.login.trim() || data.connection?.login || "",
            password: pwd,
            server: form.server.trim(),
            platform: form.platform,
            demoMode: form.demoMode,
          });
        } else {
          clearRemembered(activeBroker);
        }
        if (Array.isArray(data.suggestedServers)) setSuggestedServers(data.suggestedServers);
        if (data.provisionFailed || data.warning) {
          setError(data.warning ?? t("forex.provisionWarning"));
          setSuccess(null);
        } else {
          setSuccess(t("forex.connectedSuccess", { broker: FOREX_BROKER_LABELS[activeBroker] }));
        }
        writeLastActiveBroker(activeBroker);
        // Keep password in the form when remembering so Disconnect → reconnect stays filled
        setForm((f) => ({ ...f, password: rememberLogin ? f.password : "" }));
        await load();
        onChange?.();
      } else setError(data.error ?? t("forex.connectFailed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("forex.connectFailed"));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!activeConnection) return;
    if (!window.confirm(t("forex.disconnectConfirm", { broker: FOREX_BROKER_LABELS[activeBroker] }))) return;
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
        setSuccess(t("forex.disconnectedSuccess", { broker: FOREX_BROKER_LABELS[activeBroker] }));
        await load();
        onChange?.();
      } else setError(data.error ?? t("forex.disconnectFailed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("forex.disconnectFailed"));
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
          <p className="font-medium">{t("forex.reconnectTitle")}</p>
          <p>
            {t("forex.reconnectBody")}
          </p>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("common.platform")}</label>
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
          {t("common.demoMode")}
        </label>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("common.login")}</label>
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
          {needsReconnect ? t("forex.passwordOptional") : t("common.password")}
        </label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder={needsReconnect ? t("forex.passwordReusePlaceholder") : "••••••••"}
          autoComplete="current-password"
          className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{t("common.server")}</label>
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
          {t("forex.serverTip")}
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
              if (!on) {
                clearRemembered(activeBroker);
              } else if (form.login.trim() && form.password && form.server.trim()) {
                saveRemembered(activeBroker, {
                  login: form.login.trim(),
                  password: form.password,
                  server: form.server.trim(),
                  platform: form.platform,
                  demoMode: form.demoMode,
                });
              }
            }}
          />
          {t("forex.rememberLogin")}
        </label>
        {rememberLogin && (
          <p className="text-[11px] text-muted-foreground w-full">
            {t("forex.rememberHint")}
          </p>
        )}
      </div>
      <div className="sm:col-span-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={() => void connect({ reuseSavedPassword: needsReconnect })}>
          {saving
            ? t("common.connecting")
            : needsReconnect
              ? t("forex.retryBroker", { broker: FOREX_BROKER_LABELS[activeBroker] })
              : t("forex.connectBroker", { broker: FOREX_BROKER_LABELS[activeBroker] })}
        </Button>
        {needsReconnect && (
          <Button size="sm" variant="outline" disabled={removing} onClick={() => void disconnect()}>
            {removing ? t("common.disconnecting") : t("forex.disconnectClear")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="border-zinc-200/80 dark:border-zinc-700/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{t("forex.title")}</CardTitle>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            {t("forex.blurb")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {brokerTabs.length > 0 && <ForexBrokerPartnerPromoBanner broker={activeBroker} compact />}
        {brokerTabs.length > 0 && isForexPartnerBrokerId(activeBroker) && (
          <ForexPartnerRebateEnrollForm broker={activeBroker} />
        )}

        {brokerTabs.length === 0 ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t("forex.noBrokers")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-600/80 w-fit">
            {brokerTabs.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  writeLastActiveBroker(b);
                  setActiveBroker(b);
                }}
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
            {t("forex.tradingUnavailable")}
          </p>
        )}
        {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
        {error && <p className="text-sm text-rose-600 dark:text-rose-400 whitespace-pre-wrap">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
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
                <p className="text-xs text-muted-foreground">{t("forex.loadingBalance")}</p>
              ) : balance ? (
                <p className="text-sm">
                  {t("common.balance")}{" "}
                  <span className="font-mono font-semibold">
                    {balance.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {balance.currency}
                  </span>{" "}
                  · {t("common.equity")}{" "}
                  <span className="font-mono">{balance.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  {balance.leverage ? (
                    <>
                      {" "}
                      · {t("common.leverage")} <span className="font-mono">1:{balance.leverage}</span>
                    </>
                  ) : null}
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {balanceError[activeBroker] ?? t("forex.balanceUnavailable")}
                </p>
              )}
              <label className="flex items-center gap-2 text-xs pt-1">
                <input
                  type="checkbox"
                  checked={activeConnection!.demoMode}
                  onChange={(e) => void toggleDemo(e.target.checked)}
                />
                {t("common.demoMode")}
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={removing} onClick={() => void disconnect()}>
                {removing ? t("common.disconnecting") : t("common.disconnect")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void fetchBalance(activeBroker)}>
                {t("forex.refreshBalance")}
              </Button>
            </div>
            {activeConnection.connected && (
              <ForexBrokerAccountPanel
                broker={activeBroker}
                connected
                demoMode={activeConnection.demoMode}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
