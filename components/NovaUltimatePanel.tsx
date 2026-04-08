"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";

const LS_KEY = "novastaris_nova_ultimate_meme_v1";

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
  copyExitStrategy: "fixed_tp" | "before_leader_sells";
  copyTakeProfitPct: string;
  copyFrontRunMinProfitPct: string;
};

const DEFAULT_MEME: MemeSniperConfig = {
  preset: "medium_risk",
  mode: "demo",
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

export default function NovaUltimatePanel({ solanaWalletShort }: { solanaWalletShort?: string | null }) {
  const [ultimateSub, setUltimateSub] = useState<"meme" | "terminal">("meme");
  const [meme, setMeme] = useState<MemeSniperConfig>(DEFAULT_MEME);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MemeSniperConfig;
        setMeme({ ...DEFAULT_MEME, ...parsed });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const saveLocal = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(meme));
      setSavedAt(new Date().toISOString());
    } catch {
      /* ignore */
    }
  }, [meme]);

  const setPreset = (preset: MemeStrategyPreset) => {
    const patch = applyPreset(preset);
    setMeme((m) => ({ ...m, preset, ...patch }));
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-start gap-3 flex-wrap">
        <Flame className="h-8 w-8 text-amber-500 shrink-0 mt-0.5 animate-flame-flicker" aria-hidden />
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Nova Ultimate</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Advanced NovaStaris automation workspace for meme sniping and Phantom Terminal–ready execution. Configure risk, entries, and copy logic here;
            live routing will use your connected wallet when automation is enabled server-side.
          </p>
        </div>
      </div>

      <Tabs value={ultimateSub} onValueChange={(v) => setUltimateSub(v as "meme" | "terminal")} className="space-y-4">
        <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 p-1 rounded-lg h-auto flex-wrap">
          <TabsTrigger
            value="meme"
            className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"
          >
            NovaMeme Sniper
          </TabsTrigger>
          <TabsTrigger
            value="terminal"
            className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"
          >
            Phantom Terminal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meme" className="mt-0 space-y-4">
          <Card className="border-zinc-200/80 dark:border-zinc-700/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                NovaMeme Sniper
                <Badge variant="outline" className="font-normal">Nova AI Sniper</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                NovaMeme Sniper is designed for disciplined entries and exits on high-volatility meme launches. Choose a risk template, then refine every parameter manually when you need full control.
                <span className="block mt-2 text-amber-800 dark:text-amber-200/90">
                  Automation does not guarantee profit. Slippage, MEV, and liquidity can cause losses. Use Demo until you understand the playbook.
                </span>
              </p>

              <div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Strategy template</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["aggressive", "Aggressive", "Higher size & tolerance; aims for larger wins with elevated drawdown risk."],
                      ["snipe", "Snipe mode", "Optimized for fresh launches: quick in, smaller targets, faster exit."],
                      ["low_risk", "Conservative", "Tighter risk caps, higher liquidity gates, fewer concurrent positions."],
                      ["medium_risk", "Balanced", "Default blend of size, slippage, and hold assumptions."],
                      ["custom", "Custom / manual", "Your numbers only—no preset overrides after you edit fields below."],
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
                    <option value="demo">Demo (paper / signals only)</option>
                    <option value="live">Live (requires wallet + Phantom Terminal readiness)</option>
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
                Allow sniping newly launched pairs (within age & liquidity gates)
              </label>

              <Card className="border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30">
                <CardHeader className="py-3 pb-2">
                  <CardTitle className="text-sm font-semibold">Copy trading (tracked wallets)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-xs text-muted-foreground">
                    Mirror entries when selected wallets buy; optional exit logic aims to secure profit before an observed leader sell (subject to chain latency and your TP rules).
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
                    Mirror entries on leader buy signals
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Exit preference</label>
                    <select
                      value={meme.copyExitStrategy}
                      onChange={(e) =>
                        setMeme((m) => ({ ...m, copyExitStrategy: e.target.value as MemeSniperConfig["copyExitStrategy"] }))
                      }
                      className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    >
                      <option value="fixed_tp">Fixed take-profit % (disciplined trim)</option>
                      <option value="before_leader_sells">Dynamic: scale out before leader sells once min profit is reached</option>
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
                      <label className="block text-xs text-muted-foreground mb-1">Min profit % (before leader exit mode)</label>
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
                {savedAt && (
                  <span className="text-xs text-muted-foreground">Saved {new Date(savedAt).toLocaleString()}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Connected NovaStaris wallet (sign-in): {solanaWalletShort ?? "—"} · Live execution will respect Phantom and RPC limits when engine support is enabled.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminal" className="mt-0 space-y-4">
          <Card className="border-zinc-200/80 dark:border-zinc-700/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Phantom Terminal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Phantom Terminal is Phantom’s trading experience. Nova Ultimate is built so you can <strong className="text-zinc-800 dark:text-zinc-200">prepare strategies here</strong>, then{" "}
                <strong className="text-zinc-800 dark:text-zinc-200">confirm swaps in Phantom</strong> when live mode is on—keeping keys in your wallet.
              </p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Sign in to NovaStaris with the same <strong className="text-zinc-800 dark:text-zinc-200">Solana</strong> wallet you use in Phantom.</li>
                <li>Open Phantom → use <strong className="text-zinc-800 dark:text-zinc-200">Terminal</strong> (or latest Phantom trading entry point) for execution.</li>
                <li>Configure NovaMeme Sniper in <strong className="text-zinc-800 dark:text-zinc-200">Demo</strong> first; switch to <strong className="text-zinc-800 dark:text-zinc-200">Live</strong> only when you accept the risks.</li>
              </ol>
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                NovaStaris does not custody funds. Review every transaction in Phantom before approving.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
