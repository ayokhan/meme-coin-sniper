"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GmgnVipBotConfigView } from "@/lib/gmgn-vip-bot-config";

type SignalRow = {
  id: string;
  chain: string;
  tokenAddress: string;
  symbol: string | null;
  name: string | null;
  status: string;
  reason: string | null;
  orderId: string | null;
  createdAt: string;
};

const CHAINS = [
  { id: "sol", label: "Solana" },
  { id: "bsc", label: "BSC" },
  { id: "robinhood", label: "Robinhood" },
] as const;

export default function GmgnVipBotPanel() {
  const [config, setConfig] = useState<GmgnVipBotConfigView | null>(null);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cfgRes, sigRes] = await Promise.all([
        fetch("/api/gmgn-vip-bot/config", { cache: "no-store" }),
        fetch("/api/gmgn-vip-bot/signals", { cache: "no-store" }),
      ]);
      const cfg = await cfgRes.json();
      const sig = await sigRes.json();
      if (cfg.success) setConfig(cfg.config);
      else setError(cfg.error ?? "Failed to load config.");
      if (sig.success) setSignals(sig.signals ?? []);
    } catch {
      setError("Network error loading GMGN bot.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = async (patch: Record<string, unknown>) => {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch("/api/gmgn-vip-bot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Save failed.");
        return;
      }
      setConfig(data.config);
      setApiKey("");
      setPrivateKey("");
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(null);
    }
  };

  const runScan = async () => {
    setBusy("scan");
    setError(null);
    try {
      const res = await fetch("/api/gmgn-vip-bot/scan", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Scan failed.");
      }
      await load();
    } catch {
      setError("Scan failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleSignal = async (signalId: string, action: "approve" | "reject") => {
    setBusy(signalId);
    setError(null);
    try {
      const res = await fetch("/api/gmgn-vip-bot/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signalId, action }),
      });
      const data = await res.json();
      if (!data.success) setError(data.error ?? "Action failed.");
      await load();
    } catch {
      setError("Action failed.");
    } finally {
      setBusy(null);
    }
  };

  const testConnection = async () => {
    setBusy("test");
    setError(null);
    try {
      const res = await fetch("/api/gmgn-vip-bot/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testConnection: true }),
      });
      const data = await res.json();
      if (!data.success) setError(data.error ?? "Connection failed.");
    } catch {
      setError("Connection test failed.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading GMGN VIP Bot…
      </div>
    );
  }

  if (!config) {
    return <p className="text-sm text-red-600 dark:text-red-400 px-4">{error ?? "Unable to load bot."}</p>;
  }

  const toggleChain = (id: string) => {
    const set = new Set(config.chains);
    if (set.has(id as (typeof config.chains)[number])) set.delete(id as (typeof config.chains)[number]);
    else set.add(id as (typeof config.chains)[number]);
    void saveConfig({ chains: [...set] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-300/50 dark:border-violet-700/50 bg-gradient-to-br from-violet-50/90 to-fuchsia-50/70 dark:from-violet-950/40 dark:to-fuchsia-950/30 px-4 py-4">
        <div className="flex items-start gap-3">
          <Bot className="h-8 w-8 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">GMGN VIP Meme Bot</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Scans GMGN trending on Solana, BSC, and Robinhood. Semi-auto shows signals for your approval; auto executes
              when credentials and wallet are set. Not financial advice — meme trading is high risk.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200 flex gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bot settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span>Bot enabled</span>
              <input
                type="checkbox"
                checked={config.enabled}
                disabled={config.ownerForceOff || busy === "save"}
                onChange={(e) => void saveConfig({ enabled: e.target.checked })}
              />
            </label>

            <div>
              <p className="font-medium mb-2">Trading mode</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "semi_auto", label: "Semi-auto (approve each trade)" },
                    { id: "auto", label: "Full auto" },
                  ] as const
                ).map((m) => (
                  <Button
                    key={m.id}
                    size="sm"
                    variant={config.tradingMode === m.id ? "default" : "outline"}
                    disabled={busy === "save"}
                    onClick={() => void saveConfig({ tradingMode: m.id })}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium mb-2">Chains (GMGN)</p>
              <div className="flex flex-wrap gap-2">
                {CHAINS.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={config.chains.includes(c.id) ? "default" : "outline"}
                    disabled={busy === "save"}
                    onClick={() => toggleChain(c.id)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="font-medium">Max trade (USD est.)</span>
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
                value={config.maxTradeUsd}
                min={5}
                max={500}
                onChange={(e) => void saveConfig({ maxTradeUsd: Number(e.target.value) })}
              />
            </label>

            <label className="block">
              <span className="font-medium">Wallet address (GMGN-bound)</span>
              <input
                type="text"
                className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 font-mono text-xs"
                placeholder="Your GMGN trading wallet"
                defaultValue={config.walletAddress ?? ""}
                onBlur={(e) => void saveConfig({ walletAddress: e.target.value.trim() || null })}
              />
            </label>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void runScan()}>
                {busy === "scan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span className="ml-1">Scan now</span>
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void testConnection()}>
                Test GMGN
              </Button>
            </div>

            {config.lastError && (
              <p className="text-xs text-amber-700 dark:text-amber-300">Last run: {config.lastError}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">GMGN credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground text-xs">
              Paste from{" "}
              <a href="https://gmgn.ai/ai?tab=api_management" target="_blank" rel="noopener noreferrer" className="underline">
                GMGN API Management
              </a>
              . Stored encrypted. Owner can also use server env <code className="text-xs">GMGN_API_KEY</code>.
            </p>
            {config.apiKeyMask && (
              <p className="text-xs">
                Saved API key: <span className="font-mono">{config.apiKeyMask}</span>
              </p>
            )}
            <input
              type="password"
              placeholder="GMGN API key (gmgn_…)"
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 font-mono text-xs"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <textarea
              placeholder="GMGN private key (PEM, for trading only)"
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 font-mono text-xs min-h-[80px]"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!!busy || (!apiKey.trim() && !privateKey.trim())}
                onClick={() =>
                  void saveConfig({
                    ...(apiKey.trim() ? { gmgnApiKey: apiKey.trim() } : {}),
                    ...(privateKey.trim() ? { gmgnPrivateKey: privateKey.trim() } : {}),
                  })
                }
              >
                Save credentials
              </Button>
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void saveConfig({ clearCredentials: true })}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Signals</CardTitle>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No signals yet. Enable the bot and run Scan now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2 pr-2">Token</th>
                    <th className="py-2 pr-2">Chain</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Reason</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {signals.map((s) => (
                    <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-2 pr-2 font-medium">
                        {s.symbol ?? "?"}{" "}
                        <span className="text-xs text-muted-foreground font-normal">{s.name ?? ""}</span>
                      </td>
                      <td className="py-2 pr-2 uppercase text-xs">{s.chain}</td>
                      <td className="py-2 pr-2">
                        <span
                          className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                            s.status === "executed"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : s.status === "pending"
                                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground max-w-[200px] truncate">{s.reason ?? "—"}</td>
                      <td className="py-2">
                        {s.status === "pending" && config.tradingMode === "semi_auto" && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              disabled={busy === s.id}
                              onClick={() => void handleSignal(s.id, "approve")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={busy === s.id}
                              onClick={() => void handleSignal(s.id, "reject")}
                            >
                              Skip
                            </Button>
                          </div>
                        )}
                        {s.orderId && <span className="text-xs font-mono text-muted-foreground">{s.orderId.slice(0, 12)}…</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
