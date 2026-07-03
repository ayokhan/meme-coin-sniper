"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wand2, ExternalLink, ShieldCheck, ShieldAlert, AlertTriangle, Star, Globe, Copy, Check, Flag, LogOut, Anchor, Search } from "lucide-react";
import { StyledSelect } from "@/components/ui/styled-select";

export type AnalyzerChain = "solana" | "bsc";
export type AnalyzerPeriod = "30m" | "1h" | "2h" | "4h" | "8h" | "24h" | "7d" | "30d";

const PERIOD_OPTIONS: { value: AnalyzerPeriod; label: string }[] = [
  { value: "30m", label: "30 min" },
  { value: "1h", label: "1 hour" },
  { value: "2h", label: "2 hours" },
  { value: "4h", label: "4 hours" },
  { value: "8h", label: "8 hours" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

const CHAIN_OPTIONS: { value: AnalyzerChain | "auto"; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "solana", label: "Solana" },
  { value: "bsc", label: "BSC" },
];

type Holding = {
  mint: string;
  symbol: string | null;
  uiAmount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  firstBuyAtMs: number | null;
  pctSold: number | null;
  pctHeld: number | null;
  recommendedCopy: boolean;
};

type Trade = {
  signature: string | null;
  timestampMs: number;
  action: "buy" | "sell" | "swap";
  mint: string;
  symbol: string | null;
  nativeDelta: number;
  tokenDelta: number;
  notionalUsd: number;
};

type Position = {
  mint: string;
  symbol: string | null;
  trades: number;
  buys: number;
  sells: number;
  realizedNative: number;
  realizedUsd: number;
  realizedPct: number | null;
  currentHoldingUiAmount: number;
  currentHoldingUsd: number | null;
  pctSold: number | null;
  pctHeld: number | null;
  recommendedCopy: boolean;
};

type Verdict = {
  label: "Strong copy" | "Moderate copy" | "Mixed signal" | "Avoid";
  score: number;
  reasons: string[];
  cautions: string[];
};

type Analysis = {
  chain: AnalyzerChain;
  walletAddress: string;
  period: AnalyzerPeriod;
  generatedAtMs: number;
  nativeSymbol: "SOL" | "BNB";
  nativePriceUsd: number;
  totals: {
    realizedPnlUsd: number;
    realizedPnlPct: number | null;
    volumeUsd: number;
    tradeCount: number;
    winRatePct: number | null;
    biggestWinSymbol: string | null;
    biggestWinPnlUsd: number | null;
    biggestLossSymbol: string | null;
    biggestLossPnlUsd: number | null;
    holdingsValueUsd: number;
    uniqueMints: number;
  };
  positions: Position[];
  trades: Trade[];
  holdings: Holding[];
  verdict: Verdict;
  notes: string[];
};

export type WalletAnalyzerCardProps = {
  /** When this counter changes, the card re-runs analyze using `pendingAddress`/`pendingChain`. */
  pendingTrigger: number;
  pendingAddress?: string;
  pendingChain?: AnalyzerChain | "auto";
  pendingPeriod?: AnalyzerPeriod;
  /** When true, surfaces owner-only actions (e.g. promote to global). */
  isOwner?: boolean;
  /** Called after a successful promote-to-global so the leaderboard can refetch. */
  onWalletChanged?: () => void;
};

function fmtUsd(v: number | null | undefined, opts?: { signed?: boolean }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = opts?.signed ? (v > 0 ? "+" : v < 0 ? "-" : "") : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs > 0) return `${sign}$${abs.toFixed(4)}`;
  return "$0.00";
}

function fmtPct(v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(0)}%`;
}

function shorten(s: string) {
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

function chainExplorerWalletUrl(chain: AnalyzerChain, address: string): string {
  return chain === "solana"
    ? `https://solscan.io/account/${address}`
    : `https://bscscan.com/address/${address}`;
}

function chainDexTokenUrl(chain: AnalyzerChain, mint: string): string {
  return chain === "solana"
    ? `https://dexscreener.com/solana/${mint}`
    : `https://dexscreener.com/bsc/${mint}`;
}

function chainExplorerTxUrl(chain: AnalyzerChain, sig: string): string {
  return chain === "solana"
    ? `https://solscan.io/tx/${sig}`
    : `https://bscscan.com/tx/${sig}`;
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const styles =
    verdict.label === "Strong copy"
      ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
      : verdict.label === "Moderate copy"
        ? "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700"
        : verdict.label === "Mixed signal"
          ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
          : "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700";
  const Icon =
    verdict.label === "Strong copy" || verdict.label === "Moderate copy"
      ? ShieldCheck
      : verdict.label === "Mixed signal"
        ? AlertTriangle
        : ShieldAlert;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${styles}`}>
      <Icon className="h-3.5 w-3.5" />
      {verdict.label} ({verdict.score.toFixed(1)})
    </div>
  );
}

export default function WalletAnalyzerCard({
  pendingTrigger,
  pendingAddress,
  pendingChain,
  pendingPeriod,
  isOwner,
  onWalletChanged,
}: WalletAnalyzerCardProps) {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<AnalyzerChain | "auto">("auto");
  const [period, setPeriod] = useState<AnalyzerPeriod>("7d");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteNickname, setPromoteNickname] = useState("");
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const copyAddress = useCallback(async (text: string, key?: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      const k = key ?? text;
      setCopiedKey(k);
      setTimeout(() => {
        setCopiedKey((cur) => (cur === k ? null : cur));
      }, 1500);
    } catch {
      // Silently no-op; users can still copy via Solscan/Dexscreener link.
    }
  }, []);

  const runAnalyze = useCallback(async (overrideAddress?: string, overrideChain?: AnalyzerChain | "auto", overridePeriod?: AnalyzerPeriod) => {
    const addr = (overrideAddress ?? address).trim();
    const ch = overrideChain ?? chain;
    const per = overridePeriod ?? period;
    if (!addr) {
      setError("Paste a wallet address first.");
      return;
    }
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/wallet-tracker/wallet-analyzer/analyze", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addr,
          chain: ch === "auto" ? undefined : ch,
          period: per,
        }),
      });
      const data = (await res.json()) as { success?: boolean; analysis?: Analysis; error?: string };
      if (!data.success || !data.analysis) {
        setError(data.error ?? "Analyzer failed.");
        return;
      }
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyzer failed.");
    } finally {
      setLoading(false);
    }
  }, [address, chain, period]);

  // Trigger when the parent bumps `pendingTrigger`.
  useEffect(() => {
    if (pendingTrigger === 0) return; // initial mount
    const addr = (pendingAddress ?? "").trim();
    if (!addr) return;
    setAddress(addr);
    if (pendingChain) setChain(pendingChain);
    if (pendingPeriod) setPeriod(pendingPeriod);
    void runAnalyze(addr, pendingChain ?? "auto", pendingPeriod ?? period);
    // Smooth-scroll the analyzer into view so user sees the result.
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTrigger]);

  const localTime = useCallback((ms: number) => {
    if (!ms) return "—";
    const d = new Date(ms);
    return d.toLocaleString();
  }, []);

  const localDateShort = useCallback((ms: number | null) => {
    if (!ms) return "—";
    const d = new Date(ms);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }, []);

  const promoteToGlobal = useCallback(async () => {
    if (!analysis) return;
    setPromoting(true);
    setPromoteMsg(null);
    try {
      const res = await fetch("/api/wallet-tracker/meme-leaderboard/promote", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: analysis.walletAddress, nickname: promoteNickname.trim() || undefined, global: true }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!data.success) {
        setPromoteMsg(data.error ?? "Failed to promote.");
        return;
      }
      setPromoteMsg("Promoted to global. All users will now see this wallet on the leaderboard.");
      onWalletChanged?.();
    } catch (err) {
      setPromoteMsg(err instanceof Error ? err.message : "Failed to promote.");
    } finally {
      setPromoting(false);
    }
  }, [analysis, promoteNickname, onWalletChanged]);

  const showHoldings = useMemo(() => analysis?.holdings.filter((h) => (h.valueUsd ?? 0) > 0.01) ?? [], [analysis]);
  const explorer = analysis ? chainExplorerWalletUrl(analysis.chain, analysis.walletAddress) : null;

  /**
   * Per-trade annotations driven by *position-level* aggregates (not just visible trades):
   *  - isFirstBuy: chronologically first BUY of this mint in the window.
   *  - isLastExit: this is the chronologically last SELL of a mint that the wallet no longer holds.
   *  - isClosed: this row is a SELL of a mint the wallet has fully exited (covers all sell rows of exited mints, not only the last one).
   *  - hodl: bought + never sold within window + still holds.
   *  - pctHeldNow: the wallet's final per-mint pctHeld (only set when still holding).
   *
   * Using position aggregates lets us correctly tag exits / HODL even when one side of the trade
   * (e.g. the original buy) is outside the analyzed window.
   */
  const tradeAnnotations = useMemo(() => {
    type Anno = {
      isFirstBuy: boolean;
      isLastExit: boolean;
      isClosed: boolean;
      hodl: boolean;
      pctHeldNow: number | null;
    };
    const out = new Map<number, Anno>();
    if (!analysis) return out;

    type PosLite = {
      sells: number;
      currentHoldingUiAmount: number;
      currentHoldingUsd: number | null;
      pctHeld: number | null;
    };
    const positionByMint = new Map<string, PosLite>();
    for (const p of analysis.positions) {
      positionByMint.set(p.mint, {
        sells: p.sells,
        // Be defensive: older deploys may not have shipped currentHoldingUiAmount.
        currentHoldingUiAmount: (p as { currentHoldingUiAmount?: number }).currentHoldingUiAmount ?? 0,
        currentHoldingUsd: p.currentHoldingUsd,
        pctHeld: p.pctHeld,
      });
    }

    const chronoIdx = analysis.trades
      .map((t, i) => ({ t, i }))
      .sort((a, b) => a.t.timestampMs - b.t.timestampMs);

    const firstBuySeen = new Set<string>();
    const lastSellOriginalIdxByMint = new Map<string, number>();
    for (const { t, i } of chronoIdx) {
      let isFirstBuy = false;
      if (t.action === "buy" && !firstBuySeen.has(t.mint)) {
        firstBuySeen.add(t.mint);
        isFirstBuy = true;
      }
      if (t.action === "sell") {
        lastSellOriginalIdxByMint.set(t.mint, i);
      }
      out.set(i, { isFirstBuy, isLastExit: false, isClosed: false, hodl: false, pctHeldNow: null });
    }

    for (let i = 0; i < analysis.trades.length; i += 1) {
      const t = analysis.trades[i];
      const pos = positionByMint.get(t.mint);
      const anno = out.get(i)!;
      const holdingUi = pos?.currentHoldingUiAmount ?? 0;
      const holdingUsd = pos?.currentHoldingUsd ?? 0;
      const stillHolds = holdingUi > 0 || holdingUsd > 0;
      const sellsCount = pos?.sells ?? 0;
      const neverSold = sellsCount === 0;

      anno.hodl = t.action === "buy" && stillHolds && neverSold;
      if (stillHolds) anno.pctHeldNow = pos?.pctHeld ?? 100;

      // Any SELL of a fully-exited mint = closed. The most-recent one gets the stronger "Exited" tint.
      if (t.action === "sell" && !stillHolds && sellsCount > 0) {
        anno.isClosed = true;
        if (lastSellOriginalIdxByMint.get(t.mint) === i) {
          anno.isLastExit = true;
        }
      }
    }

    return out;
  }, [analysis]);

  return (
    <div ref={containerRef} className="scroll-mt-4">
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="h-5 w-5 text-cyan-500" />
            Wallet Analyzer
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Paste any Solana or BSC wallet for an active-holdings + win-rate read with a copy/avoid verdict.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-6">
            <input
              type="text"
              className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm font-mono"
              placeholder="Solana (base58) or BSC (0x…) wallet address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runAnalyze();
                }
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
          <div className="md:col-span-2">
            <StyledSelect<AnalyzerChain | "auto">
              value={chain}
              options={CHAIN_OPTIONS}
              onChange={(v) => setChain(v)}
              title="Chain"
            />
          </div>
          <div className="md:col-span-2">
            <StyledSelect<AnalyzerPeriod>
              value={period}
              options={PERIOD_OPTIONS}
              onChange={(v) => setPeriod(v)}
              title="Analyzer lookback window"
            />
          </div>
          <div className="md:col-span-2">
            <Button
              type="button"
              className="w-full h-10 bg-cyan-600 hover:bg-cyan-700 text-white whitespace-nowrap"
              onClick={() => void runAnalyze()}
              disabled={loading}
              title={loading ? "Scanning wallet… this can take 10–20 seconds" : "Analyze wallet"}
            >
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Search className="h-4 w-4 animate-pulse shrink-0" />
                  Scanning…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Wand2 className="h-4 w-4 shrink-0" />
                  Analyze
                </span>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
            {error}
          </div>
        )}

        {analysis && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <VerdictBadge verdict={analysis.verdict} />
                <a
                  href={explorer ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 font-mono"
                >
                  {shorten(analysis.walletAddress)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                {analysis.chain.toUpperCase()} • {analysis.period} • {analysis.nativeSymbol}/USD = {fmtUsd(analysis.nativePriceUsd)}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              <Tile label="Realized PnL" value={fmtUsd(analysis.totals.realizedPnlUsd, { signed: true })} positive={analysis.totals.realizedPnlUsd >= 0} />
              <Tile label="PnL %" value={analysis.totals.realizedPnlPct === null ? "—" : `${analysis.totals.realizedPnlPct >= 0 ? "+" : ""}${analysis.totals.realizedPnlPct.toFixed(0)}%`} positive={(analysis.totals.realizedPnlPct ?? 0) >= 0} />
              <Tile label="Win rate" value={fmtPct(analysis.totals.winRatePct)} />
              <Tile label="Volume" value={fmtUsd(analysis.totals.volumeUsd)} />
              <Tile label="Trades" value={String(analysis.totals.tradeCount)} />
              <Tile label="Holdings $" value={fmtUsd(analysis.totals.holdingsValueUsd)} />
            </div>

            {(analysis.verdict.reasons.length > 0 || analysis.verdict.cautions.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {analysis.verdict.reasons.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/15 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Why it looks good</p>
                    <ul className="space-y-1 text-xs text-emerald-700 dark:text-emerald-200">
                      {analysis.verdict.reasons.map((r, i) => (
                        <li key={`r-${i}`}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.verdict.cautions.length > 0 && (
                  <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Cautions</p>
                    <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {analysis.verdict.cautions.map((c, i) => (
                        <li key={`c-${i}`}>• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {isOwner && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex flex-wrap items-center gap-2">
                <Globe className="h-4 w-4 text-cyan-500" />
                <div className="flex-1 min-w-[180px]">
                  <p className="text-xs font-medium">Make this wallet global</p>
                  <p className="text-[11px] text-muted-foreground">All users will see it in the Meme Coin Advantage Bundle leaderboard.</p>
                </div>
                <input
                  type="text"
                  className="h-8 w-44 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 text-xs"
                  placeholder="Nickname (optional)"
                  value={promoteNickname}
                  onChange={(e) => setPromoteNickname(e.target.value)}
                />
                <Button size="sm" type="button" onClick={() => void promoteToGlobal()} disabled={promoting} className="h-8 bg-cyan-600 hover:bg-cyan-700 text-white">
                  {promoting ? "Promoting…" : "Promote to global"}
                </Button>
                {promoteMsg && <span className="text-[11px] text-muted-foreground basis-full pl-6">{promoteMsg}</span>}
              </div>
            )}

            {showHoldings.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Active holdings <span className="text-[11px] text-muted-foreground">— buy times in your local time</span></p>
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">First buy</TableHead>
                        <TableHead className="text-right">% sold</TableHead>
                        <TableHead className="text-right">% held</TableHead>
                        <TableHead className="text-right">Copy?</TableHead>
                        <TableHead className="text-right">Dex</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {showHoldings.slice(0, 30).map((h) => (
                        <TableRow key={h.mint}>
                          <TableCell>
                            <div className="font-medium">{h.symbol ?? shorten(h.mint)}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                              <span>{shorten(h.mint)}</span>
                              <button
                                type="button"
                                onClick={() => void copyAddress(h.mint, `h-${h.mint}`)}
                                className="text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400"
                                title="Copy token address"
                              >
                                {copiedKey === `h-${h.mint}` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{h.uiAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</TableCell>
                          <TableCell className="text-right">{h.priceUsd !== null ? fmtUsd(h.priceUsd) : "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtUsd(h.valueUsd)}</TableCell>
                          <TableCell className="text-right text-xs whitespace-nowrap">{localDateShort(h.firstBuyAtMs)}</TableCell>
                          <TableCell className="text-right text-xs">{h.pctSold === null ? "—" : `${h.pctSold.toFixed(0)}%`}</TableCell>
                          <TableCell className="text-right text-xs">{h.pctHeld === null ? "—" : `${h.pctHeld.toFixed(0)}%`}</TableCell>
                          <TableCell className="text-right">
                            {h.recommendedCopy ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 rounded px-1.5 py-0.5">
                                <Star className="h-3 w-3" /> Copy
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <a
                              href={chainDexTokenUrl(analysis.chain, h.mint)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  &quot;Copy?&quot; = recommended to consider copy-buy. Rule: wallet verdict ≥ Moderate copy AND this position is still &gt;30% held OR realized PnL ≥ 0.
                </p>
              </div>
            )}

            {analysis.positions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">Per-token PnL ({analysis.period})</p>
                <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead className="text-right">Trades</TableHead>
                        <TableHead className="text-right">Realized USD</TableHead>
                        <TableHead className="text-right">Realized %</TableHead>
                        <TableHead className="text-right">Holding $</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.positions.slice(0, 25).map((p) => (
                        <TableRow key={p.mint}>
                          <TableCell>
                            <a
                              href={chainDexTokenUrl(analysis.chain, p.mint)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:text-cyan-600 dark:hover:text-cyan-400"
                            >
                              {p.symbol ?? shorten(p.mint)}
                            </a>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                              <span>{shorten(p.mint)}</span>
                              <button
                                type="button"
                                onClick={() => void copyAddress(p.mint, `p-${p.mint}`)}
                                className="text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400"
                                title="Copy token address"
                              >
                                {copiedKey === `p-${p.mint}` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{p.trades} ({p.buys}/{p.sells})</TableCell>
                          <TableCell className={`text-right ${p.realizedUsd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {fmtUsd(p.realizedUsd, { signed: true })}
                          </TableCell>
                          <TableCell className={`text-right ${(p.realizedPct ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {p.realizedPct === null ? "—" : `${p.realizedPct >= 0 ? "+" : ""}${p.realizedPct.toFixed(0)}%`}
                          </TableCell>
                          <TableCell className="text-right">{p.currentHoldingUsd === null ? "—" : fmtUsd(p.currentHoldingUsd)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {analysis.trades.length > 0 && (
              <details className="rounded-lg border border-zinc-200 dark:border-zinc-700" open>
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                  Trades ({analysis.trades.length}) — times in your local timezone
                </summary>
                <div className="px-3 py-2 text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">Legend:</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-200 bg-amber-100 dark:bg-amber-900/30"><Anchor className="h-2.5 w-2.5" /> HODL 100%</span>
                  <span>= bought + never sold within window + still held</span>
                  <span className="mx-1">·</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30"><Flag className="h-2.5 w-2.5" /> First buy</span>
                  <span>= first BUY of this token</span>
                  <span className="mx-1">·</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/30">Holds X%</span>
                  <span>= partial hold remaining</span>
                  <span className="mx-1">·</span>
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30"><LogOut className="h-2.5 w-2.5" /> Exited</span>
                  <span>/ Closed = wallet has fully exited this token. Switch the window to 30d to surface older HODL purchases.</span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time (local)</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead className="text-right">{analysis.nativeSymbol} delta</TableHead>
                        <TableHead className="text-right">Notional USD</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Tx</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.trades.slice(0, 100).map((t, i) => {
                        const anno = tradeAnnotations.get(i);
                        const rowHighlight = anno?.hodl
                          ? "bg-amber-50/70 dark:bg-amber-900/15 border-l-2 border-l-amber-400 dark:border-l-amber-600"
                          : anno?.isFirstBuy
                            ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                            : anno?.isLastExit
                              ? "bg-rose-50/50 dark:bg-rose-900/10"
                              : "";
                        return (
                        <TableRow key={`${t.signature ?? i}-${i}`} className={rowHighlight}>
                          <TableCell className="whitespace-nowrap text-xs">{localTime(t.timestampMs)}</TableCell>
                          <TableCell>
                            <span
                              className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                t.action === "buy"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  : t.action === "sell"
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}
                            >
                              {t.action.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>{t.symbol ?? shorten(t.mint)}</span>
                              <button
                                type="button"
                                onClick={() => void copyAddress(t.mint, `t-${i}-${t.mint}`)}
                                className="text-zinc-400 hover:text-cyan-600 dark:hover:text-cyan-400"
                                title="Copy token address"
                              >
                                {copiedKey === `t-${i}-${t.mint}` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className={`text-right ${t.nativeDelta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {t.nativeDelta >= 0 ? "+" : ""}
                            {t.nativeDelta.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right">{fmtUsd(t.notionalUsd)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {anno?.hodl && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 text-slate-700 dark:text-slate-200 bg-amber-100 dark:bg-amber-900/30"
                                  title="Wallet bought this token and has not sold any of it within the analyzed window."
                                >
                                  <Anchor className="h-2.5 w-2.5" /> HODL · 100%
                                </span>
                              )}
                              {anno?.isFirstBuy && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30">
                                  <Flag className="h-2.5 w-2.5" /> First buy
                                </span>
                              )}
                              {anno?.isLastExit ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30" title="Last SELL that closed this position within the window.">
                                  <LogOut className="h-2.5 w-2.5" /> Exited
                                </span>
                              ) : anno?.isClosed ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20" title="Wallet has fully exited this token (sum of sells covered the holdings); this is one of the closing sells.">
                                  Closed
                                </span>
                              ) : null}
                              {!anno?.hodl && anno?.pctHeldNow !== null && anno?.pctHeldNow !== undefined && !anno.isLastExit && !anno.isClosed && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-900/30"
                                  title="Wallet still holds this token; percentage = current holding ÷ tokens received in window."
                                >
                                  Holds {Math.max(0, Math.min(100, anno.pctHeldNow)).toFixed(0)}%
                                </span>
                              )}
                              {!anno?.hodl && !anno?.isFirstBuy && !anno?.isLastExit && !anno?.isClosed && (anno?.pctHeldNow === null || anno?.pctHeldNow === undefined) && (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {t.signature ? (
                              <a
                                href={chainExplorerTxUrl(analysis.chain, t.signature)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </details>
            )}

            {analysis.trades.length === 0 && (
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="font-medium">No trades found in the last {analysis.period}.</p>
                <p className="mt-1 opacity-90">
                  This wallet may have an open position from before the current window, or hasn&apos;t traded recently.
                  Try a longer window (e.g. <strong>7 days</strong> or <strong>30 days</strong>) — buys / sells often sit outside short windows like 24h.
                </p>
              </div>
            )}

            {analysis.notes.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {analysis.notes.map((n, i) => (
                  <li key={`n-${i}`}>• {n}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

function Tile({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`text-base font-bold ${
          positive === undefined
            ? ""
            : positive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
