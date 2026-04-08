"use client";

import { useCallback, useEffect, useState } from "react";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";

const LS_KEY = "novastaris_nova_ultimate_meme_v1";
const LS_PERPS_KEY = "novastaris_nova_ultimate_perps_v1";
const DEFAULT_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

export type MemeStrategyPreset = "aggressive" | "snipe" | "low_risk" | "medium_risk" | "custom";

export type MemeSniperConfig = {
  preset: MemeStrategyPreset;
  mode: "demo" | "live";
  maxEntrySol: string;
  slippageBps: string;
  takeProfitPct: string;
  stopLossPct: string;
  maxOpenPositions: string;
  minLiquidityUsd: string;
  maxTokenAgeMins: string;
  snipeNewLaunches: boolean;
  copyLeaderWallets: string;
  copyMirrorEntry: boolean;
  /** When copy mirroring is connected server-side: auto-submit swaps vs queue for Phantom approval. */
  copyEntryMode: "auto_snipe" | "manual_approve";
  copyExitStrategy: "fixed_tp" | "before_leader_sells";
  copyTakeProfitPct: string;
  copyFrontRunMinProfitPct: string;
};

type PhantomSolana = {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58: () => string } }>;
  disconnect?: () => Promise<void>;
  publicKey?: { toBase58: () => string };
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};

function getPhantomProvider(): PhantomSolana | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { solana?: PhantomSolana };
  const p = w.solana;
  if (p?.isPhantom || (p && "signTransaction" in p)) return p;
  return null;
}

function b64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const DEFAULT_MEME: MemeSniperConfig = {
  preset: "medium_risk",
  mode: "live",
  maxEntrySol: "0.25",
  slippageBps: "800",
  takeProfitPct: "35",
  stopLossPct: "18",
  maxOpenPositions: "4",
  minLiquidityUsd: "12000",
  maxTokenAgeMins: "45",
  snipeNewLaunches: true,
  copyLeaderWallets: "",
  copyMirrorEntry: true,
  copyEntryMode: "manual_approve",
  copyExitStrategy: "before_leader_sells",
  copyTakeProfitPct: "25",
  copyFrontRunMinProfitPct: "12",
};

function applyPreset(preset: MemeStrategyPreset): Partial<MemeSniperConfig> {
  switch (preset) {
    case "aggressive":
      return {
        maxEntrySol: "0.55",
        slippageBps: "1500",
        takeProfitPct: "80",
        stopLossPct: "28",
        maxOpenPositions: "6",
        minLiquidityUsd: "6000",
        maxTokenAgeMins: "90",
        snipeNewLaunches: true,
      };
    case "snipe":
      return {
        maxEntrySol: "0.12",
        slippageBps: "2000",
        takeProfitPct: "15",
        stopLossPct: "10",
        maxOpenPositions: "8",
        minLiquidityUsd: "8000",
        maxTokenAgeMins: "12",
        snipeNewLaunches: true,
      };
    case "low_risk":
      return {
        maxEntrySol: "0.1",
        slippageBps: "500",
        takeProfitPct: "22",
        stopLossPct: "12",
        maxOpenPositions: "3",
        minLiquidityUsd: "35000",
        maxTokenAgeMins: "30",
        snipeNewLaunches: false,
      };
    case "medium_risk":
      return {
        maxEntrySol: "0.25",
        slippageBps: "800",
        takeProfitPct: "35",
        stopLossPct: "18",
        maxOpenPositions: "4",
        minLiquidityUsd: "12000",
        maxTokenAgeMins: "45",
        snipeNewLaunches: true,
      };
    default:
      return {};
  }
}

type PerpsPrefs = {
  watchlist: string;
  riskNote: string;
  defaultSizeUsd: string;
};

const DEFAULT_PERPS: PerpsPrefs = {
  watchlist: "BTC-PERP, SOL-PERP, ETH-PERP",
  riskNote: "Reduce size into news; perps can liquidate quickly.",
  defaultSizeUsd: "100",
};

export default function NovaUltimatePanel({ solanaWalletShort }: { solanaWalletShort?: string | null }) {
  const [ultimateSub, setUltimateSub] = useState<"meme" | "perps">("meme");
  const [meme, setMeme] = useState<MemeSniperConfig>(DEFAULT_MEME);
  const [perps, setPerps] = useState<PerpsPrefs>(DEFAULT_PERPS);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [snipeMint, setSnipeMint] = useState("");
  const [phantomPk, setPhantomPk] = useState<string | null>(null);
  const [quoteResponse, setQuoteResponse] = useState<unknown | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MemeSniperConfig;
        setMeme({ ...DEFAULT_MEME, ...parsed });
      }
      const pr = localStorage.getItem(LS_PERPS_KEY);
      if (pr) setPerps({ ...DEFAULT_PERPS, ...JSON.parse(pr) });
    } catch {
      /* ignore */
    }
  }, []);

  const saveLocal = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(meme));
      localStorage.setItem(LS_PERPS_KEY, JSON.stringify(perps));
      setSavedAt(new Date().toISOString());
    } catch {
      /* ignore */
    }
  }, [meme, perps]);

  const setPreset = (preset: MemeStrategyPreset) => {
    const patch = applyPreset(preset);
    setMeme((m) => ({ ...m, preset, ...patch }));
  };

  const connectPhantomForSnipe = async () => {
    const p = getPhantomProvider();
    if (!p) {
      setLiveStatus("Install Phantom and use this page in a desktop browser where Phantom is available.");
      return;
    }
    try {
      const r = await p.connect();
      setPhantomPk(r.publicKey.toBase58());
      setLiveStatus(null);
    } catch {
      setLiveStatus("Phantom connection was rejected.");
    }
  };

  const fetchLiveQuote = async () => {
    setLiveStatus(null);
    setQuoteResponse(null);
    if (!snipeMint.trim()) {
      setLiveStatus("Enter a token mint to snipe.");
      return;
    }
    setLiveBusy(true);
    try {
      const res = await fetch("/api/nova-ultimate/jupiter-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          tokenMint: snipeMint.trim(),
          amountSol: Number(meme.maxEntrySol),
          direction: "buy",
          slippageBps: Number(meme.slippageBps) || 800,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.quoteResponse) {
        setLiveStatus(data.error ?? "Could not build quote.");
        return;
      }
      setQuoteResponse(data.quoteResponse);
      setLiveStatus("Quote ready. Review in Phantom, then sign & send.");
    } catch {
      setLiveStatus("Quote request failed.");
    } finally {
      setLiveBusy(false);
    }
  };

  const signAndSendSnipe = async () => {
    if (!quoteResponse) {
      setLiveStatus("Get a quote first.");
      return;
    }
    const p = getPhantomProvider();
    if (!p?.publicKey) {
      setLiveStatus("Connect Phantom first.");
      return;
    }
    setLiveBusy(true);
    setLiveStatus(null);
    try {
      const pubkey = p.publicKey.toBase58();
      const swapRes = await fetch("/api/nova-ultimate/jupiter-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ quoteResponse, userPublicKey: pubkey }),
      });
      const swapJson = await swapRes.json().catch(() => ({}));
      if (!swapRes.ok || !swapJson.success || !swapJson.swapTransaction) {
        setLiveStatus(swapJson.error ?? "Could not build swap transaction.");
        return;
      }
      const vtx = VersionedTransaction.deserialize(b64ToUint8Array(swapJson.swapTransaction));
      const signed = await p.signTransaction(vtx);
      const conn = new Connection(DEFAULT_RPC, "confirmed");
      const sig = await conn.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      setLiveStatus(`Broadcast submitted. Signature: ${sig} — track in Phantom or Solana explorer.`);
      setQuoteResponse(null);
    } catch (e) {
      setLiveStatus(e instanceof Error ? e.message : "Sign or send failed. Reject in wallet is OK if you changed your mind.");
    } finally {
      setLiveBusy(false);
    }
  };

  const tabHot =
    "rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600 inline-flex items-center gap-1.5";

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <Flame className="h-8 w-8 text-amber-500 shrink-0 mt-0.5 animate-flame-flicker" aria-hidden />
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
            Nova Ultimate
            <Badge className="bg-amber-500/90 text-white border-0">Live-ready</Badge>
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Meme sniping via Jupiter with Phantom signatures and Phantom Perps playbooks. Full auto-scan (discover + buy without you pasting a mint) is not wired in this app yet—use live snipe with a mint, or copy-trading settings below for when automation is connected.
          </p>
        </div>
      </div>

      <Tabs value={ultimateSub} onValueChange={(v) => setUltimateSub(v as "meme" | "perps")} className="space-y-4">
        <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 p-1 rounded-lg h-auto flex-wrap">
          <TabsTrigger value="meme" className={tabHot}>
            <Flame className="h-4 w-4 shrink-0 animate-flame-flicker" aria-hidden />
            NovaMeme Sniper
          </TabsTrigger>
          <TabsTrigger value="perps" className={tabHot}>
            <Flame className="h-4 w-4 shrink-0 animate-flame-flicker" aria-hidden />
            Phantom Perps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meme" className="mt-0 space-y-4">
          <Card className="border-zinc-200/80 dark:border-zinc-700/80 border-amber-200/60 dark:border-amber-900/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                Live snipe (SOL → token)
                <Badge variant="outline" className="font-normal">
                  Jupiter + Phantom
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Uses your saved <strong>max entry (SOL)</strong> and <strong>slippage (bps)</strong> from the template below. Flow: quote → Phantom signs → broadcast to RPC{" "}
                {DEFAULT_RPC.slice(0, 28)}…
              </p>
              <p className="text-xs text-amber-800/90 dark:text-amber-200/85 rounded-md border border-amber-200/60 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/25 px-2 py-1.5">
                <strong>Snipe mode</strong> in templates only adjusts risk numbers. It does <strong>not</strong> run a background scanner—NovaStaris would need a chain/indexer worker plus signing policy (Phantom popup vs custodial) to buy new launches by itself.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Token mint</label>
                  <input
                    value={snipeMint}
                    onChange={(e) => setSnipeMint(e.target.value.trim())}
                    placeholder="Pump / SPL mint address"
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-xs font-mono"
                  />
                </div>
                <div className="flex items-end gap-2 flex-wrap">
                  <Button type="button" size="sm" variant="secondary" onClick={connectPhantomForSnipe} disabled={liveBusy}>
                    {phantomPk ? `Phantom: ${phantomPk.slice(0, 4)}…${phantomPk.slice(-4)}` : "Connect Phantom"}
                  </Button>
                  {phantomPk && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void getPhantomProvider()?.disconnect?.();
                        setPhantomPk(null);
                      }}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={fetchLiveQuote} disabled={liveBusy || meme.mode !== "live"}>
                  {liveBusy ? "Working…" : "Get live quote"}
                </Button>
                <Button type="button" size="sm" variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={signAndSendSnipe} disabled={liveBusy || !quoteResponse || meme.mode !== "live"}>
                  Sign &amp; send snipe
                </Button>
              </div>
              {meme.mode !== "live" && <p className="text-xs text-amber-800 dark:text-amber-200">Switch execution mode to <strong>Live</strong> below to enable on-chain snipe.</p>}
              {liveStatus && <p className="text-xs text-zinc-700 dark:text-zinc-300">{liveStatus}</p>}
              {!!quoteResponse && meme.mode === "live" && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">Quote loaded. Approve the transaction carefully in Phantom.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200/80 dark:border-zinc-700/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                NovaMeme Sniper
                <Badge variant="outline" className="font-normal">
                  Nova AI Sniper
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Templates tune size, slippage, and risk for volatile launches. Manual fields override presets when you need full control.
                <span className="block mt-2 text-amber-800 dark:text-amber-200/90">
                  Live swaps spend real SOL; slippage and liquidity risk can cause partial fills or loss. Demo mode disables broadcasting.
                </span>
              </p>

              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Strategy template</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["aggressive", "Aggressive", "Larger size & slippage tolerance; higher reward and drawdown risk."],
                      ["snipe", "Snipe mode", "Fresh launches: tighter time window, smaller targets, faster rotation."],
                      ["low_risk", "Conservative", "Smaller size, stricter liquidity, fewer concurrent positions."],
                      ["medium_risk", "Balanced", "Default blend of size, slippage, and hold assumptions."],
                      ["custom", "Custom / manual", "Your numbers only—presets stop overriding when you edit below."],
                    ] as const
                  ).map(([key, label, hint]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPreset(key)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs max-w-[200px] transition-colors ${
                        meme.preset === key
                          ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 text-zinc-900 dark:text-zinc-100"
                          : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-cyan-300 dark:hover:border-cyan-700"
                      }`}
                      title={hint}
                    >
                      <span className="font-semibold block">{label}</span>
                      <span className="text-[10px] text-muted-foreground line-clamp-2">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Execution mode</label>
                  <select
                    value={meme.mode}
                    onChange={(e) => setMeme((m) => ({ ...m, mode: e.target.value as "demo" | "live" }))}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  >
                    <option value="demo">Demo (no broadcast)</option>
                    <option value="live">Live (Phantom signs real swaps)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Max entry (SOL / order)</label>
                  <input
                    type="text"
                    value={meme.maxEntrySol}
                    onChange={(e) => setMeme((m) => ({ ...m, maxEntrySol: e.target.value, preset: "custom" }))}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Slippage (basis points)</label>
                  <input
                    type="text"
                    value={meme.slippageBps}
                    onChange={(e) => setMeme((m) => ({ ...m, slippageBps: e.target.value, preset: "custom" }))}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Take profit target (%)</label>
                  <input
                    type="text"
                    value={meme.takeProfitPct}
                    onChange={(e) => setMeme((m) => ({ ...m, takeProfitPct: e.target.value, preset: "custom" }))}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Stop loss (%)</label>
                  <input
                    type="text"
                    value={meme.stopLossPct}
                    onChange={(e) => setMeme((m) => ({ ...m, stopLossPct: e.target.value, preset: "custom" }))}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Max open positions</label>
                  <input
                    type="text"
                    value={meme.maxOpenPositions}
                    onChange={(e) => setMeme((m) => ({ ...m, maxOpenPositions: e.target.value, preset: "custom" }))}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Min liquidity (USD)</label>
                  <input
                    type="text"
                    value={meme.minLiquidityUsd}
                    onChange={(e) => setMeme((m) => ({ ...m, minLiquidityUsd: e.target.value, preset: "custom" }))}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Max token age (minutes)</label>
                  <input
                    type="text"
                    value={meme.maxTokenAgeMins}
                    onChange={(e) => setMeme((m) => ({ ...m, maxTokenAgeMins: e.target.value, preset: "custom" }))}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={meme.snipeNewLaunches}
                  onChange={(e) => setMeme((m) => ({ ...m, snipeNewLaunches: e.target.checked }))}
                  className="rounded"
                />
                Prefer newly launched pairs when rules apply (age & liquidity gates)—for future auto-watchers; does not start scanning by itself today
              </label>

              <Card className="border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30">
                <CardHeader className="py-3 pb-2">
                  <CardTitle className="text-sm font-semibold">Copy trading (tracked wallets)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-muted-foreground">
                    Configure leaders here. On-chain copy execution still needs a watcher service; these flags tell that service how to behave once it exists.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Leader wallet addresses (comma or newline)</label>
                    <textarea
                      value={meme.copyLeaderWallets}
                      onChange={(e) => setMeme((m) => ({ ...m, copyLeaderWallets: e.target.value }))}
                      rows={3}
                      placeholder="Solana public keys…"
                      className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={meme.copyMirrorEntry}
                      onChange={(e) => setMeme((m) => ({ ...m, copyMirrorEntry: e.target.checked }))}
                      className="rounded"
                    />
                    Mirror entries on leader buy signals (when automation is connected)
                  </label>
                  <div>
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Copy entry execution</p>
                    <div className="flex flex-col gap-2 text-sm">
                      <label className="inline-flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="copyEntryMode"
                          className="mt-1 rounded-full"
                          checked={meme.copyEntryMode === "manual_approve"}
                          onChange={() => setMeme((m) => ({ ...m, copyEntryMode: "manual_approve" }))}
                        />
                        <span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">Manual approval</span>
                          <span className="block text-xs text-muted-foreground">
                            Queue each copy-buy for you to confirm in Phantom (recommended). Matches today’s live snipe flow when you act on alerts.
                          </span>
                        </span>
                      </label>
                      <label className="inline-flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="copyEntryMode"
                          className="mt-1 rounded-full"
                          checked={meme.copyEntryMode === "auto_snipe"}
                          onChange={() => setMeme((m) => ({ ...m, copyEntryMode: "auto_snipe" }))}
                        />
                        <span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">Automatic snipe</span>
                          <span className="block text-xs text-muted-foreground">
                            Attempt swap as soon as the leader buy passes your gates (requires a backend signer or pre-approved automation—not available in-browser-only Phantom flows).
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Exit preference</label>
                    <select
                      value={meme.copyExitStrategy}
                      onChange={(e) =>
                        setMeme((m) => ({ ...m, copyExitStrategy: e.target.value as MemeSniperConfig["copyExitStrategy"] }))
                      }
                      className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    >
                      <option value="fixed_tp">Fixed take-profit %</option>
                      <option value="before_leader_sells">Take profit before leader exit (min profit gate)</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Copy TP (%)</label>
                      <input
                        type="text"
                        value={meme.copyTakeProfitPct}
                        onChange={(e) => setMeme((m) => ({ ...m, copyTakeProfitPct: e.target.value }))}
                        className="h-8 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Min profit % (dynamic exit)</label>
                      <input
                        type="text"
                        value={meme.copyFrontRunMinProfitPct}
                        onChange={(e) => setMeme((m) => ({ ...m, copyFrontRunMinProfitPct: e.target.value }))}
                        className="h-8 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={saveLocal}>
                  Save settings (this browser)
                </Button>
                {savedAt && <span className="text-xs text-muted-foreground">Saved {new Date(savedAt).toLocaleString()}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">
                NovaStaris sign-in wallet: {solanaWalletShort ?? "—"} · Live snipe uses Phantom’s connected key for signing (can match your login wallet).
              </p>

              <details className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/40 dark:bg-zinc-900/30 px-3 py-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">Phantom Terminal (charts in Phantom)</summary>
                <p className="mt-2">
                  Open Phantom’s <strong className="text-zinc-800 dark:text-zinc-200">Terminal</strong> for charts and spot/perp review; keep the same wallet as here when possible. NovaStaris does not host Terminal—it’s a pointer so you know where to manage exits after a snipe.
                </p>
              </details>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perps" className="mt-0 space-y-4">
          <Card className="border-zinc-200/80 dark:border-zinc-700/80 border-violet-200/50 dark:border-violet-900/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Flame className="h-5 w-5 text-violet-500 animate-flame-flicker" aria-hidden />
                Phantom Perps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Phantom Perps lets you trade perpetual futures with leverage inside Phantom’s interface. Nova Ultimate keeps a <strong className="text-zinc-800 dark:text-zinc-200">personal playbook</strong> here: markets to watch, sizing discipline, and risk notes—while execution and liquidation risk are handled in Phantom.
              </p>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Perp watchlist (comma separated)</label>
                <input
                  value={perps.watchlist}
                  onChange={(e) => setPerps((p) => ({ ...p, watchlist: e.target.value }))}
                  className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Default notional guidance (USD, not live orders)</label>
                <input
                  value={perps.defaultSizeUsd}
                  onChange={(e) => setPerps((p) => ({ ...p, defaultSizeUsd: e.target.value }))}
                  className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Risk note (shown in your plan)</label>
                <textarea
                  value={perps.riskNote}
                  onChange={(e) => setPerps((p) => ({ ...p, riskNote: e.target.value }))}
                  rows={3}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                />
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={saveLocal}>
                Save Perps playbook
              </Button>
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Perpetual futures can liquidate positions. This tab does not place perp orders; open Phantom Perps to trade for real.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
