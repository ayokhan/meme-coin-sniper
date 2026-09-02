"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, ExternalLink, Loader2, Play, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import MemeTokenTableActions from "@/components/MemeTokenTableActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GmgnVipBotConfigView } from "@/lib/gmgn-vip-bot-config";
import { GMGN_BOT_DISPLAY_NAME } from "@/lib/gmgn-client-types";
import { GMGN_BOT_RULES_PATH, GMGN_API_MANAGEMENT_URL, GMGN_KEY_GENERATOR_URL, validateGmgnWalletAddress, walletHintForChains } from "@/lib/gmgn-vip-bot-rules";
import { extractIpsFromGmgnBlockReason, isGmgnIpBlockReason, mergeWhitelistIps } from "@/lib/gmgn-egress-ip";

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

function analyzerChain(chain: string): "solana" | "bsc" | "robinhood" {
  if (chain === "sol") return "solana";
  if (chain === "bsc") return "bsc";
  return "robinhood";
}

function gmgnTokenUrl(chain: string, address: string): string {
  const slug = chain === "sol" ? "sol" : chain === "bsc" ? "bsc" : chain;
  return `https://gmgn.ai/${slug}/token/${encodeURIComponent(address)}`;
}

function NumField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

type SettingsDraft = {
  enabled: boolean;
  tradingMode: "semi_auto" | "auto";
  chains: string[];
  walletAddresses: string[];
};

type RulesDraft = {
  maxTradeUsd: number;
  maxOpenTrades: number;
  minLiquidityUsd: number;
  minMomentum1hPct: number;
  slippagePct: number;
  maxDailyLossUsd: number;
  stopLossPct: number;
  takeProfitPct: number;
};

function configToDrafts(c: GmgnVipBotConfigView): { settings: SettingsDraft; rules: RulesDraft } {
  return {
    settings: {
      enabled: c.enabled,
      tradingMode: c.tradingMode,
      chains: [...c.chains],
      walletAddresses: c.walletAddresses.length ? [...c.walletAddresses] : [""],
    },
    rules: {
      maxTradeUsd: c.maxTradeUsd,
      maxOpenTrades: c.maxOpenTrades,
      minLiquidityUsd: c.minLiquidityUsd,
      minMomentum1hPct: c.minMomentum1hPct,
      slippagePct: c.slippagePct,
      maxDailyLossUsd: c.maxDailyLossUsd,
      stopLossPct: c.stopLossPct,
      takeProfitPct: c.takeProfitPct,
    },
  };
}

export default function GmgnVipBotPanel() {
  const [config, setConfig] = useState<GmgnVipBotConfigView | null>(null);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [walletError, setWalletError] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [rulesDraft, setRulesDraft] = useState<RulesDraft | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [testEgressIp, setTestEgressIp] = useState<string | null>(null);

  const gmgnWhitelistIps = useMemo(
    () =>
      mergeWhitelistIps(
        signals.flatMap((s) => extractIpsFromGmgnBlockReason(s.reason)),
        testEgressIp ? [testEgressIp] : []
      ),
    [signals, testEgressIp]
  );
  const hasIpBlockFailures = useMemo(
    () => signals.some((s) => isGmgnIpBlockReason(s.reason)),
    [signals]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [cfgRes, sigRes] = await Promise.all([
        fetch("/api/gmgn-vip-bot/config", { cache: "no-store" }),
        fetch("/api/gmgn-vip-bot/signals", { cache: "no-store" }),
      ]);
      const cfg = await cfgRes.json();
      const sig = await sigRes.json();
      if (cfg.success) {
        setConfig(cfg.config);
        const drafts = configToDrafts(cfg.config);
        setSettingsDraft(drafts.settings);
        setRulesDraft(drafts.rules);
        setWalletError(null);
      } else setError(cfg.error ?? "Failed to load config.");
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
      const drafts = configToDrafts(data.config);
      setSettingsDraft(drafts.settings);
      setRulesDraft(drafts.rules);
      setApiKey("");
      setPrivateKey("");
      setSaveNotice("Settings saved.");
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async () => {
    if (!settingsDraft) return;
    const cleaned = settingsDraft.walletAddresses.map((w) => w.trim()).filter(Boolean);
    for (const w of cleaned) {
      const check = validateGmgnWalletAddress(w);
      if (!check.ok) {
        setWalletError(check.error);
        setError(check.error);
        return;
      }
    }
    setWalletError(null);
    await saveConfig({
      enabled: settingsDraft.enabled,
      tradingMode: settingsDraft.tradingMode,
      chains: settingsDraft.chains,
      walletAddresses: cleaned,
    });
  };

  const saveRules = async () => {
    if (!rulesDraft) return;
    await saveConfig({ ...rulesDraft });
    setSaveNotice("Trading rules saved.");
  };

  const runScan = async () => {
    setBusy("scan");
    setError(null);
    setScanNotice(null);
    try {
      const res = await fetch("/api/gmgn-vip-bot/scan", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Scan failed.");
      } else {
        if (typeof data.message === "string") setScanNotice(data.message);
        if (data.created > 0) setSaveNotice(`Scan complete — ${data.created} new signal(s).`);
      }
      await load();
    } catch {
      setError("Scan failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleSignal = async (signalId: string, action: "approve" | "reject" | "retry") => {
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
      else {
        const ip = typeof data.egressIp === "string" ? data.egressIp : null;
        if (ip) setTestEgressIp(ip);
        setSaveNotice(
          ip
            ? `${data.message ?? "GMGN OK."} Add ${ip} to your GMGN API key IP whitelist if trades fail.`
            : (data.message ?? "GMGN connection and signing key OK.")
        );
      }
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
        Loading {GMGN_BOT_DISPLAY_NAME}…
      </div>
    );
  }

  if (!config || !settingsDraft || !rulesDraft) {
    return <p className="text-sm text-red-600 dark:text-red-400 px-4">{error ?? "Unable to load bot."}</p>;
  }

  const toggleChain = (id: string) => {
    setSettingsDraft((d) => {
      if (!d) return d;
      const set = new Set(d.chains);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...d, chains: [...set] };
    });
  };

  const showCredentialFields = !config.credentialsFromServer || !config.hasTradeSigningKey;

  const copyWhitelistIps = () => {
    if (!gmgnWhitelistIps.length) return;
    void navigator.clipboard.writeText(gmgnWhitelistIps.join(", "));
    setSaveNotice("Copied NovaStaris IPs for GMGN whitelist.");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-300/50 dark:border-violet-700/50 bg-gradient-to-br from-violet-50/90 to-fuchsia-50/70 dark:from-violet-950/40 dark:to-fuchsia-950/30 px-4 py-4">
        <div className="flex items-start gap-3">
          <Bot className="h-8 w-8 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{GMGN_BOT_DISPLAY_NAME}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Scans GMGN trending on Solana, BSC, and Robinhood. Semi-auto shows signals for your approval; auto executes
              when credentials and wallet are set. Not financial advice — meme trading is high risk.{" "}
              <Link href={GMGN_BOT_RULES_PATH} className="text-violet-700 dark:text-violet-300 underline inline-flex items-center gap-0.5">
                Trading rules
                <ExternalLink className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>

      {saveNotice && (
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {saveNotice}
        </div>
      )}

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
                checked={settingsDraft.enabled}
                disabled={config.ownerForceOff}
                onChange={(e) => setSettingsDraft((d) => (d ? { ...d, enabled: e.target.checked } : d))}
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
                    variant={settingsDraft.tradingMode === m.id ? "default" : "outline"}
                    onClick={() => setSettingsDraft((d) => (d ? { ...d, tradingMode: m.id } : d))}
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
                    variant={settingsDraft.chains.includes(c.id) ? "default" : "outline"}
                    onClick={() => toggleChain(c.id)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-medium">Wallet addresses (GMGN-bound)</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() =>
                    setSettingsDraft((d) => (d ? { ...d, walletAddresses: [...d.walletAddresses, ""] } : d))
                  }
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add wallet
                </Button>
              </div>
              <div className="space-y-2">
                {settingsDraft.walletAddresses.map((wallet, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      className={`flex-1 rounded-md border bg-white dark:bg-zinc-900 px-2 py-1.5 font-mono text-xs ${
                        walletError ? "border-red-400 dark:border-red-700" : "border-zinc-300 dark:border-zinc-600"
                      }`}
                      placeholder={idx === 0 ? "Solana base58 or EVM 0x… — not your email" : "Another GMGN-bound wallet"}
                      value={wallet}
                      onChange={(e) => {
                        setSettingsDraft((d) => {
                          if (!d) return d;
                          const next = [...d.walletAddresses];
                          next[idx] = e.target.value;
                          return { ...d, walletAddresses: next };
                        });
                        if (walletError) setWalletError(null);
                      }}
                    />
                    {settingsDraft.walletAddresses.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 px-2"
                        onClick={() =>
                          setSettingsDraft((d) => {
                            if (!d) return d;
                            const next = d.walletAddresses.filter((_, i) => i !== idx);
                            return { ...d, walletAddresses: next.length ? next : [""] };
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{walletHintForChains(settingsDraft.chains)}</p>
              {walletError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{walletError}</p>}
            </div>

            <Button size="sm" disabled={busy === "save"} onClick={() => void saveSettings()}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save bot settings
            </Button>

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
            {scanNotice && (
              <p className="text-xs text-violet-800 dark:text-violet-200 bg-violet-50 dark:bg-violet-950/40 rounded-md px-3 py-2">
                {scanNotice}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trading rules (your config)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Adjust values, then click Save. Full explanation on the{" "}
              <Link href={GMGN_BOT_RULES_PATH} className="underline">
                rules page
              </Link>
              .
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumField
                label="Max trade (USD est.)"
                value={rulesDraft.maxTradeUsd}
                min={5}
                max={500}
                onChange={(v) => setRulesDraft((d) => (d ? { ...d, maxTradeUsd: v } : d))}
              />
              <NumField
                label="Max open trades"
                value={rulesDraft.maxOpenTrades}
                min={1}
                max={10}
                onChange={(v) => setRulesDraft((d) => (d ? { ...d, maxOpenTrades: v } : d))}
              />
              <NumField
                label="Min liquidity (USD)"
                value={rulesDraft.minLiquidityUsd}
                min={0}
                max={1_000_000}
                step={1000}
                onChange={(v) => setRulesDraft((d) => (d ? { ...d, minLiquidityUsd: v } : d))}
              />
              <NumField
                label="Min 1h momentum (%)"
                value={rulesDraft.minMomentum1hPct}
                min={0}
                max={100}
                step={0.5}
                onChange={(v) => setRulesDraft((d) => (d ? { ...d, minMomentum1hPct: v } : d))}
              />
              <NumField
                label="Slippage (%)"
                value={rulesDraft.slippagePct}
                min={1}
                max={50}
                onChange={(v) => setRulesDraft((d) => (d ? { ...d, slippagePct: v } : d))}
              />
              <NumField
                label="Max daily loss (USD)"
                value={rulesDraft.maxDailyLossUsd}
                min={10}
                max={10_000}
                onChange={(v) => setRulesDraft((d) => (d ? { ...d, maxDailyLossUsd: v } : d))}
              />
              <NumField
                label="Stop loss (%)"
                value={rulesDraft.stopLossPct}
                min={5}
                max={90}
                onChange={(v) => setRulesDraft((d) => (d ? { ...d, stopLossPct: v } : d))}
              />
              <NumField
                label="Take profit (%)"
                value={rulesDraft.takeProfitPct}
                min={10}
                max={500}
                onChange={(v) => setRulesDraft((d) => (d ? { ...d, takeProfitPct: v } : d))}
              />
            </div>
            <Button size="sm" disabled={busy === "save"} onClick={() => void saveRules()}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save trading rules
            </Button>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Stop loss, take profit, and max daily loss are saved now; automated exits are planned in a future update.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">GMGN credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <details className="rounded-md border border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/30 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium text-cyan-900 dark:text-cyan-100">
              Fixed IP for GMGN trades (~$5/mo VPS — no Vercel Pro)
            </summary>
            <ol className="mt-2 list-decimal pl-4 space-y-1.5 text-muted-foreground">
              <li>
                Create a small Ubuntu VPS (DigitalOcean $6, Hetzner ~€4, etc.) — note its <strong>public IP</strong>.
              </li>
              <li>
                SSH in and run:{" "}
                <code className="font-mono text-[10px] break-all">
                  curl -fsSL https://raw.githubusercontent.com/ayokhan/meme-coin-sniper/main/scripts/setup-gmgn-egress-proxy.sh | sudo bash
                </code>
              </li>
              <li>Copy the <code className="font-mono">GMGN_HTTPS_PROXY=…</code> line into Vercel → Settings → Environment Variables → Production.</li>
              <li>Redeploy novastaris.ai, then whitelist <strong>only that VPS IP</strong> in GMGN Trusted IP (one IP, done).</li>
              <li>Click <strong>Test GMGN</strong> — should show the VPS IP, not rotating Vercel IPs.</li>
            </ol>
          </details>

          {config.gmgnProxyConfigured && (
            <p className="text-xs text-cyan-800 dark:text-cyan-200 bg-cyan-50 dark:bg-cyan-950/40 rounded-md px-3 py-2">
              GMGN fixed-egress proxy is active. Whitelist only the proxy VPS IP in GMGN.
            </p>
          )}

          <details className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
              How to generate GMGN API + private key (Windows)
            </summary>
            <ol className="mt-2 list-decimal pl-4 space-y-1.5 text-muted-foreground">
              <li>
                Open the{" "}
                <a href={GMGN_KEY_GENERATOR_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  Binance Key Pair Generator
                </a>{" "}
                — keep <strong>Ed25519</strong> selected.
              </li>
              <li>
                Click <strong>Generate 1 Key Pair</strong>. Both boxes fill with keys.
              </li>
              <li>
                Click <strong>SAVE PAIR</strong> and store the files safely (you need the private file for trading).
              </li>
              <li>
                Click <strong>COPY</strong> under <strong>Public Key</strong> (whole block, including BEGIN/END lines).
              </li>
              <li>
                Register the public key at{" "}
                <a href={GMGN_API_MANAGEMENT_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  GMGN API Management
                </a>{" "}
                and copy the <code className="font-mono">gmgn_…</code> API key.
              </li>
              <li>
                Paste the <strong>private key</strong> (left box or saved file — <code className="font-mono">BEGIN PRIVATE KEY</code>, not
                public) and the <code className="font-mono">gmgn_…</code> key below, then Save credentials.
              </li>
              <li>Click <strong>Test GMGN</strong> — must say signing key OK before Approve on signals.</li>
            </ol>
            <p className="mt-2 text-muted-foreground">
              For GMGN Trusted IP: use the <strong>Fixed IP VPS</strong> guide above (recommended), or copy blocked IPs from
              the signals banner.
            </p>
          </details>

          {config.credentialsFromServer ? (
            <>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded-md px-3 py-2">
                GMGN API key is active for your account.{" "}
                {config.hasTradeSigningKey
                  ? "Add your GMGN-bound wallet address(es) above to trade."
                  : "Paste your private key below (from the key generator) plus your EVM wallet to execute swaps."}
              </p>
              {!config.hasTradeSigningKey && (
                <>
                  <textarea
                    placeholder={"-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIE…\n-----END PRIVATE KEY-----\n\nFrom the LEFT box or SAVE PAIR file — not the public key."}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 font-mono text-xs min-h-[100px]"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!!busy || !privateKey.trim()}
                    onClick={() => void saveConfig({ gmgnPrivateKey: privateKey.trim() })}
                  >
                    Save private key
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-xs">
                Paste from{" "}
                <a href={GMGN_API_MANAGEMENT_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  GMGN API Management
                </a>
                . Stored encrypted on NovaStaris.
              </p>
              {config.apiKeyMask && (
                <p className="text-xs">
                  Saved API key: <span className="font-mono">{config.apiKeyMask}</span>
                </p>
              )}
              {showCredentialFields && (
                <>
                  <input
                    type="password"
                    placeholder="GMGN API key (gmgn_…)"
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 font-mono text-xs"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <textarea
                    placeholder={"-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIE…\n-----END PRIVATE KEY-----\n\nNOT the public key (BEGIN PUBLIC KEY). From the key pair you saved when creating the GMGN API key."}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 font-mono text-xs min-h-[100px]"
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void saveConfig({ clearCredentials: true })}
                    >
                      Clear
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
          {(config.hasCredentials || showCredentialFields) && (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void testConnection()}>
              Test GMGN
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Signals</CardTitle>
        </CardHeader>
        <CardContent>
          {hasIpBlockFailures && !config.gmgnProxyConfigured && gmgnWhitelistIps.length > 0 && (
            <div className="text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 mb-3 space-y-2">
              <p className="font-medium">Add to GMGN Trusted IP (max 5):</p>
              <p className="font-mono text-xs break-all">{gmgnWhitelistIps.join(", ")}</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => copyWhitelistIps()}>
                Copy IPs for GMGN
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground mb-3">
            <strong>Workflow:</strong> Scan → review signal → <strong>Copy ID</strong> / <strong>Analyze</strong> →{" "}
            <strong>Approve</strong> sends a market buy via GMGN (~your max trade size, with your slippage %). Not a limit
            order — check the chart first if you want a better entry.
          </p>
          {scanNotice && (
            <p className="text-sm text-violet-800 dark:text-violet-200 bg-violet-50 dark:bg-violet-950/40 rounded-md px-3 py-2 mb-3">
              Last scan: {scanNotice}
            </p>
          )}
          {!scanNotice && config.lastError && (
            <p className="text-sm text-violet-800 dark:text-violet-200 bg-violet-50 dark:bg-violet-950/40 rounded-md px-3 py-2 mb-3">
              Last scan: {config.lastError}
            </p>
          )}
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No signals yet. Run Scan now — enable Solana and/or BSC for best results. If scan says tokens were filtered,
              lower min liquidity or min 1h momentum in trading rules and save.
            </p>
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
                        <div className="flex flex-col gap-1">
                          <span>
                            {s.symbol ?? "?"}{" "}
                            <span className="text-xs text-muted-foreground font-normal">{s.name ?? ""}</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            <MemeTokenTableActions
                              contractAddress={s.tokenAddress}
                              chain={analyzerChain(s.chain)}
                            />
                            <a
                              href={gmgnTokenUrl(s.chain, s.tokenAddress)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              GMGN
                            </a>
                          </div>
                        </div>
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
                        {s.status === "failed" && isGmgnIpBlockReason(s.reason) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={busy === s.id}
                            onClick={() => void handleSignal(s.id, "retry")}
                          >
                            Retry
                          </Button>
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
