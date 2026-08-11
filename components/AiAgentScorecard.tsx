"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, MinusCircle, Pin, RotateCcw, XCircle } from "lucide-react";

export type AiAgentScorecardResult = {
  score: number;
  signal: "buy" | "no_buy";
  reasons: string[];
  narrativeAssessment?: string;
  amountRiskNote?: string;
  recommendations?: {
    supportResistance?: string;
    marketStructure?: string;
    priceOutlook?: string;
    directionBias?: string;
    trendlineRead?: string;
    demandSupplyZones?: string;
    buyZoneMcap?: string;
    takeProfitPct?: string;
    stopLossPct?: string;
  };
  tokenInfo: {
    symbol?: string;
    name?: string;
    contractAddress?: string;
    liquidityUsd?: number;
    volume24h?: number;
    priceUsd?: number | null;
    priceChange24hPct?: number;
    marketCapUsd?: number | null;
    hasTwitter?: boolean;
    hasTelegram?: boolean;
    hasWebsite?: boolean;
    securityIssues?: string[];
    securityWarnings?: string[];
    isHoneypot?: boolean | null;
    isMintable?: boolean | null;
    lpLocked?: boolean | null;
    topHolderPercent?: number | null;
    holderCount?: number | null;
  };
  ragEnabled?: boolean;
  ragUsed?: boolean;
  ragConfigured?: boolean;
  ragSnippets?: Array<{
    contractAddress: string;
    symbol?: string | null;
    score?: number | null;
    signal?: string | null;
    feedbackOutcome?: string | null;
    summaryText: string;
    similarity: number;
    sameToken?: boolean;
  }>;
};

function memePriceOutlookRaw(rec?: AiAgentScorecardResult["recommendations"]) {
  return (rec?.priceOutlook ?? rec?.directionBias)?.trim() || undefined;
}

function normalizeMemePriceOutlook(value?: string): "bullish" | "bearish" | "neutral" | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (/\bbull/.test(v)) return "bullish";
  if (/\bbear/.test(v)) return "bearish";
  if (/\bneutral|\bunclear|\bmixed/.test(v)) return "neutral";
  return null;
}

function scoreBand(score: number): {
  label: string;
  tone: string;
  stroke: string;
  summary: string;
} {
  if (score >= 76) {
    return {
      label: "Higher confidence",
      tone: "text-emerald-600 dark:text-emerald-400",
      stroke: "stroke-emerald-500",
      summary: "Metrics look comparatively stronger. Still size carefully — meme risk stays high.",
    };
  }
  if (score >= 51) {
    return {
      label: "Watch / moderate",
      tone: "text-cyan-600 dark:text-cyan-400",
      stroke: "stroke-cyan-500",
      summary: "Mixed picture. Worth watching, but wait for clearer confirmation before sizing up.",
    };
  }
  if (score >= 26) {
    return {
      label: "Risky",
      tone: "text-amber-600 dark:text-amber-400",
      stroke: "stroke-amber-500",
      summary: "Several weak or speculative factors. Treat as high-risk if you engage at all.",
    };
  }
  return {
    label: "High risk / avoid",
    tone: "text-rose-600 dark:text-rose-400",
    stroke: "stroke-rose-500",
    summary: "Multiple high-risk factors. Proceed with extreme caution or skip.",
  };
}

function fmtUsd(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

function ScoreGauge({ score, strokeClass }: { score: number; strokeClass: string }) {
  const clamped = Math.min(100, Math.max(0, score));
  const r = 54;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const offset = arc - (clamped / 100) * arc;
  return (
    <div className="relative mx-auto h-[132px] w-[160px]">
      <svg viewBox="0 0 140 110" className="h-full w-full" aria-hidden>
        <g transform="translate(70 72)">
          <circle
            r={r}
            fill="none"
            strokeWidth="12"
            className="stroke-zinc-200 dark:stroke-zinc-700"
            strokeDasharray={`${arc} ${c}`}
            strokeLinecap="round"
            transform="rotate(135)"
          />
          <circle
            r={r}
            fill="none"
            strokeWidth="12"
            className={strokeClass}
            strokeDasharray={`${arc} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(135)"
            style={{ transition: "stroke-dashoffset 700ms ease-out" }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <span className={`text-3xl font-black tabular-nums leading-none ${scoreBand(score).tone}`}>
          {clamped}
          <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">/100</span>
        </span>
      </div>
    </div>
  );
}

function CheckRow({
  ok,
  label,
  detail,
}: {
  ok: boolean | null | undefined;
  label: string;
  detail: string;
}) {
  const icon =
    ok === true ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
    ) : ok === false ? (
      <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
    ) : (
      <MinusCircle className="h-4 w-4 text-zinc-400 shrink-0" />
    );
  return (
    <li className="flex items-start gap-2 text-sm">
      {icon}
      <span>
        <span className="font-medium text-zinc-800 dark:text-zinc-100">{label}</span>
        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{detail}</span>
      </span>
    </li>
  );
}

type Props = {
  result: AiAgentScorecardResult;
  isOwner?: boolean;
  isVip?: boolean;
  /** Clear result and focus the CA field for another run */
  onCheckAnother?: () => void;
  /** Pin current token to monitoring board */
  onPin?: () => void;
  canPin?: boolean;
  pinSuccess?: string | null;
  actions?: ReactNode;
};

export default function AiAgentScorecard({
  result,
  isOwner,
  isVip,
  onCheckAnother,
  onPin,
  canPin,
  pinSuccess,
  actions,
}: Props) {
  const band = scoreBand(result.score);
  const info = result.tokenInfo ?? {};
  const issues = info.securityIssues ?? [];
  const warnings = info.securityWarnings ?? [];
  const outlookRaw = memePriceOutlookRaw(result.recommendations);
  const outlook = normalizeMemePriceOutlook(outlookRaw);
  const rec = result.recommendations;
  const hasLevels =
    !!rec &&
    !!(
      rec.supportResistance ||
      rec.marketStructure ||
      outlookRaw ||
      rec.trendlineRead ||
      rec.demandSupplyZones ||
      rec.buyZoneMcap ||
      rec.takeProfitPct ||
      rec.stopLossPct
    );

  const topPct = info.topHolderPercent;
  const topOk = topPct == null ? null : topPct < 20 ? true : topPct > 30 ? false : null;
  const isBuy = result.signal === "buy";
  const nextTitle = isBuy ? "Looks interesting — next step" : "Skip this one — next step";
  const nextBlurb = isBuy
    ? "Pin it for monitoring if you want alerts on the board. Still size small and manage risk."
    : "Clear skip. Check another contract address when you’re ready.";

  return (
    <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-700/90 bg-gradient-to-br from-white via-zinc-50 to-cyan-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-cyan-950/20 overflow-hidden shadow-sm shadow-zinc-900/5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-zinc-200/80 dark:border-zinc-700/80 bg-white/60 dark:bg-zinc-950/40">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 truncate">
                {info.symbol ?? "—"}
              </h3>
              {info.name && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400 truncate">{info.name}</span>
              )}
            </div>
            {info.contractAddress && (
              <p className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate mt-0.5 max-w-[min(100%,28rem)]">
                {info.contractAddress}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={`text-sm font-bold px-3 py-1 border-0 ${
                result.signal === "buy"
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-rose-500 text-white hover:bg-rose-600"
              }`}
            >
              {result.signal === "buy" ? "BUY" : "NO BUY"}
            </Badge>
            {outlook && (
              <Badge
                variant="outline"
                className={`text-sm font-semibold px-3 py-1 ${
                  outlook === "bullish"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300/60"
                    : outlook === "bearish"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300/60"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300/60"
                }`}
                title={outlookRaw}
              >
                Outlook: {outlook === "bullish" ? "Bullish" : outlook === "bearish" ? "Bearish" : "Neutral"}
              </Badge>
            )}
            {(isOwner || isVip) && result.ragEnabled && (
              <Badge
                variant="outline"
                className="text-sm font-semibold px-3 py-1 border-violet-400/60 bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
              >
                {result.ragUsed ? "Informed by your history" : "Personal context active"}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[180px_1fr_1fr]">
          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-950/50 p-3 text-center">
            <ScoreGauge score={result.score} strokeClass={band.stroke} />
            <p className={`text-sm font-semibold ${band.tone}`}>{band.label}</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{band.summary}</p>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-950/50 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Risk factors
            </p>
            {issues.length === 0 && warnings.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                No critical GoPlus flags on this pass. Still verify before sizing.
              </p>
            ) : (
              <ul className="space-y-2">
                {issues.map((issue) => (
                  <li
                    key={issue}
                    className="flex items-start gap-2 rounded-lg border border-rose-200/80 dark:border-rose-800/60 bg-rose-50/80 dark:bg-rose-950/30 px-3 py-2 text-sm text-rose-800 dark:text-rose-200"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {issue.replace(/^🚨\s*/, "")}
                  </li>
                ))}
                {warnings.map((w) => (
                  <li
                    key={w}
                    className="flex items-start gap-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {w.replace(/^⚠️\s*/, "")}
                  </li>
                ))}
              </ul>
            )}
            <details className="text-xs text-zinc-500 dark:text-zinc-400">
              <summary className="cursor-pointer font-medium text-zinc-600 dark:text-zinc-300">Why 0–100?</summary>
              <p className="mt-1.5 leading-relaxed">
                Score weighs liquidity, volume, security, socials, and narrative strength. 76+ = higher confidence;
                51–75 = watch; 26–50 = risky; 0–25 = avoid / very new. Snapshot only — DYOR.
              </p>
            </details>
          </div>

          <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-950/50 p-4 space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                Security checks
              </p>
              <ul className="space-y-2">
                <CheckRow
                  ok={info.isHoneypot == null ? null : !info.isHoneypot}
                  label="Honeypot"
                  detail={
                    info.isHoneypot == null
                      ? "Check unavailable"
                      : info.isHoneypot
                        ? "Flagged — cannot sell safely"
                        : "Not flagged as honeypot"
                  }
                />
                <CheckRow
                  ok={info.isMintable == null ? null : !info.isMintable}
                  label="Mint authority"
                  detail={
                    info.isMintable == null
                      ? "Check unavailable"
                      : info.isMintable
                        ? "Still mintable"
                        : "Not flagged mintable"
                  }
                />
                <CheckRow
                  ok={info.lpLocked}
                  label="LP locked"
                  detail={
                    info.lpLocked == null
                      ? "Could not confirm LP lock"
                      : info.lpLocked
                        ? "Top LP looks burned / locked"
                        : "LP not clearly locked"
                  }
                />
                <CheckRow
                  ok={topOk}
                  label="Top holder"
                  detail={
                    topPct == null
                      ? "Holder share unavailable"
                      : `${topPct.toFixed(1)}% of supply${
                          topPct > 30 ? " — concentrated" : topPct < 20 ? " — healthier" : " — watch"
                        }`
                  }
                />
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                Socials
              </p>
              <ul className="space-y-2">
                <CheckRow
                  ok={info.hasWebsite}
                  label="Website"
                  detail={info.hasWebsite ? "Linked on DexScreener" : "Not found"}
                />
                <CheckRow
                  ok={info.hasTwitter}
                  label="Twitter / X"
                  detail={info.hasTwitter ? "Linked on DexScreener" : "Not found"}
                />
                <CheckRow
                  ok={info.hasTelegram}
                  label="Telegram"
                  detail={info.hasTelegram ? "Linked on DexScreener" : "Not found"}
                />
              </ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-zinc-200/70 dark:bg-zinc-700/60 border-t border-zinc-200/80 dark:border-zinc-700/80">
          {[
            { label: "Liquidity", value: fmtUsd(info.liquidityUsd) },
            { label: "Vol 24h", value: fmtUsd(info.volume24h) },
            {
              label: "Market cap",
              value: fmtUsd(info.marketCapUsd ?? undefined),
            },
            {
              label: "Price",
              value: fmtPrice(info.priceUsd),
              sub:
                info.priceChange24hPct != null
                  ? `${info.priceChange24hPct >= 0 ? "+" : ""}${info.priceChange24hPct.toFixed(1)}% 24h`
                  : undefined,
              subTone:
                info.priceChange24hPct == null
                  ? undefined
                  : info.priceChange24hPct >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
            },
          ].map((cell) => (
            <div key={cell.label} className="bg-white/90 dark:bg-zinc-950/70 px-3 py-3 sm:px-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {cell.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{cell.value}</p>
              {"sub" in cell && cell.sub && (
                <p className={`text-[11px] tabular-nums ${cell.subTone ?? "text-zinc-500"}`}>{cell.sub}</p>
              )}
            </div>
          ))}
        </div>

        {(info.holderCount != null || topPct != null) && (
          <div className="px-4 sm:px-5 py-2 border-t border-zinc-200/70 dark:border-zinc-700/70 text-xs text-zinc-500 dark:text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
            {info.holderCount != null && <span>Holders: {info.holderCount.toLocaleString()}</span>}
            {topPct != null && <span>Top holder: {topPct.toFixed(1)}%</span>}
          </div>
        )}
      </div>

      {isOwner && result.ragEnabled && !result.ragConfigured && (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Personal context is enabled but OPENAI_API_KEY is not set — analysis ran without retrieval.
        </p>
      )}
      {(isOwner || isVip) && result.ragEnabled && result.ragConfigured && !result.ragUsed && (
        <p className="text-xs text-violet-700 dark:text-violet-300">
          Your analysis history is building — after a few runs, similar tokens will inform new scores.
        </p>
      )}
      {(isOwner || isVip) && result.ragUsed && (result.ragSnippets?.length ?? 0) > 0 && (
        <details className="rounded-xl border border-violet-200/80 dark:border-violet-800/80 bg-violet-50/40 dark:bg-violet-950/20 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-violet-800 dark:text-violet-200">
            Your similar past analyses ({result.ragSnippets!.length})
          </summary>
          <ul className="mt-2 space-y-2 text-violet-900/90 dark:text-violet-100/90">
            {result.ragSnippets!.map((s, i) => (
              <li key={`${s.contractAddress}-${i}`} className="text-xs leading-relaxed">
                <span className="font-medium">{s.symbol ?? s.contractAddress.slice(0, 8)}</span>
                {s.score != null && ` · score ${s.score}`}
                {s.signal && ` · ${s.signal}`}
                {s.feedbackOutcome && ` · feedback: ${s.feedbackOutcome}`}
                {s.sameToken && " · same token"}
                {" · "}
                {(s.similarity * 100).toFixed(0)}% match
                <span className="block text-muted-foreground mt-0.5">{s.summaryText}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.narrativeAssessment && (
        <div className="rounded-xl border border-violet-200/80 dark:border-violet-800/80 bg-violet-50/50 dark:bg-violet-950/30 p-4 text-sm">
          <p className="font-medium text-violet-800 dark:text-violet-200">AI summary · Narrative</p>
          <p className="mt-1 text-violet-700 dark:text-violet-300 leading-relaxed">{result.narrativeAssessment}</p>
        </div>
      )}

      {result.amountRiskNote && (
        <div className="rounded-xl border border-cyan-500/25 dark:border-cyan-600/35 bg-slate-50/90 dark:bg-slate-900/60 p-4 text-sm">
          <p className="font-medium text-slate-700 dark:text-slate-200">Amount vs risk</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">{result.amountRiskNote}</p>
        </div>
      )}

      {hasLevels && rec && (
        <div className="rounded-xl border border-cyan-200/80 dark:border-cyan-800/80 bg-cyan-50/50 dark:bg-cyan-950/30 p-4 space-y-2 text-sm">
          <p className="font-semibold text-cyan-800 dark:text-cyan-200">
            Trading levels (meme coins are volatile — use risk management)
          </p>
          {rec.supportResistance && (
            <p>
              <span className="text-muted-foreground">Support / Resistance:</span> {rec.supportResistance}
            </p>
          )}
          {rec.marketStructure && (
            <p>
              <span className="text-muted-foreground">Market structure:</span> {rec.marketStructure}
            </p>
          )}
          {outlookRaw && (
            <p>
              <span className="text-muted-foreground">Price outlook:</span> {outlookRaw}
            </p>
          )}
          {rec.trendlineRead && (
            <p>
              <span className="text-muted-foreground">Trendline read:</span> {rec.trendlineRead}
            </p>
          )}
          {rec.demandSupplyZones && (
            <p>
              <span className="text-muted-foreground">Demand / Supply zones:</span> {rec.demandSupplyZones}
            </p>
          )}
          {rec.buyZoneMcap && (
            <p>
              <span className="text-muted-foreground">Buy zone (mcap):</span> {rec.buyZoneMcap}
            </p>
          )}
          {rec.takeProfitPct && (
            <p>
              <span className="text-emerald-600 dark:text-emerald-400">Take profit:</span> {rec.takeProfitPct}
            </p>
          )}
          {rec.stopLossPct && (
            <p>
              <span className="text-rose-600 dark:text-rose-400">Stop loss:</span> {rec.stopLossPct}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
          Key reasons
        </p>
        <ul className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
          {result.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-cyan-500 shrink-0">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {(onCheckAnother || onPin) && (
        <div
          className={`rounded-xl border p-4 sm:p-5 space-y-3 ${
            isBuy
              ? "border-emerald-300/70 dark:border-emerald-700/50 bg-gradient-to-br from-emerald-50/90 via-white to-cyan-50/50 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-cyan-950/20"
              : "border-zinc-300/80 dark:border-zinc-600/70 bg-gradient-to-br from-zinc-100/90 via-white to-amber-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-amber-950/20"
          }`}
        >
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{nextTitle}</p>
            <p className="mt-0.5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{nextBlurb}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onCheckAnother && (
              <Button
                type="button"
                variant={isBuy ? "outline" : "default"}
                size="sm"
                onClick={onCheckAnother}
                className={
                  isBuy
                    ? "border-zinc-300 dark:border-zinc-600"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900"
                }
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                {isBuy ? "Check another CA" : "Skip & check another"}
              </Button>
            )}
            {canPin && onPin && (
              <Button
                type="button"
                variant={isBuy ? "default" : "outline"}
                size="sm"
                onClick={onPin}
                className={
                  isBuy
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50"
                }
              >
                <Pin className="h-3.5 w-3.5 mr-1.5" />
                Pin for monitoring
              </Button>
            )}
          </div>
          {pinSuccess && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{pinSuccess}</p>
          )}
        </div>
      )}

      {actions}
    </div>
  );
}
