"use client";

import { Copy, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type ChartAnalysisType = "perp" | "meme";

export type ChartAnalysisResult = {
  chartType?: ChartAnalysisType;
  score: number;
  signal: "buy" | "no_buy";
  tradeDirection?: "long" | "short";
  reasons: string[];
  recommendations?: {
    supportResistance?: string;
    marketStructure?: string;
    entryZone?: string;
    takeProfitPct?: string;
    stopLossPct?: string;
  };
  marketRead?: {
    direction: "bullish" | "bearish" | "sideways";
    headline: string;
    bullets: string[];
  } | null;
};

type Props = {
  chartType: ChartAnalysisType;
  onChartTypeChange: (value: ChartAnalysisType) => void;
  chartPreview: string | null;
  onChartChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  symbol: string;
  onSymbolChange: (value: string) => void;
  margin: string;
  onMarginChange: (value: string) => void;
  leverage: string;
  onLeverageChange: (value: string) => void;
  direction: "long" | "short" | "";
  onDirectionChange: (value: "long" | "short" | "") => void;
  chartTimeframe: string;
  onChartTimeframeChange: (value: string) => void;
  tradeTimeframe: string;
  onTradeTimeframeChange: (value: string) => void;
  riskAmount: string;
  onRiskAmountChange: (value: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  analyzeDisabled?: boolean;
  error: string | null;
  result: ChartAnalysisResult | null;
  isOwner: boolean;
  isCoachUser: boolean;
  copied: boolean;
  onCopied: () => void;
  shareLoading: boolean;
  shareSuccess: boolean;
  onShare: () => void;
  feedbackSent: "good" | "bad" | null;
  feedbackLoading: boolean;
  feedbackNote: string;
  onFeedbackNoteChange: (value: string) => void;
  onFeedback: (outcome: "good" | "bad") => void;
};

function formatForShare(
  r: ChartAnalysisResult,
  symbol: string,
  chartTimeframe: string,
  tradeTimeframe: string,
  leverage: string
) {
  const sym = symbol.trim() || "—";
  const dir = r.tradeDirection ? ` (${r.tradeDirection})` : "";
  const title = `Chart: ${sym} · ${r.score}/100 · ${r.signal === "buy" ? "BUY" : "NO BUY"}${dir}`;
  const lines: string[] = [];
  lines.push(`📊 ${r.score}/100 · ${r.signal === "buy" ? "🟢 BUY" : "🔴 NO BUY"}${r.tradeDirection ? ` · ${r.tradeDirection.toUpperCase()}` : ""}`);
  lines.push(`📌 Symbol: ${sym}`);
  if (chartTimeframe.trim()) lines.push(`⏱ Chart TF: ${chartTimeframe.trim()}`);
  if (tradeTimeframe.trim()) lines.push(`⏱ Trade TF: ${tradeTimeframe.trim()}`);
  if (leverage.trim()) lines.push(`📐 Leverage: ${leverage}x`);
  lines.push("");
  const rec = r.recommendations;
  if (rec && (rec.supportResistance || rec.marketStructure || rec.entryZone || rec.takeProfitPct || rec.stopLossPct)) {
    lines.push("📐 Trading levels (futures — use risk management)");
    if (rec.supportResistance) lines.push(`  📍 Support / Resistance: ${rec.supportResistance}`);
    if (rec.marketStructure) lines.push(`  📈 Market structure: ${rec.marketStructure}`);
    if (rec.entryZone) lines.push(`  🎯 Entry zone: ${rec.entryZone}`);
    if (rec.takeProfitPct) lines.push(`  ✅ Take profit: ${rec.takeProfitPct}`);
    if (rec.stopLossPct) lines.push(`  🛑 Stop loss: ${rec.stopLossPct}`);
    lines.push("");
  }
  r.reasons.forEach((reason) => lines.push(`• ${reason}`));
  return { title, content: lines.join("\n") };
}

export default function AiChartAnalysisPanel({
  chartType,
  onChartTypeChange,
  chartPreview,
  onChartChange,
  symbol,
  onSymbolChange,
  margin,
  onMarginChange,
  leverage,
  onLeverageChange,
  direction,
  onDirectionChange,
  chartTimeframe,
  onChartTimeframeChange,
  tradeTimeframe,
  onTradeTimeframeChange,
  riskAmount,
  onRiskAmountChange,
  onAnalyze,
  loading,
  analyzeDisabled = false,
  error,
  result,
  isOwner,
  isCoachUser,
  copied,
  onCopied,
  shareLoading,
  shareSuccess,
  onShare,
  feedbackSent,
  feedbackLoading,
  feedbackNote,
  onFeedbackNoteChange,
  onFeedback,
}: Props) {
  const isMeme = chartType === "meme";
  const resultIsMeme = result?.chartType === "meme" || (result && !result.tradeDirection && isMeme);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-blue-300 dark:to-cyan-400">
        Trade with Confidence using NovaStaris Advanced AI System
      </h2>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          type="button"
          variant={chartType === "perp" ? "default" : "outline"}
          size="sm"
          className={chartType === "perp" ? "bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600" : ""}
          onClick={() => onChartTypeChange("perp")}
        >
          Perp chart
        </Button>
        <Button
          type="button"
          variant={chartType === "meme" ? "default" : "outline"}
          size="sm"
          className={chartType === "meme" ? "bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-600" : ""}
          onClick={() => onChartTypeChange("meme")}
        >
          Meme coin chart
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {isMeme
          ? "Upload a meme coin screenshot from Dexscreener, Axiom, pump.fun, or similar. Spot analysis only — buy or wait, no shorting. Leverage is optional."
          : "Upload a perp/futures chart from TradingView, Blofin, Hyperliquid, or similar. Long/short analysis with leverage and margin."}
      </p>
      <div className="space-y-4">
        <div>
          <label htmlFor="ai-agent-chart" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chart image (required)</label>
          <input
            id="ai-agent-chart"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onChartChange}
            className="block w-full text-sm text-zinc-600 dark:text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:text-cyan-700 dark:file:bg-cyan-950/50 dark:file:text-cyan-300"
          />
          {chartPreview && (
            <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden max-h-48">
              <img src={chartPreview} alt="Chart preview" className="w-full h-auto object-contain max-h-48" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ai-agent-symbol" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{isMeme ? "Token symbol (required)" : "Symbol (required)"}</label>
            <input
              id="ai-agent-symbol"
              type="text"
              placeholder={isMeme ? "e.g. PEPE" : "e.g. BTC/USDC"}
              value={symbol}
              onChange={(e) => onSymbolChange(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label htmlFor="ai-agent-margin" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Amount to invest (required)</label>
            <input
              id="ai-agent-margin"
              type="number"
              min="1"
              step="any"
              placeholder="e.g. 1000"
              value={margin}
              onChange={(e) => onMarginChange(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ai-agent-leverage" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Leverage {isMeme ? "(optional)" : "(required)"}
            </label>
            {isMeme ? (
              <input
                id="ai-agent-leverage"
                type="number"
                min="1"
                max="125"
                step="1"
                placeholder="Spot (leave empty)"
                value={leverage}
                onChange={(e) => onLeverageChange(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            ) : (
              <select
                id="ai-agent-leverage"
                value={leverage}
                onChange={(e) => onLeverageChange(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {[1, 2, 3, 5, 10, 20, 50, 75, 100, 125].map((x) => (
                  <option key={x} value={x}>{x}x</option>
                ))}
              </select>
            )}
          </div>
          {!isMeme && (
          <div>
            <label htmlFor="ai-agent-direction" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Direction (optional)</label>
            <select
              id="ai-agent-direction"
              value={direction}
              onChange={(e) => onDirectionChange((e.target.value || "") as "long" | "short" | "")}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Analyze both</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="ai-agent-chart-tf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Chart timeframe (required)</label>
            <input
              id="ai-agent-chart-tf"
              type="text"
              placeholder="e.g. 5m, 15m, 4h, 1D"
              value={chartTimeframe}
              onChange={(e) => onChartTimeframeChange(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label htmlFor="ai-agent-trade-tf" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Trade timeframe (required)</label>
            <input
              id="ai-agent-trade-tf"
              type="text"
              placeholder="e.g. Scalp, Swing, 4 hours"
              value={tradeTimeframe}
              onChange={(e) => onTradeTimeframeChange(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        <div>
          <label htmlFor="ai-agent-risk" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Risk amount — max loss willing to take (optional)</label>
          <input
            id="ai-agent-risk"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 100"
            value={riskAmount}
            onChange={(e) => onRiskAmountChange(e.target.value)}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 items-center">
        <Button
          onClick={onAnalyze}
          disabled={loading || analyzeDisabled}
          className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700"
        >
          {loading ? "Analyzing chart…" : "Analyze with NovaStaris AI"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {result && (
        <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{symbol || "—"}</span>
            <div
              className={`text-4xl font-bold tabular-nums ${
                result.score >= 76 ? "text-emerald-600 dark:text-emerald-400" :
                result.score >= 51 ? "text-cyan-600 dark:text-cyan-400" :
                result.score >= 26 ? "text-amber-600 dark:text-amber-400" :
                "text-rose-600 dark:text-rose-400"
              }`}
            >
              {result.score}
              <span className="text-lg font-normal text-muted-foreground ml-1">/ 100</span>
            </div>
            <Badge
              className={`text-sm font-bold px-3 py-1 ${
                result.signal === "buy"
                  ? "bg-emerald-500 text-white dark:bg-emerald-600 border-0 hover:bg-emerald-600 dark:hover:bg-emerald-700"
                  : "bg-rose-500 text-white dark:bg-rose-600 border-0 hover:bg-rose-600 dark:hover:bg-rose-700"
              }`}
            >
              {resultIsMeme
                ? (result.signal === "buy" ? "BUY" : "NO BUY")
                : (result.signal === "buy"
                  ? (result.tradeDirection === "long" ? "BUY LONG" : result.tradeDirection === "short" ? "BUY SHORT" : "BUY")
                  : (result.tradeDirection === "long" ? "NO BUY (bias: Long)" : result.tradeDirection === "short" ? "NO BUY (bias: Short)" : "NO BUY"))}
            </Badge>
          </div>
          {result.marketRead && (
            <div className="mt-4 rounded-lg border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-950/25 p-4 space-y-1.5 text-sm">
              <p className="font-semibold text-violet-900 dark:text-violet-100">Structure read (NovaQ-style, same as NovaRadar)</p>
              <p className="text-violet-950/90 dark:text-violet-100/90">{result.marketRead.headline}</p>
              <ul className="list-disc list-inside text-xs text-violet-900/80 dark:text-violet-200/90 space-y-0.5">
                {result.marketRead.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {result.recommendations && (result.recommendations.supportResistance || result.recommendations.marketStructure || result.recommendations.entryZone || result.recommendations.takeProfitPct || result.recommendations.stopLossPct) && (
            <div className="mt-4 rounded-lg border border-cyan-200/80 dark:border-cyan-800/80 bg-cyan-50/50 dark:bg-cyan-950/30 p-4 space-y-2 text-sm">
              <p className="font-semibold text-cyan-800 dark:text-cyan-200">
                {resultIsMeme ? "Trading levels (spot meme — use risk management)" : "Trading levels (futures — use risk management)"}
              </p>
              {result.recommendations.supportResistance && <p><span className="text-muted-foreground">Support / Resistance:</span> {result.recommendations.supportResistance}</p>}
              {result.recommendations.marketStructure && <p><span className="text-muted-foreground">Market structure:</span> {result.recommendations.marketStructure}</p>}
              {result.recommendations.entryZone && <p><span className="text-muted-foreground">Entry zone:</span> {result.recommendations.entryZone}</p>}
              {result.recommendations.takeProfitPct && <p><span className="text-emerald-600 dark:text-emerald-400">Take profit:</span> {result.recommendations.takeProfitPct}</p>}
              {result.recommendations.stopLossPct && <p><span className="text-rose-600 dark:text-rose-400">Stop loss:</span> {result.recommendations.stopLossPct}</p>}
            </div>
          )}
          <ul className="mt-4 list-disc list-inside space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {(isOwner || isCoachUser) && (
            <div className="mt-4 space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-600">
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const { title: t, content: c } = formatForShare(result, symbol, chartTimeframe, tradeTimeframe, leverage);
                    const full = [t, c].filter(Boolean).join("\n\n");
                    navigator.clipboard.writeText(full).then(() => onCopied());
                  }}
                  className="border-zinc-300 dark:border-zinc-600"
                >
                  {copied ? "Copied!" : <><Copy className="h-3.5 w-3.5 mr-1.5 inline" /> Copy analysis</>}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={shareLoading}
                  onClick={onShare}
                  className="border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50"
                >
                  {shareLoading ? "Sharing…" : shareSuccess ? "Shared!" : <><Send className="h-3.5 w-3.5 mr-1.5 inline" /> Share to Coach Calls</>}
                </Button>
              </div>
              <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-2">
                <span className="text-xs text-muted-foreground block">Was this chart analysis accurate?</span>
                {feedbackSent ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 block">Thanks — feedback recorded.</span>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Button type="button" variant="outline" size="sm" disabled={feedbackLoading} onClick={() => onFeedback("good")} className="text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50">
                        Yes, worked well
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={feedbackLoading} onClick={() => onFeedback("bad")} className="text-xs border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50">
                        No, needs work
                      </Button>
                    </div>
                    <textarea
                      value={feedbackNote}
                      onChange={(e) => onFeedbackNoteChange(e.target.value)}
                      placeholder="Optional note for training (what worked or what missed)…"
                      rows={2}
                      className="w-full text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
