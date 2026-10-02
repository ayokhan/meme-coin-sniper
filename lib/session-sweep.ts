/**
 * Nova Session Sweep engine — session liquidity sweep → CHoCH → BOS entries with a fixed R:R target.
 *
 * Bars are processed oldest → newest and every decision uses only closed bars up to that point,
 * so the backtest and the live read never see the future and nothing is redrawn.
 */
import type {
  LevelStatus,
  SessionName,
  SessionRange,
  SweepDirection,
  SweepLiveState,
  SweepStats,
  SweepStopMode,
  SweepTrade,
  WatchedLevel,
} from "@/lib/session-sweep-types";
import { SESSION_SWEEP_NAMES } from "@/lib/session-sweep-types";

export type SweepBar = { t: number; o: number; h: number; l: number; c: number };

export type SweepRunOptions = {
  tfMinutes: number;
  stopMode: SweepStopMode;
  rr?: number;
};

export type SweepRun = {
  ranges: SessionRange[];
  building: SessionRange[];
  trades: SweepTrade[];
  levels: WatchedLevel[];
  live: SweepLiveState;
};

const HOUR_MS = 3_600_000;
/** A completed session range can be swept for this long after it closes. */
const LEVEL_FRESH_MS = 20 * HOUR_MS;
const SWING_SPAN = 2;
const ATR_PERIOD = 14;
const STOP_BUFFER_ATR = 0.1;
const MIN_RISK_ATR = 0.5;
const MAX_RISK_ATR = 6;

const NY_TZ = "America/New_York";
const LDN_TZ = "Europe/London";

const formatters: Record<string, Intl.DateTimeFormat> = {};
function tzFormatter(tz: string): Intl.DateTimeFormat {
  if (!formatters[tz]) {
    formatters[tz] = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });
  }
  return formatters[tz]!;
}

type LocalHour = { hour: number; dateKey: string };
const localHourCache = new Map<string, LocalHour>();

/** NY and London offsets are whole hours, so local hour + UTC minute gives local minute-of-day. */
function localHour(ts: number, tz: string): LocalHour {
  const bucket = Math.floor(ts / HOUR_MS);
  const key = `${tz}|${bucket}`;
  const hit = localHourCache.get(key);
  if (hit) return hit;
  if (localHourCache.size > 100_000) localHourCache.clear();
  const parts = tzFormatter(tz).formatToParts(new Date(bucket * HOUR_MS));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const value: LocalHour = {
    hour: Number(get("hour")) % 24,
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
  localHourCache.set(key, value);
  return value;
}

type Clock = { nyMin: number; nyDate: string; ldMin: number; ldDate: string };

function clockFor(ts: number): Clock {
  const minute = new Date(ts).getUTCMinutes();
  const ny = localHour(ts, NY_TZ);
  const ld = localHour(ts, LDN_TZ);
  return { nyMin: ny.hour * 60 + minute, nyDate: ny.dateKey, ldMin: ld.hour * 60 + minute, ldDate: ld.dateKey };
}

function sessionKeyFor(name: SessionName, ck: Clock): string | null {
  if (name === "Asia") return ck.nyMin >= 20 * 60 ? `Asia:${ck.nyDate}` : null;
  if (name === "London") return ck.ldMin >= 7 * 60 && ck.ldMin < 10 * 60 ? `London:${ck.ldDate}` : null;
  return ck.nyMin >= 7 * 60 && ck.nyMin < 10 * 60 ? `New York:${ck.nyDate}` : null;
}

/**
 * Window in which a new sweep may start:
 * London = London open → NY session start, New York = 7am–1pm NY, Asia = 8pm NY → London open.
 * New York afternoon (1pm–8pm) starts no new setups.
 */
export function huntSessionAt(ts: number): SessionName | null {
  const ck = clockFor(ts);
  if (ck.nyMin >= 7 * 60 && ck.nyMin < 13 * 60) return "New York";
  if (ck.ldMin >= 7 * 60 && ck.nyMin < 7 * 60) return "London";
  if (ck.nyMin >= 20 * 60 || ck.ldMin < 7 * 60) return "Asia";
  return null;
}

type SideState = {
  status: LevelStatus;
  raidStart: number;
  extreme: number;
  extremeIdx: number;
  hunt: SessionName | null;
};

type LevelSlot = { range: SessionRange; high: SideState; low: SideState };

type SweepEvent = {
  session: SessionName;
  side: "high" | "low";
  level: number;
  extreme: number;
  extremeIdx: number;
  raidStart: number;
  hunt: SessionName;
};

type Setup = {
  dir: SweepDirection;
  ev: SweepEvent;
  stage: "swept" | "choch";
  sweepIdx: number;
  extreme: number;
  protectedLevel: number;
  chochIdx: number;
  structureSwing: number | null;
  bosLevel: number | null;
};

type Swing = { i: number; price: number };

function freshSide(): SideState {
  return { status: "untouched", raidStart: -1, extreme: 0, extremeIdx: -1, hunt: null };
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function runSessionSweep(bars: SweepBar[], opts: SweepRunOptions): SweepRun {
  const rr = opts.rr ?? 3;
  const tfMs = opts.tfMinutes * 60_000;
  const barsFor = (minutes: number) => Math.max(1, Math.ceil(minutes / opts.tfMinutes));
  // Floors leave room for a swing (2 bars each side) on 30m / 1h candles.
  const CHOCH_WINDOW = Math.max(barsFor(180), 6);
  const BOS_WINDOW = Math.max(barsFor(240), 8);
  const MAX_HOLD = Math.max(barsFor(24 * 60), 24);
  const MAX_RAID = barsFor(30);
  const PROTECTED_LOOKBACK = barsFor(12 * 60);

  const ranges: SessionRange[] = [];
  const building = new Map<SessionName, SessionRange>();
  const latest = new Map<SessionName, LevelSlot>();
  const swingHighs: Swing[] = [];
  const swingLows: Swing[] = [];
  const trades: SweepTrade[] = [];

  let atr = 0;
  let setup: Setup | null = null;
  let trade: SweepTrade | null = null;
  let tradeEntryIdx = -1;

  const minLow = (from: number, to: number) => {
    let m = Infinity;
    for (let k = Math.max(0, from); k <= to; k++) m = Math.min(m, bars[k]!.l);
    return m;
  };
  const maxHigh = (from: number, to: number) => {
    let m = -Infinity;
    for (let k = Math.max(0, from); k <= to; k++) m = Math.max(m, bars[k]!.h);
    return m;
  };

  const protectedLevelFor = (dir: SweepDirection, ev: SweepEvent): number => {
    const list = dir === "short" ? swingLows : swingHighs;
    for (let k = list.length - 1; k >= 0; k--) {
      const s = list[k]!;
      if (s.i >= ev.extremeIdx) continue;
      if (ev.extremeIdx - s.i > PROTECTED_LOOKBACK) break;
      return s.price;
    }
    const from = ev.raidStart - 12;
    const to = ev.raidStart - 1;
    if (to < 0) return dir === "short" ? bars[ev.extremeIdx]!.l : bars[ev.extremeIdx]!.h;
    return dir === "short" ? minLow(from, to) : maxHigh(from, to);
  };

  const finalizeRange = (r: SessionRange) => {
    ranges.push(r);
    latest.set(r.session, { range: r, high: freshSide(), low: freshSide() });
  };

  for (let t = 0; t < bars.length; t++) {
    const b = bars[t]!;
    const prev = t > 0 ? bars[t - 1]! : null;

    const tr = prev ? Math.max(b.h - b.l, Math.abs(b.h - prev.c), Math.abs(b.l - prev.c)) : b.h - b.l;
    atr = t < ATR_PERIOD ? (atr * t + tr) / (t + 1) : (atr * (ATR_PERIOD - 1) + tr) / ATR_PERIOD;

    // Session ranges
    const ck = clockFor(b.t);
    for (const name of SESSION_SWEEP_NAMES) {
      const key = sessionKeyFor(name, ck);
      const cur = building.get(name);
      if (cur && cur.key !== key) {
        finalizeRange(cur);
        building.delete(name);
      }
      if (key) {
        const live = building.get(name);
        if (live) {
          live.high = Math.max(live.high, b.h);
          live.low = Math.min(live.low, b.l);
          live.endTs = b.t + tfMs;
        } else {
          building.set(name, { session: name, key, startTs: b.t, endTs: b.t + tfMs, high: b.h, low: b.l });
        }
      }
    }

    // Swings confirmed SWING_SPAN bars after the pivot
    const pi = t - SWING_SPAN;
    if (pi >= SWING_SPAN) {
      const p = bars[pi]!;
      let isHigh = true;
      let isLow = true;
      for (let k = 1; k <= SWING_SPAN; k++) {
        if (!(p.h > bars[pi - k]!.h && p.h >= bars[pi + k]!.h)) isHigh = false;
        if (!(p.l < bars[pi - k]!.l && p.l <= bars[pi + k]!.l)) isLow = false;
      }
      if (isHigh) swingHighs.push({ i: pi, price: p.h });
      if (isLow) swingLows.push({ i: pi, price: p.l });
    }

    // Manage open trade (entry candle excluded — entry is at its close)
    if (trade && t > tradeEntryIdx) {
      const isShort = trade.direction === "short";
      const hitStop = isShort ? b.h >= trade.stop : b.l <= trade.stop;
      const hitTarget = isShort ? b.l <= trade.target : b.h >= trade.target;
      if (hitStop) {
        trade.outcome = "sl";
        trade.exitPrice = trade.stop;
        trade.r = -1;
      } else if (hitTarget) {
        trade.outcome = "tp";
        trade.exitPrice = trade.target;
        trade.r = rr;
      } else if (t - tradeEntryIdx >= MAX_HOLD) {
        trade.outcome = "timeout";
        trade.exitPrice = b.c;
        trade.r = round((isShort ? trade.entry - b.c : b.c - trade.entry) / trade.risk, 2);
      } else {
        trade.r = round((isShort ? trade.entry - b.c : b.c - trade.entry) / trade.risk, 2);
      }
      if (trade.outcome !== "open") {
        trade.exitTs = b.t;
        trade = null;
      }
    }

    // Raids / sweeps on completed session levels
    const hunt = huntSessionAt(b.t);
    const events: SweepEvent[] = [];
    for (const slot of latest.values()) {
      const fresh = b.t - slot.range.endTs < LEVEL_FRESH_MS;
      for (const side of ["high", "low"] as const) {
        const s = slot[side];
        const level = side === "high" ? slot.range.high : slot.range.low;
        const beyond = side === "high" ? b.h > level : b.l < level;
        const closedInside = side === "high" ? b.c < level : b.c > level;
        const wick = side === "high" ? b.h : b.l;
        const further = (x: number) => (side === "high" ? x > s.extreme : x < s.extreme);
        if (s.status === "untouched") {
          if (!hunt || !fresh || !beyond) continue;
          s.hunt = hunt;
          s.raidStart = t;
          s.extreme = wick;
          s.extremeIdx = t;
          if (closedInside) {
            s.status = "swept";
            events.push({ session: slot.range.session, side, level, extreme: wick, extremeIdx: t, raidStart: t, hunt });
          } else {
            s.status = "raiding";
          }
        } else if (s.status === "raiding") {
          if (further(wick)) {
            s.extreme = wick;
            s.extremeIdx = t;
          }
          if (closedInside) {
            s.status = "swept";
            events.push({
              session: slot.range.session,
              side,
              level,
              extreme: s.extreme,
              extremeIdx: s.extremeIdx,
              raidStart: s.raidStart,
              hunt: s.hunt ?? hunt ?? slot.range.session,
            });
          } else if (t - s.raidStart >= MAX_RAID) {
            s.status = "broken";
          }
        }
      }
    }

    if (trade) continue;

    // Progress pending setup
    if (setup) {
      const isShort = setup.dir === "short";
      const level = setup.ev.level;
      const backBeyondLevel = isShort ? b.c > level : b.c < level;
      const pastExtreme = isShort ? b.h > setup.extreme : b.l < setup.extreme;
      if (setup.stage === "swept") {
        if (backBeyondLevel || t - setup.sweepIdx > CHOCH_WINDOW) {
          setup = null;
        } else {
          if (pastExtreme) setup.extreme = isShort ? b.h : b.l;
          if (isShort ? b.c < setup.protectedLevel : b.c > setup.protectedLevel) {
            setup.stage = "choch";
            setup.chochIdx = t;
          }
        }
      } else if (pastExtreme || t - setup.chochIdx > BOS_WINDOW) {
        setup = null;
      } else {
        // Latest confirmed lower high (short) / higher low (long) formed after the CHoCH
        const list = isShort ? swingHighs : swingLows;
        const last = list[list.length - 1];
        if (last && last.i === pi && pi > setup.chochIdx) {
          const inside = isShort ? last.price < setup.extreme : last.price > setup.extreme;
          if (inside) {
            setup.structureSwing = last.price;
            setup.bosLevel = isShort ? minLow(setup.chochIdx, pi) : maxHigh(setup.chochIdx, pi);
          }
        }
        if (setup.structureSwing != null && setup.bosLevel != null) {
          const broke = isShort ? b.c < setup.bosLevel : b.c > setup.bosLevel;
          if (broke) {
            const entry = b.c;
            const anchor = opts.stopMode === "sweep" ? setup.extreme : setup.structureSwing;
            const plan = planStop(setup.dir, entry, anchor, atr);
            if (plan) {
              const { stop, risk } = plan;
              const ev = setup.ev;
              trade = {
                id: `${b.t}-${setup.dir}`,
                direction: setup.dir,
                huntSession: ev.hunt,
                sweptSession: ev.session,
                sweptSide: ev.side,
                sweptLevel: ev.level,
                sweepTs: bars[setup.sweepIdx]!.t,
                sweepExtreme: setup.extreme,
                chochTs: bars[setup.chochIdx]!.t,
                chochLevel: setup.protectedLevel,
                bosTs: b.t,
                bosLevel: setup.bosLevel,
                structureSwing: setup.structureSwing,
                entryTs: b.t,
                entry,
                stop,
                target: isShort ? entry - rr * risk : entry + rr * risk,
                risk,
                outcome: "open",
                exitTs: null,
                exitPrice: null,
                r: 0,
              };
              tradeEntryIdx = t;
              trades.push(trade);
            }
            setup = null;
          }
        }
      }
    }

    if (trade) continue;

    // New sweep → new setup (replaces a setup that has not reached CHoCH yet)
    if (events.length > 0 && (!setup || setup.stage === "swept")) {
      const ev = events[events.length - 1]!;
      const dir: SweepDirection = ev.side === "high" ? "short" : "long";
      const protectedLevel = protectedLevelFor(dir, ev);
      setup = {
        dir,
        ev,
        stage: "swept",
        sweepIdx: t,
        extreme: ev.extreme,
        protectedLevel,
        chochIdx: -1,
        structureSwing: null,
        bosLevel: null,
      };
      if (dir === "short" ? b.c < protectedLevel : b.c > protectedLevel) {
        setup.stage = "choch";
        setup.chochIdx = t;
      }
    }
  }

  const lastBar = bars[bars.length - 1] ?? null;
  const nowTs = lastBar ? lastBar.t + tfMs : Date.now();

  const levels: WatchedLevel[] = [];
  for (const name of SESSION_SWEEP_NAMES) {
    const slot = latest.get(name);
    if (!slot) continue;
    const active = nowTs - slot.range.endTs < LEVEL_FRESH_MS;
    levels.push(
      { session: name, side: "high", price: slot.range.high, status: slot.high.status, sessionEndTs: slot.range.endTs, active },
      { session: name, side: "low", price: slot.range.low, status: slot.low.status, sessionEndTs: slot.range.endTs, active }
    );
  }

  const live = describeLive({ trade, setup, levels, lastBar, rr, atr, stopMode: opts.stopMode });

  return { ranges, building: Array.from(building.values()), trades, levels, live };
}

/** Stop and risk for an entry, using the same rules as a live trigger. Null if the setup would be skipped. */
function planStop(
  dir: SweepDirection,
  entry: number,
  anchor: number,
  atr: number
): { stop: number; risk: number } | null {
  const isShort = dir === "short";
  const buffer = STOP_BUFFER_ATR * atr;
  let stop = isShort ? anchor + buffer : anchor - buffer;
  let risk = isShort ? stop - entry : entry - stop;
  const minRisk = MIN_RISK_ATR * atr;
  if (risk < minRisk) {
    risk = minRisk;
    stop = isShort ? entry + risk : entry - risk;
  }
  if (!(risk > 0) || risk > MAX_RISK_ATR * atr) return null;
  return { stop, risk };
}

function describeLive(args: {
  trade: SweepTrade | null;
  setup: Setup | null;
  levels: WatchedLevel[];
  lastBar: SweepBar | null;
  rr: number;
  atr: number;
  stopMode: SweepStopMode;
}): SweepLiveState {
  const { trade, setup, levels, lastBar, rr, atr, stopMode } = args;
  const base: SweepLiveState = {
    stage: "idle",
    direction: null,
    message: "",
    sweptSession: null,
    sweptSide: null,
    sweptLevel: null,
    sweepExtreme: null,
    chochLevel: null,
    bosLevel: null,
    trade: null,
    plannedEntry: null,
    plannedStop: null,
    plannedTarget: null,
    entryStillValid: false,
    currentHunt: lastBar ? huntSessionAt(lastBar.t) : null,
    lastPrice: lastBar?.c ?? null,
    lastBarTs: lastBar?.t ?? null,
  };

  if (trade) {
    const dirWord = trade.direction === "long" ? "Long" : "Short";
    const drift = lastBar ? Math.abs(lastBar.c - trade.entry) / trade.risk : Infinity;
    return {
      ...base,
      stage: "in_trade",
      direction: trade.direction,
      sweptSession: trade.sweptSession,
      sweptSide: trade.sweptSide,
      sweptLevel: trade.sweptLevel,
      sweepExtreme: trade.sweepExtreme,
      chochLevel: trade.chochLevel,
      bosLevel: trade.bosLevel,
      trade,
      entryStillValid: drift <= 0.3,
      message: `${dirWord} triggered after the ${trade.sweptSession} ${trade.sweptSide} was swept and structure broke. Target is ${rr}R.`,
    };
  }

  if (setup) {
    const sweptLabel = `${setup.ev.session} ${setup.ev.side}`;
    const dirWord = setup.dir === "long" ? "long" : "short";
    const beyond = setup.dir === "short" ? "below" : "above";
    if (setup.stage === "swept") {
      return {
        ...base,
        stage: "swept",
        direction: setup.dir,
        sweptSession: setup.ev.session,
        sweptSide: setup.ev.side,
        sweptLevel: setup.ev.level,
        sweepExtreme: setup.extreme,
        chochLevel: setup.protectedLevel,
        message: `${sweptLabel} swept. Waiting for a change of character: a candle close ${beyond} the protected swing. No entry yet.`,
      };
    }
    let plannedEntry: number | null = null;
    let plannedStop: number | null = null;
    let plannedTarget: number | null = null;
    if (setup.bosLevel != null && setup.structureSwing != null) {
      const anchor = stopMode === "sweep" ? setup.extreme : setup.structureSwing;
      const plan = planStop(setup.dir, setup.bosLevel, anchor, atr);
      if (plan) {
        plannedEntry = setup.bosLevel;
        plannedStop = plan.stop;
        plannedTarget = setup.dir === "short" ? setup.bosLevel - rr * plan.risk : setup.bosLevel + rr * plan.risk;
      }
    }
    return {
      ...base,
      plannedEntry,
      plannedStop,
      plannedTarget,
      stage: "choch",
      direction: setup.dir,
      sweptSession: setup.ev.session,
      sweptSide: setup.ev.side,
      sweptLevel: setup.ev.level,
      sweepExtreme: setup.extreme,
      chochLevel: setup.protectedLevel,
      bosLevel: setup.bosLevel,
      message:
        setup.bosLevel != null
          ? `Change of character confirmed after the ${sweptLabel} sweep. A close ${beyond} the break-of-structure level triggers the ${dirWord}.`
          : `Change of character confirmed after the ${sweptLabel} sweep. Waiting for a pullback swing to set the break-of-structure level.`,
    };
  }

  const watching = levels.filter((l) => l.active && l.status === "untouched");
  return {
    ...base,
    message:
      watching.length > 0
        ? `Watching ${watching.length} untouched session level${watching.length === 1 ? "" : "s"} for a sweep.`
        : "No fresh session levels left to sweep. The next session range will set new levels.",
  };
}

export function computeSweepStats(trades: SweepTrade[]): SweepStats {
  const emptyBucket = () => ({ trades: 0, wins: 0, losses: 0, totalR: 0 });
  const bySession: SweepStats["bySession"] = { Asia: emptyBucket(), London: emptyBucket(), "New York": emptyBucket() };
  const byDirection: SweepStats["byDirection"] = { long: emptyBucket(), short: emptyBucket() };
  let wins = 0;
  let losses = 0;
  let timeouts = 0;
  let open = 0;
  let totalR = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let streak = 0;
  let maxLosingStreak = 0;
  const equity: number[] = [];

  for (const tr of trades) {
    if (tr.outcome === "open") {
      open++;
      continue;
    }
    const r = tr.r ?? 0;
    totalR += r;
    equity.push(round(totalR, 2));
    if (r > 0) grossWin += r;
    else grossLoss += -r;
    if (tr.outcome === "tp") wins++;
    else if (tr.outcome === "sl") losses++;
    else timeouts++;
    if (r < 0) {
      streak++;
      maxLosingStreak = Math.max(maxLosingStreak, streak);
    } else {
      streak = 0;
    }
    for (const bucket of [bySession[tr.huntSession], byDirection[tr.direction]]) {
      bucket.trades++;
      if (tr.outcome === "tp") bucket.wins++;
      if (tr.outcome === "sl") bucket.losses++;
      bucket.totalR = round(bucket.totalR + r, 2);
    }
  }

  const closed = wins + losses + timeouts;
  return {
    trades: closed,
    wins,
    losses,
    timeouts,
    open,
    winRate: closed > 0 ? round((wins / closed) * 100, 1) : null,
    totalR: round(totalR, 2),
    avgR: closed > 0 ? round(totalR / closed, 2) : null,
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss, 2) : null,
    maxLosingStreak,
    bySession,
    byDirection,
    equity,
  };
}
