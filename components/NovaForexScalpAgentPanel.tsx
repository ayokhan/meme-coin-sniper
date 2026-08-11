"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { normalizeForexSymbol, validateForexScalpSymbol, FOREX_SCALP_MAX_LEVERAGE, type ForexSymbolEntry } from "@/lib/forex-market";
import {
  NOVA_SCALP_DISCLAIMER,
  QUICK_WIN_SCALP_TIMEFRAME_ID,
  SCALP_TIMEFRAMES,
  type NovaScalpAnalysis,
  type NovaScalpNearSetup,
  type NovaScalpQuickWin,
  type QuickWinScanSummary,
  type ScalpTimeframeId,
} from "@/lib/nova-scalp-agent";
import { NovaScalpPlanCard } from "@/components/NovaScalpPlanCard";
import {
  clearOpenWatchedScalpPlanPending,
  findWatchedScalpPlan,
  hasOpenWatchedScalpPlanPending,
  peekOpenWatchedScalpPlanPending,
  SCALP_OPEN_WATCHED_EVENT,
} from "@/lib/nova-scalp-plan-watch";
import { hasNovaForexScalperPrefill } from "@/lib/nova-forex-scalper-prefill";
import Link from "next/link";
import { Flame } from "lucide-react";

type Props = {
  enabled: boolean;
  isVip: boolean;
  novaForexBot?: boolean;
  novaForexScalpBot?: boolean;
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 2 })}`;
}

export default function NovaForexScalpAgentPanel({
  enabled,
  isVip,
  novaForexBot = false,
  novaForexScalpBot = false,
}: Props) {
  const [catalog, setCatalog] = useState<ForexSymbolEntry[]>([]);
  const [symbol, setSymbol] = useState("XAUUSD");
  const [scalpTf, setScalpTf] = useState("5m");
  const [scalpAmount, setScalpAmount] = useState("100");
  const [scalpLev, setScalpLev] = useState("20");
  const [scalpLevSource, setScalpLevSource] = useState<"default" | "broker" | "user">("default");
  const [scalpLevHydrated, setScalpLevHydrated] = useState(false);
  const scalpLevUserEditedRef = useRef(false);
  const [scalpMaxLoss, setScalpMaxLoss] = useState("5");
  const [scalpResult, setScalpResult] = useState<NovaScalpAnalysis | null>(null);
  const [scalpLoading, setScalpLoading] = useState(false);
  const [scalpError, setScalpError] = useState<string | null>(null);
  const [qwTf, setQwTf] = useState<ScalpTimeframeId>(QUICK_WIN_SCALP_TIMEFRAME_ID);
  const [qwTfLabel, setQwTfLabel] = useState("5 mins");
  const [qwLoading, setQwLoading] = useState(false);
  const [qwError, setQwError] = useState<string | null>(null);
  const [quickWins, setQuickWins] = useState<NovaScalpQuickWin[]>([]);
  const [nearSetups, setNearSetups] = useState<NovaScalpNearSetup[]>([]);
  const [qwScanSummary, setQwScanSummary] = useState<QuickWinScanSummary | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!novaForexScalpBot && !novaForexBot) return;
    if (hasNovaForexScalperPrefill()) {
      window.location.replace("/?tab=nova-forex-bot&forex=scalp-bot");
    }
  }, [novaForexScalpBot, novaForexBot]);

  const restoreWatchedForexPlan = useCallback(() => {
    const pending = peekOpenWatchedScalpPlanPending();
    if (pending && pending.market !== "forex") return false;
    const w = pending
      ? findWatchedScalpPlan({ symbol: pending.symbol, timeframeId: pending.timeframeId }, "forex")
      : null;
    if (!w || (w.market ?? "crypto") !== "forex") return false;
    const a = w.analysis;
    if (a.side === "no_entry") return false;
    setSymbol(a.symbol);
    setScalpAmount(String(a.amountUsd));
    scalpLevUserEditedRef.current = true;
    setScalpLev(String(a.leverage));
    setScalpLevSource("user");
    setScalpMaxLoss(String(a.maxLossPctOnMargin ?? 5));
    setScalpTf(a.timeframeId as ScalpTimeframeId);
    setScalpResult(a);
    setScalpError(null);
    clearOpenWatchedScalpPlanPending();
    window.setTimeout(() => {
      document.getElementById("nova-scalp-watched-plan")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return true;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onOpen = () => {
      void restoreWatchedForexPlan();
    };
    window.addEventListener(SCALP_OPEN_WATCHED_EVENT, onOpen);
    if (hasOpenWatchedScalpPlanPending()) restoreWatchedForexPlan();
    return () => window.removeEventListener(SCALP_OPEN_WATCHED_EVENT, onOpen);
  }, [enabled, restoreWatchedForexPlan]);

  useEffect(() => {
    if (!enabled || !isVip) {
      setScalpLevHydrated(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const listRes = await fetch("/api/user/forex-broker-config", {
          credentials: "include",
          cache: "no-store",
        });
        if (listRes.status === 401) return;
        const listData = (await listRes.json()) as {
          success?: boolean;
          connections?: Array<{ broker: string; connected?: boolean }>;
        };
        if (!listRes.ok || !listData.success || cancelled) return;
        const connected = (listData.connections ?? []).find((c) => c.connected);
        if (!connected?.broker) return;
        const accRes = await fetch(
          `/api/user/forex-broker-config/account?broker=${encodeURIComponent(connected.broker)}&period=1d&wait=0`,
          { credentials: "include", cache: "no-store" }
        );
        const accData = (await accRes.json()) as { account?: { leverage?: number } | null };
        const lev = accData?.account?.leverage;
        if (cancelled || typeof lev !== "number" || !Number.isFinite(lev) || lev < 1) return;
        if (scalpLevUserEditedRef.current) return;
        const capped = Math.min(FOREX_SCALP_MAX_LEVERAGE, Math.max(1, Math.round(lev)));
        setScalpLev(String(capped));
        setScalpLevSource("broker");
      } catch {
        /* keep default 20 */
      } finally {
        if (!cancelled) setScalpLevHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, isVip]);

  useEffect(() => {
    if (!enabled || !isVip) return;
    fetch("/api/nova-forex/symbols", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success && Array.isArray(d.symbols)) setCatalog(d.symbols);
      })
      .catch(() => {});
  }, [enabled, isVip]);

  const runScalp = useCallback(
    async (overrides?: { symbol?: string; timeframeId?: string; leverage?: number }) => {
      const sym = overrides?.symbol ?? symbol;
      const tf = overrides?.timeframeId ?? scalpTf;
      const lev = overrides?.leverage ?? (Number(scalpLev) || 20);
      if (overrides?.symbol) setSymbol(overrides.symbol);
      if (overrides?.timeframeId) setScalpTf(overrides.timeframeId);
      if (overrides?.leverage != null) {
        scalpLevUserEditedRef.current = true;
        setScalpLev(String(overrides.leverage));
        setScalpLevSource("user");
      }
      setScalpLoading(true);
      setScalpError(null);
      try {
        const res = await fetch("/api/nova-forex/scalp/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            symbol: sym.trim(),
            timeframeId: tf,
            amountUsd: Number(scalpAmount) || 100,
            leverage: lev,
            maxLossPctOnMargin: Number(scalpMaxLoss) || 5,
          }),
        });
        const d = await res.json();
        if (!res.ok || !d.success) {
          setScalpError(d.error ?? "Scalp failed");
          setScalpResult(null);
          return;
        }
        setScalpResult(d.analysis as NovaScalpAnalysis);
      } catch {
        setScalpError("Request failed");
      } finally {
        setScalpLoading(false);
      }
    },
    [symbol, scalpTf, scalpAmount, scalpLev, scalpMaxLoss]
  );

  const findQuickWins = useCallback(
    async (tfId = qwTf, lev = Number(scalpLev) || 20) => {
      setQwLoading(true);
      setQwError(null);
      try {
        const params = new URLSearchParams({
          timeframe: tfId,
          leverage: String(Math.min(FOREX_SCALP_MAX_LEVERAGE, Math.max(1, lev))),
          amountUsd: String(Math.max(1, Number(scalpAmount) || 100)),
          maxLossPct: String(Number(scalpMaxLoss) || 5),
        });
        const res = await fetch(`/api/nova-forex/scalp/quick-wins?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setQwError(data.error ?? "Quick Wins scan failed");
          setQuickWins([]);
          setNearSetups([]);
          return;
        }
        setQuickWins((data.quickWins as NovaScalpQuickWin[]) ?? []);
        setNearSetups((data.nearSetups as NovaScalpNearSetup[]) ?? []);
        setQwScanSummary((data.scanSummary as QuickWinScanSummary) ?? null);
        if (data.timeframeLabel) setQwTfLabel(String(data.timeframeLabel));
      } catch {
        setQwError("Network error");
        setQuickWins([]);
      } finally {
        setQwLoading(false);
      }
    },
    [qwTf, scalpAmount, scalpLev, scalpMaxLoss]
  );

  useEffect(() => {
    if (!enabled || !scalpLevHydrated) return;
    void findQuickWins(QUICK_WIN_SCALP_TIMEFRAME_ID, Number(scalpLev) || 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scan once leverage hydrated when opening
  }, [enabled, scalpLevHydrated]);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-3">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Forex Agent</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Nova Forex Agent (scalp desk) is not available on your account yet. If you have VIP and do not see this tool,
          contact support.
        </p>
      </div>
    );
  }

  if (!isVip) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center">
        <p className="text-sm text-muted-foreground">Nova Forex Agent is for VIP subscribers.</p>
      </div>
    );
  }

  const symbolCheck = validateForexScalpSymbol(symbol);

  return (
    <div className="space-y-4">
      {(novaForexBot || novaForexScalpBot) && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            <Flame className="inline-block h-3.5 w-3.5 mr-1 text-emerald-500 -mt-0.5" aria-hidden />
            Ready to trade? Open <strong className="text-foreground">Nova Forex Bots</strong> under Focus → Bots.
          </p>
          <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <Link href={novaForexScalpBot ? "/?tab=nova-forex-bot&forex=scalp-bot" : "/?tab=nova-forex-bot&forex=forex-bot"}>
              Open Forex Bots
            </Link>
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Nova Forex Agent</h2>
          <p className="text-xs text-muted-foreground">
            Short-hold scalp plans for forex, indices, and equities (XAUUSD, EURUSD, NAS100, TSLA — not crypto). For
            BTC/SOL use Nova Pulse → Futures (Nova Scalp Agent).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Symbol:</span>
          <input
            list="nova-pulse-forex-symbols"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onBlur={() => {
              const normalized = normalizeForexSymbol(symbol);
              if (normalized) setSymbol(normalized);
            }}
            placeholder="XAUUSD or XAU"
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-40 bg-white dark:bg-zinc-800"
          />
          <datalist id="nova-pulse-forex-symbols">
            <option value="XAU">Gold (XAUUSD)</option>
            <option value="XAG">Silver (XAGUSD)</option>
            {catalog.map((c) => (
              <option key={c.symbol} value={c.symbol}>
                {c.label}
              </option>
            ))}
          </datalist>
        </div>

        {!symbolCheck.ok && (
          <p className="text-xs text-slate-600 dark:text-slate-300 rounded-md border border-amber-300/50 dark:border-amber-800 px-2.5 py-2">
            {symbolCheck.error}
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Timeframe</span>
            <select
              value={scalpTf}
              onChange={(e) => setScalpTf(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 block min-w-[7rem]"
            >
              {SCALP_TIMEFRAMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Amount (USD margin)</span>
            <input
              type="number"
              min={1}
              value={scalpAmount}
              onChange={(e) => setScalpAmount(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-28 bg-white dark:bg-zinc-800"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">
              Leverage
              {scalpLevSource === "broker" ? (
                <span className="text-muted-foreground/80"> · from MT account</span>
              ) : null}
            </span>
            <input
              type="number"
              min={1}
              max={FOREX_SCALP_MAX_LEVERAGE}
              value={scalpLev}
              onChange={(e) => {
                scalpLevUserEditedRef.current = true;
                setScalpLevSource("user");
                setScalpLev(e.target.value);
              }}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-24 bg-white dark:bg-zinc-800"
              title="Prefills from your connected MT account when available — you can change it"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Max loss (% margin)</span>
            <input
              type="number"
              min={0.5}
              max={100}
              step={0.5}
              value={scalpMaxLoss}
              onChange={(e) => setScalpMaxLoss(e.target.value)}
              className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 w-24 bg-white dark:bg-zinc-800"
              title="Used for optional risk stop alongside structural invalidation"
            />
          </label>
          <Button onClick={() => void runScalp()} disabled={scalpLoading} className="mb-0.5">
            {scalpLoading ? "Running…" : "Run Nova Forex Scalp"}
          </Button>
        </div>

        {scalpError && <p className="text-sm text-rose-600">{scalpError}</p>}
        {scalpResult && (
          <div id="nova-scalp-watched-plan" className="scroll-mt-24">
            <NovaScalpPlanCard
              market="forex"
              result={scalpResult}
              onRefresh={() => void runScalp()}
              refreshing={scalpLoading}
            />
          </div>
        )}
        {!scalpResult && !scalpError && (
          <p className="text-[11px] text-muted-foreground">{NOVA_SCALP_DISCLAIMER}</p>
        )}

        <div
          id="nova-forex-scalp-quick-wins"
          className="rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Quick Wins</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Market Watch symbols with a confirmed Buy (Long) or Sell (Short) on your timeframe.
                {qwTfLabel ? ` Showing: ${qwTfLabel}.` : ""}
                {` Preview at $${Number(scalpAmount) || 100} margin · ${Number(scalpLev) || 20}x.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Time frame</span>
                <select
                  value={qwTf}
                  onChange={(e) => setQwTf(e.target.value as ScalpTimeframeId)}
                  className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
                >
                  {SCALP_TIMEFRAMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void findQuickWins(qwTf, Number(scalpLev) || 20)}
                disabled={qwLoading}
              >
                {qwLoading ? "Scanning…" : "Find me quick wins"}
              </Button>
            </div>
          </div>
          {qwError && <p className="text-sm text-rose-600 dark:text-rose-400">{qwError}</p>}
          {quickWins.length === 0 && !qwLoading && !qwError && (
            <div className="space-y-3 text-xs text-muted-foreground">
              <p>
                {qwScanSummary
                  ? `Scanned ${qwScanSummary.symbolsScanned} Market Watch symbols on ${qwTfLabel}: ${qwScanSummary.oscillationQualified} had tight range, but none had a confirmed Buy (Long) / Sell (Short) (price mid-range or structure conflict). Normal in chop.`
                  : "No quick-win candidates right now."}
              </p>
              {nearSetups.length > 0 && (
                <div className="rounded-md border border-slate-200/80 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/50 p-3 space-y-2">
                  <p className="font-medium text-amber-900 dark:text-amber-200">Near setup (no entry yet)</p>
                  <ul className="space-y-1.5">
                    {nearSetups.map((n) => (
                      <li key={n.symbol} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{n.symbol}</span>
                          <span className="text-muted-foreground"> · score {n.quickWinScore}</span>
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => void runScalp({ symbol: n.symbol, timeframeId: qwTf })}
                        >
                          Analyze
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {quickWins.length > 0 && (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {quickWins.map((w) => (
                <div
                  key={w.symbol}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/50 px-3 py-2"
                >
                  <div>
                    <p className="font-mono font-semibold text-sm">{w.symbol}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{w.directionHint}</p>
                    <p className="text-[11px] text-muted-foreground">{w.liquidityNote}</p>
                  </div>
                  <div className="text-right text-xs space-y-0.5">
                    <p>
                      Score{" "}
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                        {w.quickWinScore}
                      </span>
                    </p>
                    <p>
                      Plan{" "}
                      <span
                        className={`font-medium uppercase ${
                          w.scalpSide === "long"
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {w.scalpSide}
                      </span>{" "}
                      · entry {fmtUsd(w.entryPrice)}
                    </p>
                    <p className="text-muted-foreground">
                      ~{w.estHoldMinutes}m · ~{w.suggestedLeverage}x · 15m range {w.rangePct15m}%
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() =>
                        void runScalp({
                          symbol: w.symbol,
                          leverage: w.suggestedLeverage,
                          timeframeId: w.scalpTimeframeId,
                        })
                      }
                    >
                      Analyze
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
