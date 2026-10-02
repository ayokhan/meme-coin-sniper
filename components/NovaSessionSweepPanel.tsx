"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SESSION_SWEEP_LOOKBACKS,
  SESSION_SWEEP_NAMES,
  SESSION_SWEEP_SESSION_HOURS,
  SESSION_SWEEP_STOP_MODES,
  SESSION_SWEEP_SYMBOLS,
  SESSION_SWEEP_TIMEFRAMES,
  formatSweepPrice,
  sweepLookbackLabel,
  type SessionName,
  type SessionRange,
  type SessionSweepResult,
  type SessionSweepScanRow,
  type SweepChart,
  type SweepLiveState,
  type SweepLookbackId,
  type SweepStopMode,
  type SweepTimeframe,
  type SweepTrade,
  type WatchedLevel,
} from "@/lib/session-sweep-types";

type Props = {
  /** Server-side access result (flag audience, VIP, or an admin grant). */
  enabled: boolean;
};

const SESSION_COLORS: Record<SessionName, { fill: string; stroke: string; text: string; chip: string }> = {
  Asia: {
    fill: "rgba(139,92,246,0.10)",
    stroke: "rgba(139,92,246,0.75)",
    text: "#8b5cf6",
    chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  London: {
    fill: "rgba(14,165,233,0.10)",
    stroke: "rgba(14,165,233,0.75)",
    text: "#0ea5e9",
    chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  "New York": {
    fill: "rgba(245,158,11,0.10)",
    stroke: "rgba(245,158,11,0.8)",
    text: "#f59e0b",
    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
};

const MARKET_LABEL = { metal: "Metals", forex: "Forex", crypto: "Crypto perps" } as const;

function fmtTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtR(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return "—";
  return `${r > 0 ? "+" : ""}${r.toFixed(2)}R`;
}

function stageMeta(live: SweepLiveState): { label: string; cls: string } {
  if (live.stage === "in_trade") {
    return live.direction === "long"
      ? { label: "Long entry live", cls: "bg-emerald-500 text-white" }
      : { label: "Short entry live", cls: "bg-rose-500 text-white" };
  }
  if (live.stage === "choch") return { label: "CHoCH confirmed: waiting for BOS", cls: "bg-violet-500 text-white" };
  if (live.stage === "swept") return { label: "Sweep: waiting for CHoCH", cls: "bg-amber-500 text-white" };
  return { label: "Watching levels", cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" };
}

function outcomeChip(tr: SweepTrade): { label: string; cls: string } {
  if (tr.outcome === "tp") return { label: "Target hit", cls: "text-emerald-600 dark:text-emerald-400" };
  if (tr.outcome === "sl") return { label: "Stopped", cls: "text-rose-600 dark:text-rose-400" };
  if (tr.outcome === "timeout") return { label: "Closed at 24h", cls: "text-zinc-500" };
  return { label: "Open", cls: "text-sky-600 dark:text-sky-400" };
}

function levelStatusLabel(l: WatchedLevel): { label: string; cls: string } {
  if (!l.active) return { label: "Expired", cls: "text-zinc-400" };
  if (l.status === "swept") return { label: "Swept", cls: "text-amber-600 dark:text-amber-400 font-semibold" };
  if (l.status === "raiding") return { label: "Being tested", cls: "text-amber-500" };
  if (l.status === "broken") return { label: "Broken", cls: "text-zinc-500" };
  return { label: "Untouched", cls: "text-emerald-600 dark:text-emerald-400" };
}

const CHART_SPAN_LABEL: Record<SweepTimeframe, string> = {
  "5m": "36 hours",
  "15m": "3 days",
  "30m": "5 days",
  "1h": "7 days",
};

const LEVEL_STATUS_HELP: { label: string; text: string }[] = [
  { label: "Untouched", text: "Price has not traded beyond this level yet. It is still a target for a sweep." },
  { label: "Being tested", text: "Price is beyond the level right now. If a candle closes back inside within 30 minutes, it becomes a sweep." },
  { label: "Swept", text: "Price poked beyond it and closed back inside. A setup may now form: watch for the CHoCH." },
  { label: "Broken", text: "Price stayed beyond it for more than 30 minutes. That is a real breakout, so no trade is taken off it." },
  { label: "Expired", text: "The range closed over 20 hours ago and is no longer used. A new range replaces it when that session ends." },
  { label: "Forming", text: "The session is open now, so its high and low can still move. It becomes a level when the session closes." },
];

function NextStepBox({ live, rr }: { live: SweepLiveState; rr: number }) {
  const isShort = live.direction === "short";
  const side = isShort ? "short (sell)" : "long (buy)";
  const beyond = isShort ? "below" : "above";
  let title = "No trade right now";
  let tone = "border-zinc-300 dark:border-zinc-600";
  let body: React.ReactNode = (
    <>
      Wait. Nothing to do until price sweeps one of the untouched session levels below. Turn on alerts or check back during the
      London or New York window.
    </>
  );

  if (live.stage === "swept") {
    title = "Get ready, but do not enter yet";
    tone = "border-amber-400";
    body = (
      <>
        The {live.sweptSession} {live.sweptSide} was swept. A {side} setup only starts if a candle <strong>closes {beyond}{" "}
        {formatSweepPrice(live.chochLevel)}</strong> (the change of character). If price instead closes back beyond{" "}
        {formatSweepPrice(live.sweptLevel)}, the idea is cancelled.
      </>
    );
  } else if (live.stage === "choch") {
    tone = "border-violet-400";
    if (live.plannedEntry != null) {
      title = `Set an alert at ${formatSweepPrice(live.plannedEntry)}`;
      body = (
        <>
          Change of character confirmed. Enter {side} only when a candle <strong>closes {beyond} {formatSweepPrice(live.plannedEntry)}</strong>{" "}
          (the break of structure), not on a wick. Expected plan: stop {formatSweepPrice(live.plannedStop)}, target{" "}
          {formatSweepPrice(live.plannedTarget)} ({rr}R). The exact numbers lock in on the closing candle.
        </>
      );
    } else {
      title = "Waiting for the pullback";
      body = (
        <>
          Change of character confirmed. Price now needs a small pullback swing; that sets the break-of-structure level and the
          entry price will appear here. Do not enter yet.
        </>
      );
    }
  } else if (live.stage === "in_trade" && live.trade) {
    const tr = live.trade;
    tone = tr.direction === "long" ? "border-emerald-500" : "border-rose-500";
    title = live.entryStillValid ? `Entry is live: ${tr.direction === "long" ? "buy" : "sell"} now` : "Entry already moved: skip it";
    body = live.entryStillValid ? (
      <>
        Triggered at {fmtTime(tr.entryTs)} at {formatSweepPrice(tr.entry)}. Price is still close to the entry, so you can take it:
        stop {formatSweepPrice(tr.stop)}, target {formatSweepPrice(tr.target)}. Size it so the stop costs a small fixed part of
        your account.
      </>
    ) : (
      <>
        Triggered at {fmtTime(tr.entryTs)} at {formatSweepPrice(tr.entry)}, but price has moved more than 0.3R since. Entering
        late makes the risk/reward worse than 1:{rr}. Wait for the next setup.
      </>
    );
  }

  return (
    <div className={`rounded-lg border-2 ${tone} p-3`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">What to do now</p>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
      <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed">{body}</p>
    </div>
  );
}

function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function SweepChartView({ chart, tfMinutes, highlightId }: { chart: SweepChart; tfMinutes: number; highlightId: string | null }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 420;
  const padL = 8;
  const padR = 72;
  const padT = 16;
  const padB = 28;
  const bars = chart.bars;
  const tfMs = tfMinutes * 60_000;

  const geom = useMemo(() => {
    if (bars.length === 0 || width < 100) return null;
    const plotW = width - padL - padR;
    const step = plotW / bars.length;
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of bars) {
      lo = Math.min(lo, b[3]);
      hi = Math.max(hi, b[2]);
    }
    for (const tr of chart.trades) {
      for (const p of [tr.stop, tr.target, tr.entry, tr.sweepExtreme]) {
        lo = Math.min(lo, p);
        hi = Math.max(hi, p);
      }
    }
    const pad = (hi - lo) * 0.04 || hi * 0.001;
    lo -= pad;
    hi += pad;
    const y = (p: number) => padT + ((hi - p) / (hi - lo)) * (height - padT - padB);
    const idxAt = (ts: number) => {
      let a = 0;
      let b = bars.length - 1;
      if (ts <= bars[0]![0]) return 0;
      if (ts >= bars[b]![0]) return b;
      while (a < b) {
        const m = (a + b + 1) >> 1;
        if (bars[m]![0] <= ts) a = m;
        else b = m - 1;
      }
      return a;
    };
    const x = (i: number) => padL + i * step + step / 2;
    const xTs = (ts: number) => x(idxAt(ts));
    return { plotW, step, lo, hi, y, x, xTs, idxAt };
  }, [bars, chart.trades, width]);

  const priceTicks = useMemo(() => {
    if (!geom) return [];
    const n = 6;
    return Array.from({ length: n }, (_, k) => geom.lo + ((geom.hi - geom.lo) * (k + 0.5)) / n);
  }, [geom]);

  const timeTicks = useMemo(() => {
    if (!geom) return [] as { i: number; label: string }[];
    const every = Math.max(1, Math.round(110 / geom.step));
    const out: { i: number; label: string }[] = [];
    let lastDay = "";
    for (let i = 0; i < bars.length; i += every) {
      const d = new Date(bars[i]![0]);
      const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      out.push({ i, label: day !== lastDay ? `${day} ${time}` : time });
      lastDay = day;
    }
    return out;
  }, [bars, geom]);

  if (bars.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No candles in this window.</p>;
  }

  const hovered = hover != null ? bars[hover] : null;
  const chartEndTs = bars[bars.length - 1]![0];

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      {geom && (
        <svg
          width={width}
          height={height}
          className="block"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const i = Math.floor((e.clientX - rect.left - padL) / geom.step);
            setHover(i >= 0 && i < bars.length ? i : null);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {priceTicks.map((p) => (
            <g key={p}>
              <line x1={padL} x2={width - padR} y1={geom.y(p)} y2={geom.y(p)} stroke="currentColor" strokeOpacity={0.07} />
              <text x={width - padR + 6} y={geom.y(p) + 3} fontSize={10} fill="currentColor" fillOpacity={0.55}>
                {formatSweepPrice(p)}
              </text>
            </g>
          ))}
          {timeTicks.map((tk) => (
            <text
              key={tk.i}
              x={geom.x(tk.i)}
              y={height - 8}
              fontSize={10}
              textAnchor="middle"
              fill="currentColor"
              fillOpacity={0.55}
            >
              {tk.label}
            </text>
          ))}

          {chart.ranges.map((r) => {
            const c = SESSION_COLORS[r.session];
            const x1 = geom.xTs(r.startTs) - geom.step / 2;
            const x2 = geom.xTs(r.endTs - tfMs) + geom.step / 2;
            const yH = geom.y(r.high);
            const yL = geom.y(r.low);
            const extendTo = geom.xTs(Math.min(r.endTs + 20 * 3_600_000, chartEndTs)) + geom.step / 2;
            return (
              <g key={r.key}>
                <rect x={x1} y={yH} width={Math.max(1, x2 - x1)} height={Math.max(1, yL - yH)} fill={c.fill} stroke={c.stroke} strokeWidth={1} />
                {extendTo > x2 && (
                  <>
                    <line x1={x2} x2={extendTo} y1={yH} y2={yH} stroke={c.stroke} strokeDasharray="4 3" strokeWidth={1} />
                    <line x1={x2} x2={extendTo} y1={yL} y2={yL} stroke={c.stroke} strokeDasharray="4 3" strokeWidth={1} />
                  </>
                )}
                <text x={x1 + 3} y={yH - 4} fontSize={10} fontWeight={600} fill={c.text}>
                  {r.session} H {formatSweepPrice(r.high)}
                </text>
                <text x={x1 + 3} y={yL + 12} fontSize={10} fontWeight={600} fill={c.text}>
                  L {formatSweepPrice(r.low)}
                </text>
              </g>
            );
          })}

          {bars.map((b, i) => {
            const up = b[4] >= b[1];
            const color = up ? "#10b981" : "#f43f5e";
            const cx = geom.x(i);
            const bw = Math.max(1, geom.step * 0.65);
            const yO = geom.y(b[1]);
            const yC = geom.y(b[4]);
            return (
              <g key={b[0]}>
                <line x1={cx} x2={cx} y1={geom.y(b[2])} y2={geom.y(b[3])} stroke={color} strokeWidth={1} />
                <rect x={cx - bw / 2} y={Math.min(yO, yC)} width={bw} height={Math.max(1, Math.abs(yC - yO))} fill={color} />
              </g>
            );
          })}

          {chart.trades.map((tr) => {
            const isShort = tr.direction === "short";
            const xs = geom.xTs(tr.sweepTs);
            const xc = geom.xTs(tr.chochTs);
            const xe = geom.xTs(tr.entryTs);
            const xx = geom.xTs(tr.exitTs ?? chartEndTs) + geom.step / 2;
            const dim = highlightId && highlightId !== tr.id ? 0.35 : 1;
            const yExt = geom.y(tr.sweepExtreme);
            const tri = isShort
              ? `${xs - 5},${yExt - 10} ${xs + 5},${yExt - 10} ${xs},${yExt - 3}`
              : `${xs - 5},${yExt + 10} ${xs + 5},${yExt + 10} ${xs},${yExt + 3}`;
            return (
              <g key={tr.id} opacity={dim}>
                <polygon points={tri} fill="#f59e0b" />
                <text x={xs} y={isShort ? yExt - 13 : yExt + 21} fontSize={10} fontWeight={700} textAnchor="middle" fill="#f59e0b">
                  Sweep
                </text>
                <line x1={xc - 18} x2={xc + 6} y1={geom.y(tr.chochLevel)} y2={geom.y(tr.chochLevel)} stroke="#8b5cf6" strokeWidth={1.5} />
                <text x={xc - 18} y={geom.y(tr.chochLevel) + (isShort ? 12 : -4)} fontSize={10} fontWeight={700} fill="#8b5cf6">
                  CHoCH
                </text>
                <line x1={xe - 18} x2={xe + 6} y1={geom.y(tr.bosLevel)} y2={geom.y(tr.bosLevel)} stroke="#6366f1" strokeWidth={1.5} />
                <text x={xe - 18} y={geom.y(tr.bosLevel) + (isShort ? 12 : -4)} fontSize={10} fontWeight={700} fill="#6366f1">
                  BOS
                </text>
                <rect
                  x={xe}
                  y={Math.min(geom.y(tr.entry), geom.y(tr.target))}
                  width={Math.max(2, xx - xe)}
                  height={Math.abs(geom.y(tr.target) - geom.y(tr.entry))}
                  fill="rgba(16,185,129,0.12)"
                />
                <rect
                  x={xe}
                  y={Math.min(geom.y(tr.entry), geom.y(tr.stop))}
                  width={Math.max(2, xx - xe)}
                  height={Math.abs(geom.y(tr.stop) - geom.y(tr.entry))}
                  fill="rgba(244,63,94,0.14)"
                />
                <line x1={xe} x2={xx} y1={geom.y(tr.entry)} y2={geom.y(tr.entry)} stroke="currentColor" strokeOpacity={0.6} strokeWidth={1} />
                <text x={xe + 3} y={geom.y(tr.target) + (isShort ? -4 : 12)} fontSize={10} fontWeight={600} fill="#10b981">
                  TP {formatSweepPrice(tr.target)}
                </text>
                <text x={xe + 3} y={geom.y(tr.stop) + (isShort ? 12 : -4)} fontSize={10} fontWeight={600} fill="#f43f5e">
                  SL {formatSweepPrice(tr.stop)}
                </text>
                <text x={xe + 3} y={geom.y(tr.entry) - 3} fontSize={10} fontWeight={600} fill="currentColor" fillOpacity={0.8}>
                  {isShort ? "Short" : "Long"} {formatSweepPrice(tr.entry)}
                </text>
              </g>
            );
          })}

          {hover != null && (
            <line x1={geom.x(hover)} x2={geom.x(hover)} y1={padT} y2={height - padB} stroke="currentColor" strokeOpacity={0.25} />
          )}
        </svg>
      )}
      {hovered && (
        <div className="absolute left-2 top-1 text-[10px] font-mono tabular-nums bg-white/85 dark:bg-zinc-900/85 rounded px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300">
          {fmtTime(hovered[0])} O {formatSweepPrice(hovered[1])} H {formatSweepPrice(hovered[2])} L {formatSweepPrice(hovered[3])} C{" "}
          {formatSweepPrice(hovered[4])}
        </div>
      )}
    </div>
  );
}

function EquitySparkline({ equity }: { equity: number[] }) {
  if (equity.length < 2) return null;
  const w = 260;
  const h = 56;
  const pts = [0, ...equity];
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || 1;
  const path = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - ((v - lo) / span) * h).toFixed(1)}`)
    .join(" ");
  const zeroY = h - ((0 - lo) / span) * h;
  const final = pts[pts.length - 1]!;
  return (
    <svg width={w} height={h} className="block">
      <line x1={0} x2={w} y1={zeroY} y2={zeroY} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 3" />
      <path d={path} fill="none" stroke={final >= 0 ? "#10b981" : "#f43f5e"} strokeWidth={2} />
    </svg>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`text-base font-semibold tabular-nums ${
          tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-rose-600 dark:text-rose-400" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function NovaSessionSweepPanel({ enabled }: Props) {
  const [symbol, setSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState<SweepTimeframe>("5m");
  const [lookback, setLookback] = useState<SweepLookbackId>("14d");
  const [alertsOn, setAlertsOn] = useState(false);
  const lastAlertKey = useRef<string | null>(null);
  const [stopMode, setStopMode] = useState<SweepStopMode>("structure");
  const [result, setResult] = useState<SessionSweepResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<SweepTrade | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [scanRows, setScanRows] = useState<SessionSweepScanRow[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const reqSeq = useRef(0);

  const tfMinutes = SESSION_SWEEP_TIMEFRAMES.find((t) => t.id === timeframe)?.minutes ?? 5;

  const load = useCallback(
    async (opts?: { focusTs?: number | null; quiet?: boolean }) => {
      const seq = ++reqSeq.current;
      if (!opts?.quiet) setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/nova-session-sweep", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, timeframe, lookback, stopMode, focusTs: opts?.focusTs ?? null }),
        });
        const data = await res.json();
        if (seq !== reqSeq.current) return;
        if (!res.ok || !data.success) {
          setError(data.error ?? "Analysis failed");
          return;
        }
        const next = data.result as SessionSweepResult;
        setResult(next);
        notifyIfNew(next);
      } catch {
        if (seq === reqSeq.current) setError("Network error");
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol, timeframe, lookback, stopMode]
  );

  const alertsOnRef = useRef(alertsOn);
  alertsOnRef.current = alertsOn;

  /** First result per symbol only records the state, so opening the tab never fires an old alert. */
  function notifyIfNew(r: SessionSweepResult) {
    const l = r.live;
    const key =
      l.stage === "in_trade" && l.trade
        ? `${r.symbol}|trade|${l.trade.id}`
        : l.stage === "choch" && l.plannedEntry != null
          ? `${r.symbol}|bos|${l.plannedEntry}`
          : `${r.symbol}|${l.stage}`;
    const prev = lastAlertKey.current;
    lastAlertKey.current = key;
    if (!alertsOnRef.current || !prev || !prev.startsWith(`${r.symbol}|`) || prev === key) return;
    if (l.stage !== "in_trade" && l.stage !== "choch") return;
    const title =
      l.stage === "in_trade" && l.trade
        ? `${r.symbol}: ${l.trade.direction === "long" ? "LONG" : "SHORT"} entry ${formatSweepPrice(l.trade.entry)}`
        : `${r.symbol}: CHoCH confirmed, watch ${formatSweepPrice(l.plannedEntry ?? l.bosLevel)}`;
    const body =
      l.stage === "in_trade" && l.trade
        ? `Stop ${formatSweepPrice(l.trade.stop)} · Target ${formatSweepPrice(l.trade.target)}`
        : "Entry triggers on a candle close beyond the break-of-structure level.";
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        osc.frequency.value = 880;
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      /* notifications are best-effort */
    }
  }

  const toggleAlerts = async (on: boolean) => {
    if (on && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => "denied");
    }
    setAlertsOn(on);
    if (on) setAutoRefresh(true);
  };

  useEffect(() => {
    if (!enabled) return;
    setFocus(null);
    setShowAllTrades(false);
    void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !autoRefresh || focus) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" || alertsOnRef.current) void load({ quiet: true });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [enabled, autoRefresh, focus, load]);

  const runScan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/nova-session-sweep", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "scan", timeframe, lookback, stopMode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setScanError(data.error ?? "Scan failed");
        return;
      }
      setScanRows(data.rows as SessionSweepScanRow[]);
    } catch {
      setScanError("Network error");
    } finally {
      setScanning(false);
    }
  }, [timeframe, lookback, stopMode]);

  const focusTrade = (tr: SweepTrade) => {
    setFocus(tr);
    void load({ focusTs: Math.round((tr.sweepTs + (tr.exitTs ?? tr.entryTs)) / 2) });
  };

  const backToLive = () => {
    setFocus(null);
    void load();
  };

  if (!enabled) {
    return <p className="text-sm text-muted-foreground">Nova Session Sweep is not available on your account yet.</p>;
  }

  const live = result?.live ?? null;
  const stats = result?.stats ?? null;
  const stage = live ? stageMeta(live) : null;
  const trades = result?.trades ?? [];
  const visibleTrades = showAllTrades ? trades : trades.slice(0, 15);
  const smallSample = stats != null && stats.trades < 30;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Nova Session Sweep</h2>
        <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
          Marks the Asia, London and New York session highs and lows. When price sweeps one of those levels, the indicator
          waits for a change of character (CHoCH) and a break of structure (BOS) on closed candles, then gives an entry with a
          stop and a 1:3 target. Every number below comes from fixed rules, not AI.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">
          Market
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="mt-1 block min-w-[180px] rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          >
            {(["metal", "forex", "crypto"] as const).map((m) => (
              <optgroup key={m} label={MARKET_LABEL[m]}>
                {SESSION_SWEEP_SYMBOLS.filter((s) => s.market === m).map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} · {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Candles
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as SweepTimeframe)}
            className="mt-1 block rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          >
            {SESSION_SWEEP_TIMEFRAMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Backtest
          <select
            value={lookback}
            onChange={(e) => setLookback(e.target.value as SweepLookbackId)}
            className="mt-1 block rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          >
            {SESSION_SWEEP_LOOKBACKS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Stop
          <select
            value={stopMode}
            onChange={(e) => setStopMode(e.target.value as SweepStopMode)}
            title={SESSION_SWEEP_STOP_MODES.find((m) => m.id === stopMode)?.hint}
            className="mt-1 block rounded-md border border-zinc-300 dark:border-zinc-600 px-2 py-1.5 text-sm bg-white dark:bg-zinc-800"
          >
            {SESSION_SWEEP_STOP_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <Button size="sm" onClick={() => (focus ? backToLive() : void load())} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1.5 cursor-pointer">
          <input type="checkbox" className="rounded" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Auto-refresh every minute
        </label>
        <label
          className="flex items-center gap-1.5 text-xs text-muted-foreground pb-1.5 cursor-pointer"
          title="Browser notification and a beep when this market confirms a CHoCH or triggers an entry. Keep this tab open."
        >
          <input type="checkbox" className="rounded" checked={alertsOn} onChange={(e) => void toggleAlerts(e.target.checked)} />
          Alert me on {symbol}
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        {SESSION_SWEEP_STOP_MODES.find((m) => m.id === stopMode)?.hint} Alerts work while this tab stays open.
      </p>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {result && live && stage && (
        <>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${stage.cls}`}>{stage.label}</span>
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {result.symbol} · {result.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Last price {formatSweepPrice(live.lastPrice)} · candle closed {fmtTime(live.lastBarTs != null ? live.lastBarTs + tfMinutes * 60_000 : null)}
                {live.currentHunt ? ` · ${live.currentHunt} window open` : " · between windows (no new setups until Asia)"}
              </span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{live.message}</p>
            <NextStepBox live={live} rr={result.rr} />
            {live.stage !== "idle" && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <StatTile label={`Swept ${live.sweptSession ?? ""} ${live.sweptSide ?? ""}`} value={formatSweepPrice(live.sweptLevel)} />
                <StatTile label="Sweep wick" value={formatSweepPrice(live.sweepExtreme)} />
                <StatTile label="CHoCH level" value={formatSweepPrice(live.chochLevel)} />
                <StatTile label="BOS level" value={formatSweepPrice(live.bosLevel)} />
              </div>
            )}
            {live.trade && (
              <div
                className={`grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg p-2 ${
                  live.trade.direction === "long" ? "bg-emerald-500/5" : "bg-rose-500/5"
                }`}
              >
                <StatTile label={`${live.trade.direction === "long" ? "Long" : "Short"} entry`} value={formatSweepPrice(live.trade.entry)} />
                <StatTile label="Stop loss" value={formatSweepPrice(live.trade.stop)} tone="bad" />
                <StatTile label={`Target (${result.rr}R)`} value={formatSweepPrice(live.trade.target)} tone="good" />
                <StatTile
                  label="Now"
                  value={fmtR(live.trade.r)}
                  tone={(live.trade.r ?? 0) > 0 ? "good" : (live.trade.r ?? 0) < 0 ? "bad" : undefined}
                />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Session levels</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              {SESSION_SWEEP_NAMES.map((name) => {
                const hi = result.levels.find((l) => l.session === name && l.side === "high");
                const lo = result.levels.find((l) => l.session === name && l.side === "low");
                const forming: SessionRange | undefined = (result.forming ?? []).find((r) => r.session === name);
                return (
                  <div key={name} className={`rounded-lg border px-3 py-2 ${SESSION_COLORS[name].chip}`}>
                    <p className="text-xs font-semibold">{name}</p>
                    <p className="text-[10px] opacity-80 mb-1">{SESSION_SWEEP_SESSION_HOURS[name]}</p>
                    {forming && (
                      <div className="mb-1 rounded border border-dashed border-current/40 px-1.5 py-1 text-xs tabular-nums">
                        <p className="text-[10px] font-semibold uppercase tracking-wide">Forming now</p>
                        <div className="flex justify-between">
                          <span>High {formatSweepPrice(forming.high)}</span>
                          <span>Low {formatSweepPrice(forming.low)}</span>
                        </div>
                      </div>
                    )}
                    {(hi || lo) && forming && <p className="text-[10px] opacity-70">Previous range</p>}
                    {[hi, lo].map((l) =>
                      l ? (
                        <div key={l.side} className="flex items-center justify-between text-xs tabular-nums">
                          <span>
                            {l.side === "high" ? "High" : "Low"} {formatSweepPrice(l.price)}
                          </span>
                          <span className={levelStatusLabel(l).cls}>{levelStatusLabel(l).label}</span>
                        </div>
                      ) : null
                    )}
                    {!hi && !forming && <p className="text-xs opacity-70">No completed range yet</p>}
                  </div>
                );
              })}
            </div>
            <details className="mt-2 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">What do Untouched, Swept, Broken and Expired mean?</summary>
              <ul className="mt-1.5 space-y-1">
                {LEVEL_STATUS_HELP.map((h) => (
                  <li key={h.label}>
                    <strong className="text-zinc-700 dark:text-zinc-300">{h.label}:</strong> {h.text}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {focus ? `Trade from ${fmtTime(focus.entryTs)}` : `Last ${CHART_SPAN_LABEL[result.timeframe]}`}
              </h3>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {SESSION_SWEEP_NAMES.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1">
                    <span className="inline-block w-3 h-2 rounded-sm border" style={{ background: SESSION_COLORS[n].fill, borderColor: SESSION_COLORS[n].stroke }} />
                    {n}
                  </span>
                ))}
                {focus && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={backToLive}>
                    Back to live
                  </Button>
                )}
              </div>
            </div>
            <div className="text-zinc-800 dark:text-zinc-200">
              <SweepChartView chart={result.chart} tfMinutes={tfMinutes} highlightId={focus?.id ?? null} />
            </div>
          </div>

          {stats && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Backtest · {result.symbol} · {result.timeframe} candles · {sweepLookbackLabel(result.lookbackHours).toLowerCase()} ·{" "}
                  {SESSION_SWEEP_STOP_MODES.find((m) => m.id === result.stopMode)?.label.toLowerCase()}
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {result.barsAnalyzed.toLocaleString()} candles · {fmtTime(result.firstBarTs)} to {fmtTime(result.lastBarTs)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <StatTile label="Closed trades" value={String(stats.trades)} />
                <StatTile label="Win rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} />
                <StatTile label="Total" value={fmtR(stats.totalR)} tone={stats.totalR > 0 ? "good" : stats.totalR < 0 ? "bad" : undefined} />
                <StatTile label="Average per trade" value={fmtR(stats.avgR)} tone={(stats.avgR ?? 0) > 0 ? "good" : (stats.avgR ?? 0) < 0 ? "bad" : undefined} />
                <StatTile label="Profit factor" value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"} />
                <StatTile label="Worst losing run" value={String(stats.maxLosingStreak)} />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="text-zinc-800 dark:text-zinc-200">
                  <EquitySparkline equity={stats.equity} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs flex-1 min-w-[260px]">
                  {SESSION_SWEEP_NAMES.map((n) => {
                    const s = stats.bySession[n];
                    return (
                      <div key={n} className={`rounded border px-2 py-1 ${SESSION_COLORS[n].chip}`}>
                        <p className="font-semibold">{n} window</p>
                        <p className="tabular-nums">
                          {s.trades} trades · {s.wins} wins · {fmtR(s.totalR)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {smallSample
                  ? `Only ${stats.trades} closed trade${stats.trades === 1 ? "" : "s"}. Fewer than 30 trades is too small to judge an edge, so try a longer backtest or 15-minute candles. `
                  : ""}
                At 1:3, about 1 win in 4 is breakeven before costs. Results ignore spread, commission and slippage. If a candle
                touches both the stop and the target, it counts as a loss. {result.dataNote}
              </p>
            </div>
          )}

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Signals ({trades.length})</h3>
            {trades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                      <th className="py-1.5 pr-2">Entry time</th>
                      <th className="py-1.5 pr-2">Window</th>
                      <th className="py-1.5 pr-2">Side</th>
                      <th className="py-1.5 pr-2">Swept</th>
                      <th className="py-1.5 pr-2 text-right">Entry</th>
                      <th className="py-1.5 pr-2 text-right">Stop</th>
                      <th className="py-1.5 pr-2 text-right">Target</th>
                      <th className="py-1.5 pr-2">Result</th>
                      <th className="py-1.5 text-right">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTrades.map((tr) => {
                      const oc = outcomeChip(tr);
                      return (
                        <tr
                          key={tr.id}
                          onClick={() => focusTrade(tr)}
                          className={`border-b border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                            focus?.id === tr.id ? "bg-violet-500/10" : ""
                          }`}
                        >
                          <td className="py-1.5 pr-2 whitespace-nowrap">{fmtTime(tr.entryTs)}</td>
                          <td className="py-1.5 pr-2" style={{ color: SESSION_COLORS[tr.huntSession].text }}>
                            {tr.huntSession}
                          </td>
                          <td className={`py-1.5 pr-2 font-semibold ${tr.direction === "long" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {tr.direction === "long" ? "Long" : "Short"}
                          </td>
                          <td className="py-1.5 pr-2 whitespace-nowrap">
                            {tr.sweptSession} {tr.sweptSide} {formatSweepPrice(tr.sweptLevel)}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatSweepPrice(tr.entry)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatSweepPrice(tr.stop)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatSweepPrice(tr.target)}</td>
                          <td className={`py-1.5 pr-2 ${oc.cls}`}>{oc.label}</td>
                          <td className="py-1.5 text-right tabular-nums font-semibold">{fmtR(tr.r)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {trades.length > visibleTrades.length && (
                  <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setShowAllTrades(true)}>
                    Show all {trades.length}
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground mt-2">Click a row to show that trade on the chart.</p>
              </div>
            )}
          </div>
        </>
      )}

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">All markets</h3>
            <p className="text-xs text-muted-foreground">
              Live state and backtest for every market with the settings above ({timeframe} candles,{" "}
              {(SESSION_SWEEP_LOOKBACKS.find((l) => l.id === lookback)?.label ?? lookback).toLowerCase()}).
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void runScan()} disabled={scanning}>
            {scanning ? "Scanning…" : scanRows ? "Rescan" : `Scan all ${SESSION_SWEEP_SYMBOLS.length} markets`}
          </Button>
        </div>
        {scanError && <p className="text-sm text-rose-600 dark:text-rose-400">{scanError}</p>}
        {scanRows && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                  <th className="py-1.5 pr-2">Market</th>
                  <th className="py-1.5 pr-2">Now</th>
                  <th className="py-1.5 pr-2">Last signal</th>
                  <th className="py-1.5 pr-2 text-right">Trades</th>
                  <th className="py-1.5 pr-2 text-right">Win rate</th>
                  <th className="py-1.5 pr-2 text-right">Total</th>
                  <th className="py-1.5 text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {scanRows.map((row) => {
                  const st = row.live ? stageMeta(row.live) : null;
                  return (
                    <tr
                      key={row.symbol}
                      onClick={() => setSymbol(row.symbol)}
                      className={`border-b border-zinc-100 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                        row.symbol === symbol ? "bg-violet-500/10" : ""
                      }`}
                    >
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <span className="font-semibold">{row.symbol}</span>{" "}
                        <span className="text-muted-foreground">{MARKET_LABEL[row.market]}</span>
                      </td>
                      <td className="py-1.5 pr-2">
                        {row.ok && st ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                        ) : (
                          <span className="text-rose-500">{row.error ?? "Failed"}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {row.lastTrade ? (
                          <>
                            {row.lastTrade.direction === "long" ? "Long" : "Short"} · {fmtTime(row.lastTrade.entryTs)} ·{" "}
                            <span className={outcomeChip(row.lastTrade).cls}>{outcomeChip(row.lastTrade).label}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{row.stats?.trades ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{row.stats?.winRate != null ? `${row.stats.winRate}%` : "—"}</td>
                      <td
                        className={`py-1.5 pr-2 text-right tabular-nums font-semibold ${
                          (row.stats?.totalR ?? 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : (row.stats?.totalR ?? 0) < 0 ? "text-rose-600 dark:text-rose-400" : ""
                        }`}
                      >
                        {fmtR(row.stats?.totalR)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{fmtR(row.stats?.avgR)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">How to use this tab</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1.5">
          <li>
            <strong>Pick a market</strong> and candle size. 5m and 15m give the most precise entries; 30m and 1h give fewer,
            slower setups. Larger candles (4h, daily) are not offered because a whole session fits inside one or two of them.
          </li>
          <li>
            <strong>Check the backtest first.</strong> Choose a window (4 hours to 60 days) and compare the tight and wide stops.
            Only trust a market that is positive over at least 30 trades; short windows are for reviewing recent signals.
          </li>
          <li>
            <strong>Read the &quot;What to do now&quot; box.</strong> It tells you whether to wait, get ready, set an alert at the
            entry price, or take the trade. Only enter when it says the entry is live.
          </li>
          <li>
            <strong>Enter on the candle close</strong> beyond the break-of-structure level, with the stop and target shown. If
            price has already run more than 0.3R from the entry, skip it and wait for the next setup.
          </li>
          <li>
            <strong>Turn on alerts</strong> to get a browser notification and a beep when your market confirms a CHoCH or
            triggers an entry. Keep the tab open; click any past signal to see it on the chart.
          </li>
        </ol>
      </details>

      <details className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">How the rules work</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1.5">
          <li>
            <strong>Session ranges.</strong> Asia is {SESSION_SWEEP_SESSION_HOURS.Asia}, London is {SESSION_SWEEP_SESSION_HOURS.London},
            New York is {SESSION_SWEEP_SESSION_HOURS["New York"]}. Daylight saving is handled for both cities. A range stays tradable for
            about 20 hours after it closes.
          </li>
          <li>
            <strong>Sweep.</strong> Price trades beyond a session high or low, then a candle closes back inside within 30 minutes. If
            price stays outside longer, the level is treated as broken, not swept. New sweeps are only taken in the London window
            (London open to New York 7am), New York window (7am–1pm) and Asia window (8pm to London open).
          </li>
          <li>
            <strong>Change of character (CHoCH).</strong> Within 3 hours of the sweep, a candle closes beyond the last swing that
            led into the sweep. A swing is a candle whose high or low beats the 2 candles on each side, so it is only known 2
            candles later.
          </li>
          <li>
            <strong>Break of structure (BOS).</strong> Within 4 hours of the CHoCH, price makes a pullback swing (a lower high for
            shorts or a higher low for longs), then closes beyond the low or high of the CHoCH move. That close is the entry.
          </li>
          <li>
            <strong>Stop and target.</strong> The structure stop sits just beyond the pullback swing, and the sweep stop sits beyond
            the sweep wick. The stop is never tighter than half the average candle range (ATR), and setups needing more than 6× ATR
            are skipped. The target is 3× the risk. Trades still open after 24 hours are closed at market.
          </li>
          <li>
            <strong>One idea at a time.</strong> While a trade is open, new sweeps are ignored. Signals only use closed candles,
            and past signals never change.
          </li>
        </ol>
        <p className="mt-3">
          Educational tool, not financial advice. Backtests use historical candles and cannot include spread, commission,
          slippage or news spikes. Size every trade so that one stop-out is a small, fixed part of your account.
        </p>
      </details>
    </div>
  );
}
