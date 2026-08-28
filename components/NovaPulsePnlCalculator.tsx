"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FOREX_MARKET_WATCH, FOREX_SCALP_MAX_LEVERAGE } from "@/lib/forex-market";
import {
  computeAllPivots,
  floorTicketFromPivots,
  type PivotLevels,
  type PivotOhlc,
} from "@/lib/forex-pivots";
import type { RoroAlignment, RoroMeter } from "@/lib/forex-roro";
import { formatQuotePrice } from "@/lib/format-quote-price";
import {
  NOVA_FOREX_SCALPER_HANDOFF_URL,
  forexScalperEntryTriggerFor,
  writeNovaForexScalperPrefill,
} from "@/lib/nova-forex-scalper-prefill";
import { novaQHandoffUrl, writeNovaQPrefill } from "@/lib/nova-q-prefill";
import {
  calculatePulsePnl,
  priceFromPct,
  priceFromPips,
  pipsFromPrices,
  type PulsePnlMarket,
  type PulsePnlResult,
  type PulsePnlSide,
} from "@/lib/nova-pulse-pnl";
import { NOVA_SCALPER_HANDOFF_URL, writeNovaScalperPrefill } from "@/lib/nova-scalper-prefill";
import { useScalpHandoffNav } from "@/components/useScalpHandoffNav";

type Props = {
  enabled: boolean;
  isVip: boolean;
  isGuest?: boolean;
  visitorId?: string;
  novaForexScalpBot?: boolean;
  quota?: {
    unlimited: boolean;
    used: number;
    limit: number | null;
    remaining: number | null;
    isGuest?: boolean;
  } | null;
  onQuotaChange?: () => void;
};

type LevelField = "price" | "pct" | "pips";

const INPUT =
  "w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-2 bg-white dark:bg-zinc-800";
const CRYPTO_SYMBOLS = ["BTC", "ETH", "SOL", "XAU", "XAG", "DOGE", "XRP", "BNB"];

function fmtUsd(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(2, digits),
  })}`;
}

function fmtUsdAbs(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.min(2, digits),
  })}`;
}

function n(s: string): number {
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

function RoroMeterCard({
  meter,
  alignment,
}: {
  meter: RoroMeter;
  alignment: RoroAlignment | null;
}) {
  const needle = Math.max(0, Math.min(100, meter.score));
  const tone =
    meter.bias === "risk_on"
      ? "text-emerald-700 dark:text-emerald-300"
      : meter.bias === "risk_off"
        ? "text-rose-700 dark:text-rose-300"
        : "text-zinc-700 dark:text-zinc-300";
  const alignTone =
    alignment?.status === "aligned"
      ? "border-emerald-300/70 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30"
      : alignment?.status === "fighting"
        ? "border-rose-300/70 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30"
        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/40";

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Risk-on / risk-off</p>
          <p className={`text-lg font-semibold ${tone}`}>{meter.label}</p>
        </div>
        <p className={`font-mono text-2xl font-semibold tabular-nums ${tone}`}>{meter.score.toFixed(0)}</p>
      </div>
      <div className="space-y-1">
        <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-rose-500 via-zinc-300 dark:via-zinc-600 to-emerald-500">
          <div
            className="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-zinc-950 dark:bg-white shadow-sm"
            style={{ left: `calc(${needle}% - 1px)` }}
            aria-hidden
          />
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>Risk off 0</span>
          <span>Neutral 50</span>
          <span>Risk on 100</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{meter.summary}</p>
      {alignment && (
        <div className={`rounded-md border px-2.5 py-2 text-xs leading-relaxed ${alignTone}`}>
          <span className="font-medium">Your side vs tape: </span>
          {alignment.note}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
              <th className="py-1 pr-2 font-medium">Instrument</th>
              <th className="py-1 pr-2 font-medium text-right">Session %</th>
              <th className="py-1 font-medium">Bias</th>
            </tr>
          </thead>
          <tbody>
            {meter.instruments.map((row) => {
              const pct = row.changePct;
              const riskOn = row.signedPct != null && row.signedPct > 0;
              return (
                <tr key={row.symbol} className="border-b border-zinc-100 dark:border-zinc-800/80">
                  <td className="py-1 pr-2 font-mono">
                    {row.symbol}
                    <span className="ml-1 text-muted-foreground font-sans">{row.label}</span>
                  </td>
                  <td
                    className={`py-1 pr-2 text-right font-mono ${
                      pct == null
                        ? "text-muted-foreground"
                        : pct >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                  </td>
                  <td className="py-1 text-muted-foreground">{row.signedPct == null ? "—" : riskOn ? "Risk on" : "Risk off"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Session vs prior daily close · educational composite, not a Bloomberg feed or a buy/sell signal.
      </p>
    </div>
  );
}

export default function NovaPulsePnlCalculator({
  enabled,
  isVip,
  isGuest = false,
  visitorId = "",
  novaForexScalpBot,
  quota,
  onQuotaChange,
}: Props) {
  const { requestHandoff, dialog: handoffDialog } = useScalpHandoffNav();
  const [market, setMarket] = useState<PulsePnlMarket>("forex");
  const [symbol, setSymbol] = useState("EURUSD");
  const [side, setSide] = useState<PulsePnlSide>("long");
  const [leverage, setLeverage] = useState("20");
  const [entry, setEntry] = useState("");
  const [tpPrice, setTpPrice] = useState("");
  const [tpPct, setTpPct] = useState("1.5");
  const [tpPips, setTpPips] = useState("30");
  const [slPrice, setSlPrice] = useState("");
  const [slPct, setSlPct] = useState("0.8");
  const [slPips, setSlPips] = useState("16");
  const [tpSource, setTpSource] = useState<LevelField>("pct");
  const [slSource, setSlSource] = useState<LevelField>("pct");
  const [accountUsd, setAccountUsd] = useState("1000");
  const [riskPct, setRiskPct] = useState("1");
  const [sizeMode, setSizeMode] = useState<"margin" | "stop" | "custom">("stop");
  const [marginUsd, setMarginUsd] = useState("100");
  const [lots, setLots] = useState("0.10");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [usdJpy, setUsdJpy] = useState<number | null>(null);
  const [roro, setRoro] = useState<RoroMeter | null>(null);
  const [alignment, setAlignment] = useState<RoroAlignment | null>(null);
  const [pivotPeriod, setPivotPeriod] = useState<"1d" | "1w" | "1M">("1d");
  const [pivotOhlc, setPivotOhlc] = useState<PivotOhlc | null>(null);
  const [pivots, setPivots] = useState<PivotLevels[]>([]);
  const [result, setResult] = useState<PulsePnlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxLev = market === "forex" ? FOREX_SCALP_MAX_LEVERAGE : 125;

  const syncLevels = useCallback(
    (nextEntry: number, nextSide: PulsePnlSide, nextMarket: PulsePnlMarket, tpSrc: LevelField, slSrc: LevelField) => {
      if (!(nextEntry > 0)) return;
      const sym = symbol.trim().toUpperCase();

      const applyTp = (src: LevelField) => {
        if (src === "pct") {
          const pct = n(tpPct);
          if (!(pct > 0)) return;
          const px = priceFromPct(nextSide, nextEntry, pct, "tp");
          setTpPrice(String(Number(px.toPrecision(8))));
          if (nextMarket === "forex") {
            setTpPips(Math.abs(pipsFromPrices(sym, nextEntry, px)).toFixed(1));
          }
        } else if (src === "pips" && nextMarket === "forex") {
          const pips = n(tpPips);
          if (!(pips > 0)) return;
          const px = priceFromPips(sym, nextSide, nextEntry, pips, "tp");
          setTpPrice(String(Number(px.toPrecision(8))));
          setTpPct(Math.abs(((px - nextEntry) / nextEntry) * 100).toFixed(3));
        } else {
          const px = n(tpPrice);
          if (!(px > 0)) return;
          setTpPct((((nextSide === "long" ? px - nextEntry : nextEntry - px) / nextEntry) * 100).toFixed(3));
          if (nextMarket === "forex") setTpPips(Math.abs(pipsFromPrices(sym, nextEntry, px)).toFixed(1));
        }
      };

      const applySl = (src: LevelField) => {
        if (src === "pct") {
          const pct = n(slPct);
          if (!(pct > 0)) return;
          const px = priceFromPct(nextSide, nextEntry, pct, "sl");
          setSlPrice(String(Number(px.toPrecision(8))));
          if (nextMarket === "forex") {
            setSlPips(Math.abs(pipsFromPrices(sym, nextEntry, px)).toFixed(1));
          }
        } else if (src === "pips" && nextMarket === "forex") {
          const pips = n(slPips);
          if (!(pips > 0)) return;
          const px = priceFromPips(sym, nextSide, nextEntry, pips, "sl");
          setSlPrice(String(Number(px.toPrecision(8))));
          setSlPct(Math.abs(((px - nextEntry) / nextEntry) * 100).toFixed(3));
        } else {
          const px = n(slPrice);
          if (!(px > 0)) return;
          setSlPct((((nextSide === "long" ? nextEntry - px : px - nextEntry) / nextEntry) * 100).toFixed(3));
          if (nextMarket === "forex") setSlPips(Math.abs(pipsFromPrices(sym, nextEntry, px)).toFixed(1));
        }
      };

      applyTp(tpSrc);
      applySl(slSrc);
    },
    [symbol, tpPct, tpPips, tpPrice, slPct, slPips, slPrice]
  );

  useEffect(() => {
    const e = n(entry);
    if (e > 0) syncLevels(e, side, market, tpSource, slSource);
    // Only when entry/side/market change — field edits call sync themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, side, market]);

  const switchMarket = (next: PulsePnlMarket) => {
    setMarket(next);
    setResult(null);
    setRoro(null);
    setAlignment(null);
    setPivots([]);
    setPivotOhlc(null);
    setError(null);
    if (next === "forex") {
      setSymbol("EURUSD");
      setLeverage("20");
      setTpSource("pips");
      setSlSource("pips");
      setSizeMode("stop");
    } else {
      setSymbol("BTC");
      setLeverage("10");
      setTpSource("pct");
      setSlSource("pct");
      setSizeMode("margin");
    }
    setEntry("");
    setLivePrice(null);
  };

  const resolveTicket = useCallback(
    (entryPx: number) => {
      const sym = symbol.trim().toUpperCase();
      let tp = n(tpPrice);
      let sl = n(slPrice);
      if (tpSource === "pct" && n(tpPct) > 0) tp = priceFromPct(side, entryPx, n(tpPct), "tp");
      else if (tpSource === "pips" && market === "forex" && n(tpPips) > 0) {
        tp = priceFromPips(sym, side, entryPx, n(tpPips), "tp");
      }
      if (slSource === "pct" && n(slPct) > 0) sl = priceFromPct(side, entryPx, n(slPct), "sl");
      else if (slSource === "pips" && market === "forex" && n(slPips) > 0) {
        sl = priceFromPips(sym, side, entryPx, n(slPips), "sl");
      }
      return { tp, sl };
    },
    [symbol, side, market, tpPrice, slPrice, tpSource, slSource, tpPct, tpPips, slPct, slPips]
  );

  const quote = useCallback(
    async (opts?: { calculate?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          market,
          symbol: symbol.trim() || (market === "forex" ? "EURUSD" : "BTC"),
          side,
        });
        if (market === "forex") params.set("roro", "1");
        params.set("pivotPeriod", pivotPeriod);
        if (opts?.calculate) params.set("calculate", "1");
        if (visitorId) params.set("visitorId", visitorId);
        const res = await fetch(`/api/nova-pulse/pnl-calc?${params}`, { credentials: "include", cache: "no-store" });
        const data = await res.json();
        if (!data?.success) {
          setError(
            data?.error ??
              (data?.locked ? "Daily limit reached or access locked." : "Quote failed")
          );
          if (data?.limitReached || data?.needsRegister) onQuotaChange?.();
          return;
        }
        const px = typeof data.price === "number" ? data.price : Number(data.price);
        const jpy = typeof data.usdJpy === "number" && data.usdJpy > 0 ? data.usdJpy : usdJpy;
        if (typeof data.usdJpy === "number" && data.usdJpy > 0) setUsdJpy(data.usdJpy);
        if (data.roro) setRoro(data.roro as RoroMeter);
        if (data.alignment) setAlignment(data.alignment as RoroAlignment);
        if (data.pivotOhlc) {
          setPivotOhlc(data.pivotOhlc as PivotOhlc);
          setPivots(Array.isArray(data.pivots) ? (data.pivots as PivotLevels[]) : computeAllPivots(data.pivotOhlc));
        } else {
          setPivotOhlc(null);
          setPivots([]);
        }

        const fillEntry = Number.isFinite(px) && px > 0 && !entry.trim();
        const usedEntry = fillEntry ? px : n(entry) > 0 ? n(entry) : Number.isFinite(px) && px > 0 ? px : NaN;
        if (Number.isFinite(px) && px > 0) setLivePrice(px);
        if (fillEntry) {
          setEntry(String(px));
          syncLevels(px, side, market, tpSource, slSource);
        }
        if (opts?.calculate) {
          if (!(usedEntry > 0)) {
            setError("Need a live or typed entry price.");
            return;
          }
          const { tp, sl } = resolveTicket(usedEntry);
          setTpPrice(String(Number(tp.toPrecision(8))));
          setSlPrice(String(Number(sl.toPrecision(8))));
          const out = calculatePulsePnl({
            market,
            symbol,
            side,
            entryPrice: usedEntry,
            takeProfitPrice: tp,
            stopLossPrice: sl,
            leverage: n(leverage) || 1,
            marginUsd: n(marginUsd) || null,
            lots: n(lots) || null,
            accountUsd: n(accountUsd) || null,
            riskPct: n(riskPct) || null,
            sizeFromRisk: sizeMode === "stop",
            sizeMode,
            usdJpy: jpy,
          });
          if (!out.ok) {
            setResult(null);
            setError(out.error);
            return;
          }
          setError(null);
          setResult(out);
          if (out.lots != null && sizeMode === "custom") setLots(out.lots.toFixed(2));
          if (out.marginUsd > 0 && sizeMode === "custom") setMarginUsd(out.marginUsd.toFixed(2));
          onQuotaChange?.();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Quote failed");
      } finally {
        setLoading(false);
      }
    },
    [
      market,
      symbol,
      side,
      entry,
      tpSource,
      slSource,
      usdJpy,
      leverage,
      marginUsd,
      lots,
      accountUsd,
      riskPct,
      sizeMode,
      resolveTicket,
      syncLevels,
      pivotPeriod,
      onQuotaChange,
      visitorId,
    ]
  );

  const applyPriceAs = useCallback(
    (px: number, kind: "tp" | "sl") => {
      if (!(px > 0)) return;
      const e0 = n(entry) > 0 ? n(entry) : livePrice ?? NaN;
      setTpSource("price");
      setSlSource("price");
      if (kind === "tp") {
        setTpPrice(String(Number(px.toPrecision(8))));
        if (e0 > 0) {
          setTpPct((((side === "long" ? px - e0 : e0 - px) / e0) * 100).toFixed(3));
          if (market === "forex") setTpPips(Math.abs(pipsFromPrices(symbol, e0, px)).toFixed(1));
        }
      } else {
        setSlPrice(String(Number(px.toPrecision(8))));
        if (e0 > 0) {
          setSlPct((((side === "long" ? e0 - px : px - e0) / e0) * 100).toFixed(3));
          if (market === "forex") setSlPips(Math.abs(pipsFromPrices(symbol, e0, px)).toFixed(1));
        }
      }
    },
    [entry, livePrice, side, market, symbol]
  );

  const applyFloorTicket = () => {
    const e0 = n(entry) > 0 ? n(entry) : livePrice ?? NaN;
    const floor = pivots.find((p) => p.method === "floor");
    const ticket = floorTicketFromPivots(side, e0, floor);
    if (ticket.takeProfit) applyPriceAs(ticket.takeProfit, "tp");
    if (ticket.stopLoss) applyPriceAs(ticket.stopLoss, "sl");
  };

  const onCalculate = () => {
    void quote({ calculate: true });
  };

  useEffect(() => {
    if (!enabled) return;
    void quote();
    // Refresh H/L/C when the pivot window changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pivotPeriod]);

  const preview = useMemo(() => {
    const e = n(entry);
    if (!(e > 0)) return null;
    const out = calculatePulsePnl({
      market,
      symbol,
      side,
      entryPrice: e,
      takeProfitPrice: n(tpPrice),
      stopLossPrice: n(slPrice),
      leverage: n(leverage) || 1,
      marginUsd: n(marginUsd) || null,
      lots: n(lots) || null,
      accountUsd: n(accountUsd) || null,
      riskPct: n(riskPct) || null,
      sizeFromRisk: sizeMode === "stop",
      sizeMode,
      usdJpy,
    });
    return out.ok ? out : null;
  }, [market, symbol, side, entry, tpPrice, slPrice, leverage, marginUsd, lots, accountUsd, riskPct, sizeMode, usdJpy]);

  /** Live preview wins so changing leverage/size updates the card without a stale Calculate snapshot. */
  const shown = preview ?? result;

  const sendToScalper = () => {
    if (!shown) return;
    if (market === "forex") {
      requestHandoff({
        label: "Nova Forex Scalper",
        url: NOVA_FOREX_SCALPER_HANDOFF_URL,
        prepare: () =>
          writeNovaForexScalperPrefill({
            symbol: shown.symbol,
            side: shown.side,
            entryPrice: shown.levels.entryPrice,
            exitPrice: shown.levels.takeProfitPrice,
            stopLossPrice: shown.levels.stopLossPrice,
            lotSize: shown.lots ?? undefined,
            marginUsd: shown.marginUsd,
            leverage: shown.leverage,
            entryTrigger: forexScalperEntryTriggerFor(shown.side, { enterNow: true }),
            source: "Nova Pulse Calculate PnL",
            createdAt: new Date().toISOString(),
          }),
      });
      return;
    }
    requestHandoff({
      label: "NovaScalper",
      url: NOVA_SCALPER_HANDOFF_URL,
      prepare: () =>
        writeNovaScalperPrefill({
          symbol: shown.symbol,
          side: shown.side,
          entryPrice: shown.levels.entryPrice,
          exitPrice: shown.levels.takeProfitPrice,
          stopLossPrice: shown.levels.stopLossPrice,
          leverage: shown.leverage,
          marginUsd: shown.marginUsd,
          marginMode: "isolated",
          source: "Nova Pulse Calculate PnL",
          createdAt: new Date().toISOString(),
        }),
    });
  };

  const sendToNovaQ = () => {
    requestHandoff({
      label: market === "forex" ? "NovaQ Forex" : "NovaQ",
      url: novaQHandoffUrl(market),
      prepare: () =>
        writeNovaQPrefill({
          symbol: symbol.trim().toUpperCase(),
          market,
          source: "Nova Pulse Calculate PnL",
          createdAt: new Date().toISOString(),
        }),
    });
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-2">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Calculate PnL</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This tool is not enabled right now — contact support if you need access.
        </p>
      </div>
    );
  }

  return (
    <>
      {handoffDialog}
      <div className="space-y-4">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-1">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Calculate PnL</h2>
          <p className="text-xs text-muted-foreground">
            Professional sizing for crypto futures and forex: position size, take-profit and stop-loss in price, %,
            or pips, account risk and reward-to-risk, plus live pivot levels (Floor, Woodie, Camarilla, DeMark,
            Fibonacci) you can apply to your plan. Forex adds session risk-on/risk-off context. Educational only — not
            financial advice.
          </p>
          {quota && !quota.unlimited && quota.limit != null && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              {quota.remaining ?? 0} of {quota.limit} full calculation{quota.limit !== 1 ? "s" : ""} left today
              {isGuest || quota.isGuest
                ? " (guest) — register for 4/day"
                : !isVip
                  ? " — VIP unlimited"
                  : ""}
              .
            </p>
          )}
          {quota?.unlimited && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Unlimited calculations (VIP).</p>
          )}
        </div>

        <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-1 bg-zinc-100 dark:bg-zinc-800/80">
          <button
            type="button"
            onClick={() => switchMarket("forex")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              market === "forex"
                ? "bg-emerald-600 text-white"
                : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            Forex
          </button>
          <button
            type="button"
            onClick={() => switchMarket("crypto")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              market === "crypto" ? "bg-sky-500 text-white" : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            Crypto futures
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Symbol</span>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  list={market === "forex" ? "pulse-pnl-fx" : "pulse-pnl-crypto"}
                  className={`${INPUT} font-mono`}
                />
                <datalist id="pulse-pnl-fx">
                  {FOREX_MARKET_WATCH.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.label}
                    </option>
                  ))}
                </datalist>
                <datalist id="pulse-pnl-crypto">
                  {CRYPTO_SYMBOLS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Side</span>
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as PulsePnlSide)}
                  className={INPUT}
                >
                  <option value="long">{market === "forex" ? "Buy (Long)" : "Long"}</option>
                  <option value="short">{market === "forex" ? "Sell (Short)" : "Short"}</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Leverage</span>
                <input
                  type="number"
                  min={1}
                  max={maxLev}
                  value={leverage}
                  onChange={(e) => {
                    setLeverage(e.target.value);
                    setResult(null);
                  }}
                  className={INPUT}
                />
                {market === "crypto" && sizeMode === "margin" && (
                  <span className="block text-[11px] text-muted-foreground">
                    PnL = margin × leverage × price move. 10x on $1 margin → $10 position.
                  </span>
                )}
                {market === "crypto" && sizeMode === "stop" && (
                  <span className="block text-[11px] text-muted-foreground">
                    Stop-loss budget keeps dollar risk fixed — extra leverage only reduces margin.
                  </span>
                )}
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Entry</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    value={entry}
                    onChange={(e) => setEntry(e.target.value)}
                    placeholder={livePrice != null ? formatQuotePrice(livePrice) : "Live or typed"}
                    className={`${INPUT} font-mono`}
                  />
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void quote()} disabled={loading}>
                    Use live
                  </Button>
                </div>
                {livePrice != null && (
                  <p className="text-[11px] text-muted-foreground">
                    Live {formatQuotePrice(livePrice)}
                    {market === "crypto" ? " · Blofin" : " · Yahoo / spot mid"}
                  </p>
                )}
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <p className="sm:col-span-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">Take profit</p>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Price</span>
                <input
                  type="number"
                  step="any"
                  value={tpPrice}
                  onChange={(e) => {
                    setTpSource("price");
                    setTpPrice(e.target.value);
                    const e0 = n(entry);
                    const px = n(e.target.value);
                    if (e0 > 0 && px > 0) {
                      setTpPct((((side === "long" ? px - e0 : e0 - px) / e0) * 100).toFixed(3));
                      if (market === "forex") setTpPips(Math.abs(pipsFromPrices(symbol, e0, px)).toFixed(1));
                    }
                  }}
                  className={`${INPUT} font-mono`}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">TP %</span>
                <input
                  type="number"
                  step="0.01"
                  value={tpPct}
                  onChange={(e) => {
                    setTpSource("pct");
                    setTpPct(e.target.value);
                    const e0 = n(entry);
                    const pct = n(e.target.value);
                    if (e0 > 0 && pct > 0) {
                      const px = priceFromPct(side, e0, pct, "tp");
                      setTpPrice(String(Number(px.toPrecision(8))));
                      if (market === "forex") setTpPips(Math.abs(pipsFromPrices(symbol, e0, px)).toFixed(1));
                    }
                  }}
                  className={INPUT}
                />
              </label>
              {market === "forex" ? (
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">TP pips</span>
                  <input
                    type="number"
                    step="0.1"
                    value={tpPips}
                    onChange={(e) => {
                      setTpSource("pips");
                      setTpPips(e.target.value);
                      const e0 = n(entry);
                      const pips = n(e.target.value);
                      if (e0 > 0 && pips > 0) {
                        const px = priceFromPips(symbol, side, e0, pips, "tp");
                        setTpPrice(String(Number(px.toPrecision(8))));
                        setTpPct(Math.abs(((px - e0) / e0) * 100).toFixed(3));
                      }
                    }}
                    className={INPUT}
                  />
                </label>
              ) : (
                <div />
              )}

              <p className="sm:col-span-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">Stop loss</p>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Price</span>
                <input
                  type="number"
                  step="any"
                  value={slPrice}
                  onChange={(e) => {
                    setSlSource("price");
                    setSlPrice(e.target.value);
                    const e0 = n(entry);
                    const px = n(e.target.value);
                    if (e0 > 0 && px > 0) {
                      setSlPct((((side === "long" ? e0 - px : px - e0) / e0) * 100).toFixed(3));
                      if (market === "forex") setSlPips(Math.abs(pipsFromPrices(symbol, e0, px)).toFixed(1));
                    }
                  }}
                  className={`${INPUT} font-mono`}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">SL %</span>
                <input
                  type="number"
                  step="0.01"
                  value={slPct}
                  onChange={(e) => {
                    setSlSource("pct");
                    setSlPct(e.target.value);
                    const e0 = n(entry);
                    const pct = n(e.target.value);
                    if (e0 > 0 && pct > 0) {
                      const px = priceFromPct(side, e0, pct, "sl");
                      setSlPrice(String(Number(px.toPrecision(8))));
                      if (market === "forex") setSlPips(Math.abs(pipsFromPrices(symbol, e0, px)).toFixed(1));
                    }
                  }}
                  className={INPUT}
                />
              </label>
              {market === "forex" ? (
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">SL pips</span>
                  <input
                    type="number"
                    step="0.1"
                    value={slPips}
                    onChange={(e) => {
                      setSlSource("pips");
                      setSlPips(e.target.value);
                      const e0 = n(entry);
                      const pips = n(e.target.value);
                      if (e0 > 0 && pips > 0) {
                        const px = priceFromPips(symbol, side, e0, pips, "sl");
                        setSlPrice(String(Number(px.toPrecision(8))));
                        setSlPct(Math.abs(((px - e0) / e0) * 100).toFixed(3));
                      }
                    }}
                    className={INPUT}
                  />
                </label>
              ) : (
                <div />
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Account equity (USD)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="Optional"
                  value={accountUsd}
                  onChange={(e) => setAccountUsd(e.target.value)}
                  className={INPUT}
                />
                <span className="block text-[11px] text-muted-foreground">
                  Your futures wallet. Needed for risk-% / margin-% sizing and “% of account”. Skip if you type custom margin.
                </span>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {market === "crypto" && sizeMode === "margin" ? "Margin % of account" : "Risk % of account"}
                </span>
                <input type="number" min={0.1} max={100} step={0.1} value={riskPct} onChange={(e) => setRiskPct(e.target.value)} className={INPUT} />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Position size</span>
                <select
                  value={sizeMode}
                  onChange={(e) => setSizeMode(e.target.value as "margin" | "stop" | "custom")}
                  className={INPUT}
                >
                  {market === "crypto" && (
                    <option value="margin">Margin × leverage (recommended)</option>
                  )}
                  <option value="stop">
                    {market === "forex" ? "From risk % (recommended)" : "Cap loss at stop (SL = risk %)"}
                  </option>
                  <option value="custom">{market === "forex" ? "Custom lots" : "Custom margin"}</option>
                </select>
              </label>
              {sizeMode === "custom" && market === "forex" && (
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Lots (1.00 = standard)</span>
                  <input type="number" min={0.01} step={0.01} value={lots} onChange={(e) => setLots(e.target.value)} className={INPUT} />
                </label>
              )}
              {sizeMode === "custom" && market === "crypto" && (
                <label className="space-y-1">
                  <span className="text-xs text-muted-foreground">Margin (USD)</span>
                  <input type="number" min={1} value={marginUsd} onChange={(e) => setMarginUsd(e.target.value)} className={INPUT} />
                </label>
              )}
            </div>

            <Button
              type="button"
              className={market === "forex" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-sky-500 hover:bg-sky-600 text-white"}
              onClick={onCalculate}
              disabled={loading}
            >
              {loading ? "Calculating…" : "Calculate"}
            </Button>
            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
          </div>

          <div className="space-y-4">
            {market === "forex" && roro && <RoroMeterCard meter={roro} alignment={alignment} />}

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-4">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Breakdown</p>
              {!shown ? (
                <p className="text-sm text-muted-foreground">
                  Enter levels and click Calculate. Live quote fills entry if it is empty. Typing % or pips fills the
                  actual TP/SL prices.
                </p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Entry</dt>
                      <dd className="font-mono">{formatQuotePrice(shown.levels.entryPrice)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Side</dt>
                      <dd className={shown.side === "long" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {shown.side === "long" ? "Long" : "Short"} {shown.symbol}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Take profit</dt>
                      <dd className="font-mono">
                        {formatQuotePrice(shown.levels.takeProfitPrice)}
                        <span className="block text-[11px] text-muted-foreground">
                          {shown.levels.tpPct.toFixed(2)}%
                          {shown.levels.tpPips != null ? ` · ${shown.levels.tpPips.toFixed(1)} pips` : ""}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Stop loss</dt>
                      <dd className="font-mono">
                        {formatQuotePrice(shown.levels.stopLossPrice)}
                        <span className="block text-[11px] text-muted-foreground">
                          {shown.levels.slPct.toFixed(2)}%
                          {shown.levels.slPips != null ? ` · ${shown.levels.slPips.toFixed(1)} pips` : ""}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Position size</p>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Amount at risk</dt>
                        <dd className="font-mono">{fmtUsdAbs(shown.amountAtRiskUsd)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Reward : risk</dt>
                        <dd className="font-mono">
                          {shown.rewardRisk != null ? `${shown.rewardRisk.toFixed(2)} : 1` : "—"}
                        </dd>
                      </div>
                      {shown.lotBreakdown && (
                        <>
                          <div>
                            <dt className="text-[11px] text-muted-foreground">Units</dt>
                            <dd className="font-mono">
                              {shown.units != null
                                ? shown.units.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] text-muted-foreground">Standard lots</dt>
                            <dd className="font-mono">{shown.lotBreakdown.standardLots.toFixed(2)}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] text-muted-foreground">Mini lots</dt>
                            <dd className="font-mono">{shown.lotBreakdown.miniLots.toFixed(1)}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] text-muted-foreground">Micro lots</dt>
                            <dd className="font-mono">{shown.lotBreakdown.microLots.toFixed(0)}</dd>
                          </div>
                        </>
                      )}
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Margin required</dt>
                        <dd className="font-mono">{fmtUsdAbs(shown.marginUsd)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Notional @ {shown.leverage}x</dt>
                        <dd className="font-mono">{fmtUsdAbs(shown.notionalUsd)}</dd>
                      </div>
                      {shown.estimatedLiquidationPrice != null && (
                        <div className="col-span-2">
                          <dt className="text-[11px] text-muted-foreground">Est. isolated liq</dt>
                          <dd className="font-mono">
                            {formatQuotePrice(shown.estimatedLiquidationPrice)}
                            {shown.estimatedLiqDistancePct != null ? (
                              <span className="text-[11px] text-muted-foreground font-sans">
                                {" "}
                                · {shown.estimatedLiqDistancePct.toFixed(2)}% from entry
                              </span>
                            ) : null}
                            {shown.estimatedLiqLossUsd != null ? (
                              <span className="block text-rose-600 dark:text-rose-400">
                                {fmtUsd(shown.estimatedLiqLossUsd)}
                                {shown.estimatedLiqLossPctOfMargin != null
                                  ? ` · ${shown.estimatedLiqLossPctOfMargin.toFixed(1)}% of margin`
                                  : ""}
                              </span>
                            ) : null}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {shown.market === "crypto" && shown.sizeMethod === "margin" && (
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Dollar PnL scales with leverage: {fmtUsdAbs(shown.marginUsd)} margin × {shown.leverage}x ={" "}
                        {fmtUsdAbs(shown.notionalUsd)} notional. A {shown.levels.tpPct.toFixed(2)}% move →{" "}
                        {fmtUsd(shown.profitIfTpUsd)} ({shown.returnOnMarginIfTpPct.toFixed(0)}% on margin).
                      </p>
                    )}
                    {shown.market === "crypto" && shown.sizeMethod === "stop" && (
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Stop-loss budget keeps {fmtUsdAbs(shown.amountAtRiskUsd)} at SL at any leverage. Extra leverage
                        only reduces margin ({fmtUsdAbs(shown.marginUsd)}) and moves liquidation.
                      </p>
                    )}
                  </div>

                  {shown.pipValueUsdPerLot != null && (
                    <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pip value</p>
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                          <dt className="text-[11px] text-muted-foreground">Pip size</dt>
                          <dd className="font-mono">{shown.levels.pipSize ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-muted-foreground">Per 1.00 lot</dt>
                          <dd className="font-mono">{fmtUsdAbs(shown.pipValueUsdPerLot, 4)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-muted-foreground">Per mini (0.10)</dt>
                          <dd className="font-mono">{fmtUsdAbs(shown.pipValueUsdPerMiniLot, 4)}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-muted-foreground">Per micro (0.01)</dt>
                          <dd className="font-mono">{fmtUsdAbs(shown.pipValueUsdPerMicroLot, 4)}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="text-[11px] text-muted-foreground">At this position</dt>
                          <dd className="font-mono font-medium">{fmtUsdAbs(shown.pipValueUsdAtSize, 4)} / pip</dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  <div className="rounded-md border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gain / loss %</p>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <div>
                        <dt className="text-[11px] text-muted-foreground">If TP hits</dt>
                        <dd className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {fmtUsd(shown.profitIfTpUsd)}
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {shown.returnOnMarginIfTpPct >= 0 ? "+" : ""}
                            {shown.returnOnMarginIfTpPct.toFixed(1)}% on margin ({shown.leverage}x)
                            {shown.accountIfTp
                              ? ` · ${shown.accountIfTp.pctOfStart >= 0 ? "+" : ""}${shown.accountIfTp.pctOfStart.toFixed(2)}% of account`
                              : ""}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">If SL hits</dt>
                        <dd className="font-mono font-medium text-rose-600 dark:text-rose-400">
                          {fmtUsd(shown.lossIfSlUsd)}
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {shown.returnOnMarginIfSlPct.toFixed(1)}% on margin ({shown.leverage}x)
                            {shown.accountIfSl
                              ? ` · ${shown.accountIfSl.pctOfStart.toFixed(2)}% of account`
                              : ""}
                          </span>
                        </dd>
                      </div>
                      {shown.estimatedLiqLossUsd != null && shown.estimatedLiquidationPrice != null && (
                        <div className="col-span-2">
                          <dt className="text-[11px] text-muted-foreground">If liquidated (isolated est.)</dt>
                          <dd className="font-mono font-medium text-rose-600 dark:text-rose-400">
                            {fmtUsd(shown.estimatedLiqLossUsd)}
                            <span className="block text-[11px] font-normal text-muted-foreground">
                              at {formatQuotePrice(shown.estimatedLiquidationPrice)}
                              {shown.estimatedLiqLossPctOfMargin != null
                                ? ` · ${shown.estimatedLiqLossPctOfMargin.toFixed(1)}% of ${fmtUsdAbs(shown.marginUsd)} margin`
                                : ""}
                              {shown.estimatedLiqDistancePct != null
                                ? ` · ${shown.estimatedLiqDistancePct.toFixed(2)}% from entry`
                                : ""}
                            </span>
                          </dd>
                        </div>
                      )}
                      {shown.accountIfSl?.recoveryPct != null && (
                        <div className="col-span-2 text-[11px] text-muted-foreground">
                          After the stop you need about{" "}
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            +{shown.accountIfSl.recoveryPct.toFixed(2)}%
                          </span>{" "}
                          on remaining equity to get back to the starting balance.
                        </div>
                      )}
                      {shown.accountIfTp?.affordToLosePct != null && (
                        <div className="col-span-2 text-[11px] text-muted-foreground">
                          After the target you could lose about{" "}
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {shown.accountIfTp.affordToLosePct.toFixed(2)}%
                          </span>{" "}
                          of the new balance before you are back to start.
                        </div>
                      )}
                    </dl>
                  </div>

                  {shown.stopBeyondEstimatedLiq && (
                    <p className="text-[11px] rounded-md border border-rose-400/40 bg-rose-500/10 px-2.5 py-1.5 text-rose-800 dark:text-rose-200">
                      Stop is beyond estimated liquidation — size down or tighten the stop.
                    </p>
                  )}
                  {shown.notes.length > 0 && (
                    <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                      {shown.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={sendToScalper}>
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Send to Scalper
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={sendToNovaQ}>
                      Send to NovaQ
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Pivot points</p>
                <div className="flex items-center gap-2">
                  <select
                    value={pivotPeriod}
                    onChange={(e) => setPivotPeriod(e.target.value as "1d" | "1w" | "1M")}
                    className="text-xs border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800"
                  >
                    <option value="1d">Daily</option>
                    <option value="1w">Weekly</option>
                    <option value="1M">Monthly</option>
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={() => void quote()} disabled={loading}>
                    Refresh
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Previous completed {pivotPeriod === "1d" ? "day" : pivotPeriod === "1w" ? "week" : "month"}
                {pivotOhlc
                  ? ` · H ${formatQuotePrice(pivotOhlc.high)} L ${formatQuotePrice(pivotOhlc.low)} C ${formatQuotePrice(pivotOhlc.close)}`
                  : " · click Refresh / Calculate to load"}
                . Tap a level for TP, Shift+tap for SL. Floor R1/S1 can fill the ticket.
              </p>
              {pivots.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                          <th className="py-1 pr-2 font-medium">Level</th>
                          {pivots.map((p) => (
                            <th key={p.method} className="py-1 pr-2 font-medium text-right">
                              {p.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(["r4", "r3", "r2", "r1", "pp", "s1", "s2", "s3", "s4"] as const).map((key) => (
                          <tr key={key} className="border-b border-zinc-100 dark:border-zinc-800/80">
                            <td className="py-1 pr-2 font-mono uppercase text-muted-foreground">{key}</td>
                            {pivots.map((p) => {
                              const px = p[key];
                              return (
                                <td key={`${p.method}-${key}`} className="py-1 pr-2 text-right">
                                  {px == null ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="font-mono hover:underline"
                                      title="Click = take profit · Shift+click = stop"
                                      onClick={(ev) => applyPriceAs(px, ev.shiftKey ? "sl" : "tp")}
                                    >
                                      {formatQuotePrice(px)}
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={applyFloorTicket} disabled={!entry && livePrice == null}>
                    Use Floor R1 / S1 on this side
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No pivot bar yet — Calculate or Refresh after picking a symbol.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
