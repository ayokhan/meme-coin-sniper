"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, RefreshCw, Send, Sparkles, Zap, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMemeRunnerShareForCoach } from "@/lib/meme-runner/format";
import { getChainMeta, memeRunnerAgentChain } from "@/lib/meme-runner/chain-meta";
import { launchpadExternalUrl } from "@/lib/meme-runner/launchpads";
import { NOVASTARIS_OPEN_AI_AGENT } from "@/lib/novastaris-events";
import type { MemeRunnerChain, MemeRunnerLane, MemeRunnerSolConfig, MemeRunnerToken } from "@/lib/meme-runner/types";

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
  nativeSymbol,
}: {
  t: MemeRunnerToken;
  canShareCoach: boolean;
  nativeSymbol: string;
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
        <div className="flex flex-col items-end gap-1 shrink-0">
          {t.launchpadLabel && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {t.launchpadLabel}
            </Badge>
          )}
          <div className="flex flex-col items-end gap-0.5">
            {t.lane === "soon" && t.continuationScore > 0 && (
              <Badge
                variant="outline"
                className={`text-[10px] h-5 tabular-nums ${
                  t.continuationScore >= 60
                    ? "border-emerald-500/60 text-emerald-700 dark:text-emerald-400"
                    : ""
                }`}
              >
                Run {t.continuationScore}
              </Badge>
            )}
            <Badge variant="outline" className="tabular-nums text-[10px] h-5">
              Score {t.runnerScore}
            </Badge>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span>MC {fmtUsd(t.marketCapUsd)}</span>
        <span>Vol {fmtUsd(t.volume24hUsd)}</span>
        <span>Age {t.tokenAgeMinutes}m</span>
        <span>
          Fees ~{t.estimatedFeesSol} {nativeSymbol}
        </span>
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
        {(() => {
          const padUrl = launchpadExternalUrl(t.chain, t.launchpadId, t.contractAddress);
          if (!padUrl) return null;
          return (
            <a href={padUrl} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">
              {t.launchpadLabel ?? "Launchpad"}
            </a>
          );
        })()}
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
  nativeSymbol,
}: {
  title: string;
  tokens: MemeRunnerToken[];
  empty: string;
  canShareCoach: boolean;
  nativeSymbol: string;
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
          tokens.map((t) => (
            <TokenCard key={t.id} t={t} canShareCoach={canShareCoach} nativeSymbol={nativeSymbol} />
          ))
        )}
      </div>
    </div>
  );
}

export default function MemeRunnerPanel() {
  const [isOwner, setIsOwner] = useState(false);
  const [canShareCoach, setCanShareCoach] = useState(false);
  const [chain, setChain] = useState<MemeRunnerChain>("sol");
  const [lane, setLane] = useState<MemeRunnerLane | "all">("all");
  const [config, setConfig] = useState<MemeRunnerSolConfig | null>(null);
  const [tokens, setTokens] = useState<MemeRunnerToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [launchpadSummary, setLaunchpadSummary] = useState<string>("");
  const [nativeSymbol, setNativeSymbol] = useState("SOL");
  const [migratedLabel, setMigratedLabel] = useState("Raydium, Orca, or Meteora");
  const [diagnostics, setDiagnostics] = useState<{
    classified: { new: number; soon: number; migrated: number };
    passed: { new: number; soon: number; migrated: number };
    soonRejectSamples?: string[];
  } | null>(null);

  const runScan = useCallback(async () => {
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
      if (data.diagnostics) setDiagnostics(data.diagnostics);
      setScannedAt(data.scannedAt ?? new Date().toISOString());
    } catch {
      setError("Scan failed");
    } finally {
      setLoading(false);
    }
  }, [chain, lane]);

  const loadBootstrap = useCallback(async (c: MemeRunnerChain) => {
    const res = await fetch(`/api/meme-runner/bootstrap?chain=${c}`, {
      cache: "no-store",
      credentials: "include",
    });
    const d = await res.json();
    if (!d?.success) {
      if (d?.disabled) setDisabled(true);
      setError(d?.error ?? "Meme Runner unavailable");
      return false;
    }
    if (d.config) setConfig(d.config as MemeRunnerSolConfig);
    setLaunchpadSummary(typeof d.enabledLaunchpadLabels === "string" ? d.enabledLaunchpadLabels : "");
    setNativeSymbol(typeof d.nativeSymbol === "string" ? d.nativeSymbol : getChainMeta(c).nativeSymbol);
    const legend = d.laneLegend as { migrated?: string } | undefined;
    if (legend?.migrated) setMigratedLabel(legend.migrated.replace(/^Listed on /, "").replace(/ after graduation\.?$/, ""));
    setIsOwner(!!d.isOwner);
    setCanShareCoach(!!d.canShareCoach);
    return true;
  }, []);

  useEffect(() => {
    if (disabled) return;
    void (async () => {
      await loadBootstrap(chain);
      void runScan();
    })();
  }, [chain, disabled, loadBootstrap, runScan]);

  useEffect(() => {
    if (disabled) return;
    void runScan();
  }, [lane, disabled, runScan]);

  const byLane = useMemo(() => {
    const n: MemeRunnerToken[] = [];
    const s: MemeRunnerToken[] = [];
    const m: MemeRunnerToken[] = [];
    for (const t of tokens) {
      if (t.lane === "new") n.push(t);
      else if (t.lane === "soon") s.push(t);
      else m.push(t);
    }
    s.sort(
      (a, b) =>
        b.continuationScore - a.continuationScore ||
        b.runnerScore - a.runnerScore ||
        (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0)
    );
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
            Multi-chain meme trenches scanner (SOL, BSC, ETH). Soon uses a continuation score to deprioritize
            late-curve pops (~90k) that often fade after +20% — not financial advice.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={chain} onValueChange={(v) => setChain(v as typeof chain)}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="sol">SOL</TabsTrigger>
              <TabsTrigger value="bsc">BSC</TabsTrigger>
              <TabsTrigger value="eth">ETH</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-3 space-y-3">
              {config && (
                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/40 p-3 text-[11px] text-muted-foreground space-y-2">
                  <p className="text-[10px]">
                    <strong className="text-zinc-700 dark:text-zinc-300">Launchpads:</strong>{" "}
                    {launchpadSummary || (config.enabledLaunchpads.length > 0 ? config.enabledLaunchpads.join(", ") : "none")}
                    {config.includeMigratedPools ? " · Migrated pools on" : " · Migrated pools off"}
                  </p>
                  {(["new", "soon", "migrated"] as const).map((lane) => {
                    const f = config[lane];
                    const label =
                      lane === "new" ? "New" : lane === "soon" ? "Soon" : "Migrated";
                    const color =
                      lane === "new"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : lane === "soon"
                          ? "text-fuchsia-700 dark:text-fuchsia-400"
                          : "text-cyan-700 dark:text-cyan-400";
                    return (
                      <div
                        key={lane}
                        className="grid grid-cols-2 sm:grid-cols-4 gap-1 border-t border-zinc-200/80 dark:border-zinc-700/80 pt-1.5"
                      >
                        <span className={`font-medium ${color}`}>{label}</span>
                        <span>
                          Age {f.minTokenAgeMinutes}-{f.maxTokenAgeMinutes}m
                        </span>
                        <span>
                          MC {fmtUsd(f.minMarketCapUsd)}-{fmtUsd(f.maxMarketCapUsd)}
                        </span>
                        <span>
                          &gt;={f.minEstimatedFeesSol} {nativeSymbol}, score {f.minRunnerScore}+
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[10px] border-t border-zinc-200/80 dark:border-zinc-700/80 pt-2">
                    Lane MC: New &lt; {fmtUsd(config.laneNewMaxMcapUsd)}; Soon{" "}
                    {fmtUsd(config.laneSoonMinMcapUsd)}-{fmtUsd(config.laneSoonMaxMcapUsd)}.
                  </p>
                  {diagnostics && (
                    <div className="text-[10px] text-amber-800 dark:text-amber-200/90 space-y-0.5">
                      <p>
                        Scan: New {diagnostics.passed.new}/{diagnostics.classified.new} · Soon{" "}
                        {diagnostics.passed.soon}/{diagnostics.classified.soon} · Migrated{" "}
                        {diagnostics.passed.migrated}/{diagnostics.classified.migrated}
                      </p>
                      {diagnostics.classified.soon > 0 &&
                      diagnostics.passed.soon === 0 &&
                      diagnostics.soonRejectSamples?.length ? (
                        <p className="text-amber-700/90 dark:text-amber-300/80">
                          Soon blocked: {diagnostics.soonRejectSamples.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  )}
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
                  <LaneColumn
                    title="New"
                    tokens={byLane.new}
                    empty="No new-lane tokens passed filters."
                    canShareCoach={canShareCoach}
                    nativeSymbol={nativeSymbol}
                  />
                  <LaneColumn
                    title="Soon"
                    tokens={byLane.soon}
                    empty="No Soon tokens passed continuation filters (try lowering min in admin)."
                    canShareCoach={canShareCoach}
                    nativeSymbol={nativeSymbol}
                  />
                  <LaneColumn
                    title="Migrated"
                    tokens={byLane.migrated}
                    empty={`No tokens on ${migratedLabel} passed filters.`}
                    canShareCoach={canShareCoach}
                    nativeSymbol={nativeSymbol}
                  />
                </div>
              ) : (
                <LaneColumn
                  title={lane === "new" ? "New" : lane === "soon" ? "Soon" : "Migrated"}
                  tokens={tokens}
                  empty="No tokens passed your filters."
                  canShareCoach={canShareCoach}
                  nativeSymbol={nativeSymbol}
                />
              )}
              <p className="text-[10px] text-muted-foreground">
                Fees estimated from 24h volume × 1.25% bonding-curve rate.
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
