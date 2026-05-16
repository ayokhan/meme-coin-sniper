"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, RefreshCw, Send, Sparkles, Zap, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMemeRunnerShareForCoach } from "@/lib/meme-runner/format";
import { NOVASTARIS_OPEN_AI_AGENT } from "@/lib/novastaris-events";
import type { MemeRunnerLane, MemeRunnerSolConfig, MemeRunnerToken } from "@/lib/meme-runner/types";

function fmtUsd(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function TokenCard({
  t,
  canShareCoach,
}: {
  t: MemeRunnerToken;
  canShareCoach: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareOk, setShareOk] = useState(false);

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(t.contractAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const openAiAgent = () => {
    window.dispatchEvent(
      new CustomEvent(NOVASTARIS_OPEN_AI_AGENT, {
        detail: { contractAddress: t.contractAddress, chain: "solana" as const },
      })
    );
  };

  const shareToCoachCalls = async () => {
    if (!canShareCoach || shareLoading) return;
    setShareLoading(true);
    setShareOk(false);
    const { title, content } = formatMemeRunnerShareForCoach(t);
    try {
      const res = await fetch("/api/coach-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        alert(data.error ?? "Failed to share");
        return;
      }
      setShareOk(true);
      window.setTimeout(() => setShareOk(false), 3000);
    } catch {
      alert("Failed to share");
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 p-3 space-y-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{t.symbol}</p>
          <p className="text-muted-foreground truncate max-w-[140px]">{t.name}</p>
        </div>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          Score {t.runnerScore}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span>MC {fmtUsd(t.marketCapUsd)}</span>
        <span>Vol {fmtUsd(t.volume24hUsd)}</span>
        <span>Age {t.tokenAgeMinutes}m</span>
        <span>Fees ~{t.estimatedFeesSol} SOL</span>
        {t.bondingProgressPct != null && <span className="col-span-2">Curve {t.bondingProgressPct}%</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {t.twitter && (
          <a href={t.twitter} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
            X
          </a>
        )}
        {t.telegram && (
          <a href={t.telegram} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
            TG
          </a>
        )}
        {t.website && (
          <a href={t.website} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">
            Web
          </a>
        )}
        {t.dexUrl && (
          <a href={t.dexUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-violet-600">
            Chart <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <a
          href={`https://pump.fun/coin/${t.contractAddress}`}
          target="_blank"
          rel="noreferrer"
          className="text-emerald-600 hover:underline"
        >
          pump.fun
        </a>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground break-all" title={t.contractAddress}>
        {shortAddr(t.contractAddress)}
      </p>
      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={() => void copyContract()}>
          {copied ? <Check className="h-3 w-3 mr-0.5 text-emerald-600" /> : <Copy className="h-3 w-3 mr-0.5" />}
          {copied ? "Copied" : "Copy ID"}
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] px-2" onClick={openAiAgent}>
          <Sparkles className="h-3 w-3 mr-0.5" />
          Analyze
        </Button>
        {canShareCoach && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[10px] px-2 border-cyan-300/80 dark:border-cyan-700 text-cyan-800 dark:text-cyan-200"
            disabled={shareLoading}
            onClick={() => void shareToCoachCalls()}
          >
            {shareOk ? <Check className="h-3 w-3 mr-0.5" /> : <Send className="h-3 w-3 mr-0.5" />}
            {shareLoading ? "…" : shareOk ? "Shared" : "Share"}
          </Button>
        )}
      </div>
    </div>
  );
}

function LaneColumn({
  title,
  tokens,
  empty,
  canShareCoach,
}: {
  title: string;
  tokens: MemeRunnerToken[];
  empty: string;
  canShareCoach: boolean;
}) {
  return (
    <div className="space-y-2 min-w-0">
      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
        {title} <span className="text-muted-foreground font-normal">({tokens.length})</span>
      </p>
      <div className="space-y-2 max-h-[min(70vh,640px)] overflow-y-auto pr-1">
        {tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">{empty}</p>
        ) : (
          tokens.map((t) => <TokenCard key={t.id} t={t} canShareCoach={canShareCoach} />)
        )}
      </div>
    </div>
  );
}

export default function MemeRunnerPanel() {
  const { data: session } = useSession();
  const isOwner = isOwnerSession(session);
  const isCoachUser = (session?.user as { isCoachUser?: boolean })?.isCoachUser === true;
  const canShareCoach = isOwner || isCoachUser;

  const [chain, setChain] = useState<"sol" | "bsc" | "eth">("sol");
  const [lane, setLane] = useState<MemeRunnerLane | "all">("all");
  const [config, setConfig] = useState<MemeRunnerSolConfig | null>(null);
  const [tokens, setTokens] = useState<MemeRunnerToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [scannedAt, setScannedAt] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (chain !== "sol") return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ chain, lane });
      const res = await fetch(`/api/meme-runner/scan?${q}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        if (data?.disabled) setDisabled(true);
        setError(data?.error ?? "Scan failed");
        setTokens([]);
        return;
      }
      setTokens(Array.isArray(data.tokens) ? data.tokens : []);
      if (data.config) setConfig(data.config);
      setScannedAt(data.scannedAt ?? new Date().toISOString());
    } catch {
      setError("Scan failed");
    } finally {
      setLoading(false);
    }
  }, [chain, lane]);

  useEffect(() => {
    fetch("/api/meme-runner/bootstrap", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.success) {
          if (d?.disabled) setDisabled(true);
          setError(d?.error ?? "Meme Runner unavailable");
          return;
        }
        if (d.config) setConfig(d.config);
        setIsOwner(!!d.isOwner);
        setCanShareCoach(!!d.canShareCoach);
        void runScan();
      })
      .catch(() => setError("Could not load Meme Runner"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chain === "sol" && !disabled) void runScan();
  }, [lane, chain, disabled, runScan]);

  const byLane = useMemo(() => {
    const n: MemeRunnerToken[] = [];
    const s: MemeRunnerToken[] = [];
    const m: MemeRunnerToken[] = [];
    for (const t of tokens) {
      if (t.lane === "new") n.push(t);
      else if (t.lane === "soon") s.push(t);
      else m.push(t);
    }
    return { new: n, soon: s, migrated: m };
  }, [tokens]);

  if (disabled) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground text-center">
          Meme Runner is turned off. Ask the site owner to enable{" "}
          <span className="font-mono text-xs">nova_meme_runner</span> in Admin → Feature flags.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-fuchsia-200/50 dark:border-fuchsia-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-fuchsia-500" />
            Meme Runner
          </CardTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Padre-style trenches scanner for pump.fun on Solana. Surfaces tokens in the ~$50k market-cap band with real
            activity (fees, volume, socials) before migration — not financial advice.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={chain} onValueChange={(v) => setChain(v as typeof chain)}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="sol">SOL</TabsTrigger>
              <TabsTrigger value="bsc" disabled>
                BSC (soon)
              </TabsTrigger>
              <TabsTrigger value="eth" disabled>
                ETH (soon)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sol" className="mt-3 space-y-3">
              {config && (
                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 text-[11px] text-muted-foreground space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <span>Min age {config.minTokenAgeMinutes}m</span>
                    <span>MC {fmtUsd(config.minMarketCapUsd)}–{fmtUsd(config.maxMarketCapUsd)}</span>
                    <span>Min fees {config.minEstimatedFeesSol} SOL</span>
                    <span>Min score {config.minRunnerScore}</span>
                  </div>
                  <p className="text-[10px] border-t border-zinc-200/80 dark:border-zinc-700/80 pt-2">
                    <strong className="text-zinc-700 dark:text-zinc-300">Lanes:</strong>{" "}
                    <span className="text-emerald-700 dark:text-emerald-400">New</span> &lt; {fmtUsd(config.laneNewMaxMcapUsd)} MC on pump.fun ·{" "}
                    <span className="text-fuchsia-700 dark:text-fuchsia-400">Soon</span> {fmtUsd(config.laneSoonMinMcapUsd)}–
                    {fmtUsd(config.laneSoonMaxMcapUsd)} on pump.fun ·{" "}
                    <span className="text-cyan-700 dark:text-cyan-400">Migrated</span> on Raydium/Orca/Meteora.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <Tabs value={lane} onValueChange={(v) => setLane(v as typeof lane)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-2">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="new" className="text-xs px-2">
                      New
                    </TabsTrigger>
                    <TabsTrigger value="soon" className="text-xs px-2">
                      Soon
                    </TabsTrigger>
                    <TabsTrigger value="migrated" className="text-xs px-2">
                      Migrated
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button size="sm" className="bg-fuchsia-600 hover:bg-fuchsia-700" disabled={loading} onClick={() => void runScan()}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
                  {loading ? "Scanning…" : "Refresh scan"}
                </Button>
                {scannedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    Updated {new Date(scannedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
              {lane === "all" ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <LaneColumn title="New" tokens={byLane.new} empty="No new-lane tokens passed filters." canShareCoach={canShareCoach} />
                  <LaneColumn title="Soon" tokens={byLane.soon} empty="No soon-lane tokens in the $50k band." canShareCoach={canShareCoach} />
                  <LaneColumn
                    title="Migrated"
                    tokens={byLane.migrated}
                    empty="No tokens on Raydium/Orca/Meteora passed filters."
                    canShareCoach={canShareCoach}
                  />
                </div>
              ) : (
                <LaneColumn
                  title={lane === "new" ? "New" : lane === "soon" ? "Soon" : "Migrated"}
                  tokens={tokens}
                  empty="No tokens passed your filters."
                  canShareCoach={canShareCoach}
                />
              )}
              <p className="text-[10px] text-muted-foreground">
                Inspired by{" "}
                <a href="https://trade.padre.gg/trenches" target="_blank" rel="noreferrer" className="underline">
                  Padre Trenches
                </a>
                . Fees are estimated from 24h volume × 1.25% bonding-curve rate.
                {isOwner && (
                  <>
                    {" "}
                    <Link href="/admin/meme-runner" className="underline">
                      Owner: adjust config
                    </Link>
                    .
                  </>
                )}
              </p>
            </TabsContent>
            <TabsContent value="bsc" className="mt-3">
              <p className="text-sm text-muted-foreground">BSC Meme Runner is planned after SOL validation.</p>
            </TabsContent>
            <TabsContent value="eth" className="mt-3">
              <p className="text-sm text-muted-foreground">Ethereum Meme Runner is planned after SOL validation.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
