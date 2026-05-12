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
import {
  Bot,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Wand2,
  Plus,
  ChevronDown,
  Flame,
  Globe,
  Skull,
  Anchor,
  Star,
  Search,
} from "lucide-react";

type Chain = "solana" | "bsc" | "ethereum";
type ChainInput = Chain | "auto";

type SecurityFlag = {
  key: string;
  label: string;
  level: "good" | "warn" | "bad" | "info";
  value?: string;
};

type HolderClass =
  | "dev"
  | "lp"
  | "exchange"
  | "burn"
  | "contract"
  | "whale"
  | "sniper"
  | "bot"
  | "pro"
  | "fresh"
  | "holder";

type AnalyzedHolder = {
  rank: number;
  address: string;
  tokenAccount?: string | null;
  tag: string | null;
  isContract: boolean;
  balance: number | null;
  balanceFormatted: string;
  percentOfSupply: number;
  isLocked: boolean;
  classes: HolderClass[];
  reasons: string[];
};

type DeepReport = {
  ok: true;
  chain: Chain;
  contract: string;
  token: {
    name: string | null;
    symbol: string | null;
    priceUsd: number | null;
    marketCapUsd: number | null;
    fdvUsd: number | null;
    liquidityUsd: number | null;
    volume24hUsd: number | null;
    txns24h: { buys: number; sells: number } | null;
    priceChange24hPct: number | null;
    pairCreatedAtMs: number | null;
    dexUrl: string | null;
    pairAddress: string | null;
    socials: { website: string | null; twitter: string | null; telegram: string | null };
  };
  security: {
    flags: SecurityFlag[];
    isHoneypotLikely: boolean;
    isRugLikely: boolean;
    lpLocked: boolean;
    lpBurnedOrLocked: boolean;
    topTenSharePct: number | null;
    holderCount: number | null;
    devWallet: string | null;
    ownerWallet: string | null;
    mintAuthority?: string | null;
    freezeAuthority?: string | null;
  };
  holders: AnalyzedHolder[];
  lpHolders: AnalyzedHolder[];
  recommendation: {
    verdict: "good_buy" | "speculative" | "caution" | "avoid";
    score: number;
    summary: string;
    pros: string[];
    cons: string[];
  };
  sources: { dexscreener: boolean; goplus: boolean; helius: boolean };
  notes: string[];
  generatedAtMs: number;
};

const CHAIN_OPTIONS: { value: ChainInput; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "solana", label: "Solana" },
  { value: "bsc", label: "BSC" },
  { value: "ethereum", label: "Ethereum" },
];

function fmtUsd(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(6)}`;
}

function fmtPct(v: number | null | undefined, signed = false) {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function fmtAge(ms: number | null | undefined) {
  if (ms == null) return "—";
  const days = (Date.now() - ms) / 86_400_000;
  if (days < 1) return `${Math.max(0, Math.floor(days * 24))}h`;
  if (days < 30) return `${Math.floor(days)}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

function shorten(addr: string, n = 4) {
  if (!addr || addr.length < n * 2 + 2) return addr;
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
}

function StyledSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = options.find((p) => p.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm flex items-center justify-between gap-2 text-zinc-900 dark:text-zinc-100"
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
          {options.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                onChange(p.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                p.value === value
                  ? "bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-medium"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassBadge({ c }: { c: HolderClass }) {
  const map: Record<HolderClass, { label: string; cls: string; icon?: React.ReactNode }> = {
    dev: { label: "Dev", cls: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800", icon: <Anchor className="h-3 w-3" /> },
    lp: { label: "LP", cls: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800" },
    exchange: { label: "CEX", cls: "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700" },
    burn: { label: "Burn", cls: "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800", icon: <Flame className="h-3 w-3" /> },
    contract: { label: "Contract", cls: "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700" },
    whale: { label: "Whale", cls: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" },
    sniper: { label: "Sniper / Bot", cls: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800", icon: <Bot className="h-3 w-3" /> },
    bot: { label: "Bot", cls: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800", icon: <Bot className="h-3 w-3" /> },
    pro: { label: "Pro trader", cls: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", icon: <Star className="h-3 w-3" /> },
    fresh: { label: "Fresh wallet", cls: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800" },
    holder: { label: "Holder", cls: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700" },
  };
  const m = map[c];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

function VerdictBadge({ verdict, score }: { verdict: DeepReport["recommendation"]["verdict"]; score: number }) {
  const map: Record<DeepReport["recommendation"]["verdict"], { label: string; cls: string; icon: React.ReactNode }> = {
    good_buy: { label: "Good buy", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: <ShieldCheck className="h-4 w-4" /> },
    speculative: { label: "Speculative", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: <AlertTriangle className="h-4 w-4" /> },
    caution: { label: "Caution", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30", icon: <ShieldAlert className="h-4 w-4" /> },
    avoid: { label: "Avoid", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30", icon: <Skull className="h-4 w-4" /> },
  };
  const m = map[verdict];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${m.cls}`}>
      {m.icon}
      {m.label}
      <span className="ml-1 opacity-80 text-xs">· {score}/100</span>
    </span>
  );
}

function FlagPill({ f }: { f: SecurityFlag }) {
  const cls = {
    good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    bad: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    info: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  }[f.level];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      {f.label}
      {f.value && <span className="opacity-80 ml-1">{f.value}</span>}
    </span>
  );
}

export type DeepMemeAgentPanelProps = {
  /** When the user clicks "Analyze" on a holder, parent should switch to the Meme Coin Advantage Bundle tab and pre-fill the address. */
  onAnalyzeWallet?: (address: string, chain: Chain) => void;
};

export default function DeepMemeAgentPanel({ onAnalyzeWallet }: DeepMemeAgentPanelProps) {
  const [contract, setContract] = useState("");
  const [chain, setChain] = useState<ChainInput>("auto");
  const [report, setReport] = useState<DeepReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [busyAddress, setBusyAddress] = useState<string | null>(null);
  const [trackMsg, setTrackMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wallet-tracker/deep-meme-agent/access", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setLocked(!!d?.locked);
        setDisabled(!!d?.disabled);
        if (!d?.success) setError(d?.error ?? null);
        setAccessChecked(true);
      })
      .catch(() => setAccessChecked(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const runReport = useCallback(async () => {
    const c = contract.trim();
    if (!c) {
      setError("Paste a contract address first.");
      return;
    }
    setLoading(true);
    setError(null);
    setReport(null);
    setTrackMsg(null);
    try {
      const res = await fetch("/api/wallet-tracker/deep-meme-agent/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract: c, chain }),
      });
      const d = (await res.json()) as { success?: boolean; error?: string; report?: DeepReport };
      if (!d.success || !d.report) {
        setError(d.error ?? "Analysis failed.");
        return;
      }
      setReport(d.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }, [contract, chain]);

  const trackWallet = useCallback(async (address: string, chainOfWallet: Chain, label?: string | null) => {
    setBusyAddress(address);
    setTrackMsg(null);
    try {
      const body = {
        address,
        chain: chainOfWallet === "solana" ? "solana" : "bsc",
        nickname: label ?? null,
      };
      const res = await fetch("/api/wallet-tracker/meme-leaderboard/my-wallets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json()) as { success?: boolean; error?: string };
      if (!d.success) setTrackMsg(d.error ?? "Failed to add wallet.");
      else setTrackMsg(`Tracked ${shorten(address)} · check Meme Coin Advantage Bundle.`);
    } catch (e) {
      setTrackMsg(e instanceof Error ? e.message : "Failed to add wallet.");
    } finally {
      setBusyAddress(null);
    }
  }, []);

  const copyToClipboard = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    } catch {
      /* ignore */
    }
  }, []);

  const explorerBase = useMemo(() => {
    if (!report) return null;
    if (report.chain === "solana") return "https://solscan.io/account";
    if (report.chain === "bsc") return "https://bscscan.com/address";
    return "https://etherscan.io/address";
  }, [report]);

  const tokenExplorerUrl = useMemo(() => {
    if (!report) return null;
    if (report.chain === "solana") return `https://solscan.io/token/${report.contract}`;
    if (report.chain === "bsc") return `https://bscscan.com/token/${report.contract}`;
    return `https://etherscan.io/token/${report.contract}`;
  }, [report]);

  const canTrack = report && (report.chain === "solana" || report.chain === "bsc");

  if (accessChecked && (locked || disabled) && !report) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Bot className="h-10 w-10 text-violet-500 mb-3" />
        <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          {disabled ? "Deep Meme Agent is disabled by admin." : "VIP required for Deep Meme Agent."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          {disabled
            ? "Owner can re-enable this in Nova Admin → Feature flags."
            : "Upgrade to VIP to scan any Solana, BSC, or Ethereum contract for honeypot/rug risk, security flags, top holders, dev wallet, and a buy / avoid verdict."}
        </p>
        {!disabled && (
          <Button asChild className="mt-6 bg-amber-500 hover:bg-amber-600 text-white">
            <a href="/subscribe">Upgrade to VIP</a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-violet-200/60 dark:border-violet-800/60 bg-white/95 dark:bg-zinc-900/80">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                Deep Meme Agent
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Paste any Solana, BSC, or Ethereum meme contract. Free APIs: Dexscreener · GoPlus Security · Helius.
                Get holder breakdown, dev wallet, honeypot / rug check, and a buy / avoid verdict.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="md:col-span-8">
              <input
                type="text"
                className="w-full h-10 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 text-sm font-mono"
                placeholder="Contract address (Solana base58 or 0x… for BSC / Ethereum)"
                value={contract}
                onChange={(e) => setContract(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runReport();
                  }
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
            <div className="md:col-span-2">
              <StyledSelect<ChainInput>
                value={chain}
                options={CHAIN_OPTIONS}
                onChange={(v) => setChain(v)}
              />
            </div>
            <div className="md:col-span-2">
              <Button
                type="button"
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => void runReport()}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Search className="h-4 w-4 mr-2 animate-pulse" /> Running…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" /> Run report
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}
          {trackMsg && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-200">
              {trackMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {report && (
        <div className="space-y-4">
          <Card className="border-zinc-200/70 dark:border-zinc-700/70">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    {report.token.symbol ?? "Token"} <span className="text-muted-foreground text-sm">{report.token.name ?? ""}</span>
                  </CardTitle>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    {report.chain.toUpperCase()}
                  </span>
                </div>
                <VerdictBadge verdict={report.recommendation.verdict} score={report.recommendation.score} />
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs flex-wrap">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-mono text-cyan-700 dark:text-cyan-300 hover:underline"
                  onClick={() => copyToClipboard(`contract-${report.contract}`, report.contract)}
                  title="Copy contract"
                >
                  {shorten(report.contract, 6)}
                  {copiedKey === `contract-${report.contract}` ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-70" />
                  )}
                </button>
                {tokenExplorerUrl && (
                  <a href={tokenExplorerUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:underline">
                    Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {report.token.dexUrl && (
                  <a href={report.token.dexUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:underline">
                    Dexscreener <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {report.token.socials.website && (
                  <a href={report.token.socials.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:underline">
                    <Globe className="h-3 w-3" /> Website
                  </a>
                )}
                {report.token.socials.twitter && (
                  <a href={report.token.socials.twitter} target="_blank" rel="noopener noreferrer" className="text-zinc-600 dark:text-zinc-400 hover:underline">Twitter</a>
                )}
                {report.token.socials.telegram && (
                  <a href={report.token.socials.telegram} target="_blank" rel="noopener noreferrer" className="text-zinc-600 dark:text-zinc-400 hover:underline">Telegram</a>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Price" value={fmtUsd(report.token.priceUsd)} />
                <Stat label="Liquidity" value={fmtUsd(report.token.liquidityUsd)} />
                <Stat label="24h Volume" value={fmtUsd(report.token.volume24hUsd)} />
                <Stat label="FDV / MCap" value={fmtUsd(report.token.marketCapUsd)} />
                <Stat
                  label="24h change"
                  value={fmtPct(report.token.priceChange24hPct, true)}
                  valueClass={(report.token.priceChange24hPct ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
                />
                <Stat label="Pair age" value={fmtAge(report.token.pairCreatedAtMs)} />
                <Stat label="Holders" value={report.security.holderCount?.toLocaleString() ?? "—"} />
                <Stat label="Top-10 share" value={fmtPct(report.security.topTenSharePct)} />
                <Stat
                  label="Honeypot"
                  value={report.security.isHoneypotLikely ? "Yes" : report.chain === "solana" ? "n/a" : "No"}
                  valueClass={
                    report.security.isHoneypotLikely
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }
                />
                <Stat
                  label="LP locked / burned"
                  value={report.security.lpBurnedOrLocked ? "Yes" : "No"}
                  valueClass={
                    report.security.lpBurnedOrLocked
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }
                />
                <Stat
                  label="Buys / Sells (24h)"
                  value={
                    report.token.txns24h
                      ? `${report.token.txns24h.buys} / ${report.token.txns24h.sells}`
                      : "—"
                  }
                />
                <Stat
                  label="Source"
                  value={[
                    report.sources.dexscreener ? "Dex" : null,
                    report.sources.goplus ? "GoPlus" : null,
                    report.sources.helius ? "Helius" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                />
              </div>

              <div className="rounded-lg border border-zinc-200/70 dark:border-zinc-700/70 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-medium">{report.recommendation.summary}</p>
                  <span className="text-xs text-muted-foreground">Verdict score: {report.recommendation.score}/100</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Pros</p>
                    {report.recommendation.pros.length === 0 ? (
                      <p className="text-xs text-muted-foreground">—</p>
                    ) : (
                      <ul className="text-xs space-y-1">
                        {report.recommendation.pros.map((p, i) => (
                          <li key={i} className="text-zinc-700 dark:text-zinc-300">• {p}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 mb-1">Cons</p>
                    {report.recommendation.cons.length === 0 ? (
                      <p className="text-xs text-muted-foreground">—</p>
                    ) : (
                      <ul className="text-xs space-y-1">
                        {report.recommendation.cons.map((p, i) => (
                          <li key={i} className="text-zinc-700 dark:text-zinc-300">• {p}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold mb-1">Security flags</p>
                {report.security.flags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No security flags reported.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {report.security.flags.map((f) => (
                      <FlagPill key={f.key} f={f} />
                    ))}
                  </div>
                )}
              </div>

              {(report.security.devWallet || report.security.ownerWallet || report.security.mintAuthority || report.security.freezeAuthority) && (
                <div className="rounded-lg border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-900/10 p-3 text-xs space-y-1">
                  <p className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                    <Anchor className="h-3 w-3" /> Dev / authority wallets
                  </p>
                  {report.security.devWallet && (
                    <AuthorityLine label="Creator" address={report.security.devWallet} explorerBase={explorerBase} onCopy={(k, v) => copyToClipboard(k, v)} copiedKey={copiedKey} />
                  )}
                  {report.security.ownerWallet && report.security.ownerWallet.toLowerCase() !== (report.security.devWallet ?? "").toLowerCase() && (
                    <AuthorityLine label="Owner" address={report.security.ownerWallet} explorerBase={explorerBase} onCopy={(k, v) => copyToClipboard(k, v)} copiedKey={copiedKey} />
                  )}
                  {report.security.mintAuthority && (
                    <AuthorityLine label="Mint authority" address={report.security.mintAuthority} explorerBase={explorerBase} onCopy={(k, v) => copyToClipboard(k, v)} copiedKey={copiedKey} />
                  )}
                  {report.security.freezeAuthority && (
                    <AuthorityLine label="Freeze authority" address={report.security.freezeAuthority} explorerBase={explorerBase} onCopy={(k, v) => copyToClipboard(k, v)} copiedKey={copiedKey} />
                  )}
                </div>
              )}

              {report.notes.length > 0 && (
                <div className="text-[11px] text-muted-foreground italic">
                  {report.notes.map((n, i) => (
                    <p key={i}>• {n}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200/70 dark:border-zinc-700/70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top holders ({report.holders.length})</CardTitle>
              <p className="text-xs text-muted-foreground">
                Labels: <ClassBadge c="dev" /> creator/owner · <ClassBadge c="lp" /> liquidity pool · <ClassBadge c="exchange" /> CEX wallet ·
                {" "}<ClassBadge c="whale" /> ≥5% supply · <ClassBadge c="sniper" /> top-3 launch holder · <ClassBadge c="burn" /> burn ·
                {" "}<ClassBadge c="contract" /> smart contract · <ClassBadge c="holder" /> normal holder.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-zinc-200/70 dark:border-zinc-700/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">% supply</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.holders.map((h) => {
                      const isBurnOrLpOrEx = h.classes.some((c) => c === "burn" || c === "lp" || c === "exchange" || c === "contract");
                      const explorerUrl = explorerBase ? `${explorerBase}/${h.address}` : null;
                      return (
                        <TableRow key={`${h.rank}-${h.address}`}>
                          <TableCell className="text-xs">{h.rank}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-xs">
                              {explorerUrl ? (
                                <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan-700 dark:text-cyan-300 hover:underline">
                                  {shorten(h.address, 6)}
                                </a>
                              ) : (
                                <span className="font-mono">{shorten(h.address, 6)}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(`holder-${h.address}`, h.address)}
                                title="Copy address"
                                className="opacity-70 hover:opacity-100"
                              >
                                {copiedKey === `holder-${h.address}` ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            </div>
                            {h.reasons.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{h.reasons.slice(0, 2).join(" · ")}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {h.classes.map((c) => (
                                <ClassBadge key={c} c={c} />
                              ))}
                              {h.tag && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                                  {h.tag}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono">{h.balanceFormatted}</TableCell>
                          <TableCell className="text-right text-xs">{fmtPct(h.percentOfSupply)}</TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              {canTrack && !isBurnOrLpOrEx && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => trackWallet(h.address, report.chain, h.classes.includes("dev") ? "Dev" : h.tag)}
                                  disabled={busyAddress === h.address}
                                  title="Add to my tracked wallets"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  {busyAddress === h.address ? "Adding…" : "Track"}
                                </Button>
                              )}
                              {canTrack && !isBurnOrLpOrEx && (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] bg-violet-600 hover:bg-violet-700 text-white"
                                  onClick={() => onAnalyzeWallet?.(h.address, report.chain)}
                                  title="Analyze this wallet in the Meme Coin Advantage Bundle"
                                >
                                  <Wand2 className="h-3 w-3 mr-1" />
                                  Analyze
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {report.lpHolders.length > 0 && (
            <Card className="border-zinc-200/70 dark:border-zinc-700/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">LP holders ({report.lpHolders.length})</CardTitle>
                <p className="text-xs text-muted-foreground">If most LP is burned or locked, rug risk drops significantly.</p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-zinc-200/70 dark:border-zinc-700/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>LP Wallet</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead className="text-right">% LP supply</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.lpHolders.map((h) => {
                        const explorerUrl = explorerBase ? `${explorerBase}/${h.address}` : null;
                        return (
                          <TableRow key={`${h.rank}-${h.address}`}>
                            <TableCell className="text-xs">{h.rank}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs">
                                {explorerUrl ? (
                                  <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan-700 dark:text-cyan-300 hover:underline">
                                    {shorten(h.address, 6)}
                                  </a>
                                ) : (
                                  <span className="font-mono">{shorten(h.address, 6)}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`lp-${h.address}`, h.address)}
                                  title="Copy LP address"
                                  className="opacity-70 hover:opacity-100"
                                >
                                  {copiedKey === `lp-${h.address}` ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {h.classes.includes("burn") ? "Burned" : h.isLocked ? "Locked" : h.tag ?? "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">{fmtPct(h.percentOfSupply)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-md border border-zinc-200/70 dark:border-zinc-700/70 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${valueClass ?? ""}`}>{value}</p>
    </div>
  );
}

function AuthorityLine({
  label,
  address,
  explorerBase,
  onCopy,
  copiedKey,
}: {
  label: string;
  address: string;
  explorerBase: string | null;
  onCopy: (k: string, v: string) => void;
  copiedKey: string | null;
}) {
  const key = `auth-${label}-${address}`;
  const url = explorerBase ? `${explorerBase}/${address}` : null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{label}:</span>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan-700 dark:text-cyan-300 hover:underline">
          {shorten(address, 6)}
        </a>
      ) : (
        <span className="font-mono">{shorten(address, 6)}</span>
      )}
      <button type="button" onClick={() => onCopy(key, address)} title="Copy" className="opacity-70 hover:opacity-100">
        {copiedKey === key ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
