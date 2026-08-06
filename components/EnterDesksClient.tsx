"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Instagram } from "lucide-react";
import { saveDashboardPath, type DashboardPath } from "@/lib/dashboard-onboarding";

const INSTAGRAM_HANDLE = "novastaris";
const INSTAGRAM_URL = "https://www.instagram.com/novastaris/";

type DeskId = "meme" | "futures" | "forex" | "prop" | "polymarket";

type ForexRow = {
  symbol: string;
  currentPrice: number | null;
  high: number | null;
  low: number | null;
  direction: "bullish" | "bearish" | "sideways";
  insight: string;
};

type FuturesRow = {
  symbol: string;
  markPx: number | null;
  dayChangePct: number | null;
  volume24h: number | null;
};

const DESKS: Array<{
  id: DeskId;
  path: DashboardPath | null;
  title: string;
  line: string;
  cta: string;
  href: string;
  gate: "open" | "vip" | "preview";
  tone: string;
  /** Border / CTA / active accent — one mood per desk */
  accent: {
    border: string;
    borderHover: string;
    borderActive: string;
    ring: string;
    cta: string;
    ctaHover: string;
    label: string;
    bar: string;
  };
}> = [
  {
    id: "meme",
    path: "meme",
    title: "Meme desk",
    line: "Hunt early Solana & BSC momentum, then run AI contract analysis.",
    cta: "Enter Go Hunting",
    href: "/?tab=new",
    gate: "open",
    tone: "from-teal-500/25 via-transparent to-transparent",
    accent: {
      border: "border-teal-500/25",
      borderHover: "hover:border-teal-400/55",
      borderActive: "border-teal-400/60",
      ring: "ring-teal-400/30",
      cta: "bg-teal-400",
      ctaHover: "hover:bg-teal-300",
      label: "text-teal-200/80",
      bar: "bg-teal-400",
    },
  },
  {
    id: "futures",
    path: "futures",
    title: "Futures desk",
    line: "Upload a chart for AI structure — or pick a mover from the opportunity rail.",
    cta: "Open Chart AI",
    href: "/?tab=futures&futures=ai",
    gate: "open",
    tone: "from-cyan-500/25 via-transparent to-transparent",
    accent: {
      border: "border-cyan-500/25",
      borderHover: "hover:border-cyan-400/55",
      borderActive: "border-cyan-400/60",
      ring: "ring-cyan-400/30",
      cta: "bg-cyan-400",
      ctaHover: "hover:bg-cyan-300",
      label: "text-cyan-200/80",
      bar: "bg-cyan-400",
    },
  },
  {
    id: "forex",
    path: "forex",
    title: "Forex desk",
    line: "Gold, FX, indices. Guests see a delayed Market Watch; live Agent is VIP.",
    cta: "Open Nova Forex",
    href: "/?tab=nova-forex",
    gate: "vip",
    tone: "from-amber-500/20 via-transparent to-transparent",
    accent: {
      border: "border-amber-500/25",
      borderHover: "hover:border-amber-400/55",
      borderActive: "border-amber-400/60",
      ring: "ring-amber-400/30",
      cta: "bg-amber-400",
      ctaHover: "hover:bg-amber-300",
      label: "text-amber-200/80",
      bar: "bg-amber-400",
    },
  },
  {
    id: "prop",
    path: null,
    title: "Prop firm desk",
    line: "Challenge workflows on your rules. Preview the room — VIP to run.",
    cta: "Preview Prop Firm",
    href: "/?tab=prop-firm-bot",
    gate: "preview",
    tone: "from-rose-500/20 via-transparent to-transparent",
    accent: {
      border: "border-rose-500/25",
      borderHover: "hover:border-rose-400/55",
      borderActive: "border-rose-400/60",
      ring: "ring-rose-400/30",
      cta: "bg-rose-400",
      ctaHover: "hover:bg-rose-300",
      label: "text-rose-200/80",
      bar: "bg-rose-400",
    },
  },
  {
    id: "polymarket",
    path: "polymarket",
    title: "Polymarket desk",
    line: "Prediction-market radar and wallet intel. Preview free — live is VIP.",
    cta: "Preview Polymarket",
    href: "/?tab=polymarket-bot",
    gate: "preview",
    tone: "from-sky-500/20 via-transparent to-transparent",
    accent: {
      border: "border-sky-500/25",
      borderHover: "hover:border-sky-400/55",
      borderActive: "border-sky-400/60",
      ring: "ring-sky-400/30",
      cta: "bg-sky-400",
      ctaHover: "hover:bg-sky-300",
      label: "text-sky-200/80",
      bar: "bg-sky-400",
    },
  },
];

const UNI_PATH = ["Foundations", "Markets", "Applied", "Final exam", "Certificate"] as const;

function fmtPx(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: n >= 100 ? 2 : 5 });
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function gateLabel(gate: (typeof DESKS)[number]["gate"]): string {
  if (gate === "vip") return "VIP live · guest snapshot";
  if (gate === "preview") return "Preview · VIP to operate";
  return "Open access";
}

export default function EnterDesksClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<DeskId | null>(null);
  const [forexRows, setForexRows] = useState<ForexRow[]>([]);
  const [futuresRows, setFuturesRows] = useState<FuturesRow[]>([]);
  const [snapNote, setSnapNote] = useState<string | null>(null);
  const [snapAsOf, setSnapAsOf] = useState<string | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [desksReady, setDesksReady] = useState(false);
  const [uniReady, setUniReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setHeroReady(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setDesksReady(true);
      setUniReady(true);
      return;
    }
    const nodes = [
      { id: "desks", set: setDesksReady },
      { id: "university", set: setUniReady },
    ] as const;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = (e.target as HTMLElement).id;
          if (id === "desks") setDesksReady(true);
          if (id === "university") setUniReady(true);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    for (const n of nodes) {
      const el = document.getElementById(n.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSnapLoading(true);
    fetch("/api/public/desk-snapshots", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        setForexRows(data.forex?.rows ?? []);
        setFuturesRows(data.futures?.rows ?? []);
        setSnapNote(data.forex?.note ?? data.futures?.note ?? null);
        setSnapAsOf(data.forex?.asOf ?? data.futures?.asOf ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSnapLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enterDesk = (desk: (typeof DESKS)[number]) => {
    startTransition(() => {
      if (desk.path) saveDashboardPath(desk.path);
      router.push(desk.href);
    });
  };

  const openFuturesSymbol = (symbol: string, mode: "ai" | "liq") => {
    saveDashboardPath("futures");
    if (mode === "liq") {
      router.push(`/?tab=futures&futures=liquidation-map&symbol=${encodeURIComponent(symbol)}`);
      return;
    }
    router.push(`/?tab=futures&futures=ai&symbol=${encodeURIComponent(symbol)}`);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,211,238,0.18),transparent_50%),radial-gradient(ellipse_at_90%_10%,rgba(245,158,11,0.12),transparent_45%),linear-gradient(180deg,#05080f_0%,#0a1220_45%,#05080f_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.35) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Link
          href="/enter"
          className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold tracking-tight text-white sm:text-2xl"
        >
          NovaStaris
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 text-zinc-400 transition-colors hover:text-white sm:inline-flex"
            aria-label="NovaStaris on Instagram"
          >
            <Instagram className="h-3.5 w-3.5" />
            <span className="font-medium tracking-wide">@{INSTAGRAM_HANDLE}</span>
          </a>
          <Link href="/signin" className="text-zinc-400 transition-colors hover:text-white">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-cyan-500 px-3 py-1.5 font-medium text-zinc-950 transition-colors hover:bg-cyan-400"
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <section className="flex min-h-[70vh] flex-col justify-center py-10 sm:py-16">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300/90 transition-all duration-500 ${
              heroReady ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
          >
            AI trading intelligence
          </p>
          <h1
            className={`mt-4 max-w-3xl font-[family-name:var(--font-space-grotesk)] text-5xl font-bold leading-[1.05] tracking-tight text-white transition-all duration-700 delay-75 sm:text-6xl md:text-7xl ${
              heroReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            NovaStaris
          </h1>
          <p
            className={`mt-5 max-w-xl text-base text-zinc-400 transition-all duration-700 delay-150 sm:text-lg ${
              heroReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            Trade intelligence for the desk you run — and a free University so you learn before you size up.
          </p>
          <div
            className={`mt-8 flex flex-wrap gap-3 transition-all duration-700 delay-200 ${
              heroReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
            }`}
          >
            <a
              href="#desks"
              className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              Choose your desk
            </a>
            <a
              href="#university"
              className="rounded-md border border-amber-400/40 px-5 py-2.5 text-sm font-medium text-amber-100 transition-colors hover:border-amber-300/70 hover:bg-amber-500/10"
            >
              Learn free
            </a>
          </div>
        </section>

        <section id="desks" className="space-y-4 pb-8">
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold text-white">
            Enter a desk
          </h2>
          <p className="max-w-2xl text-sm text-zinc-400">
            One job per room. Pick where you trade — we route you into that workflow, not a wall of tabs.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DESKS.map((desk, i) => (
              <button
                key={desk.id}
                type="button"
                onClick={() => setActive(desk.id === active ? null : desk.id)}
                style={{
                  transitionDelay: desksReady ? `${80 + i * 70}ms` : "0ms",
                }}
                className={`group relative overflow-hidden rounded-2xl border bg-zinc-950/50 p-5 text-left backdrop-blur-sm transition-all duration-500 ease-out ${desk.accent.border} ${desk.accent.borderHover} ${
                  active === desk.id ? `${desk.accent.borderActive} ring-1 ${desk.accent.ring}` : ""
                } ${desksReady ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${desk.tone}`} />
                <div className={`pointer-events-none absolute left-0 top-0 h-full w-1 ${desk.accent.bar}`} aria-hidden />
                <div className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold text-white">
                      {desk.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide ${desk.accent.label}`}
                    >
                      {gateLabel(desk.gate)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{desk.line}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        enterDesk(desk);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          enterDesk(desk);
                        }
                      }}
                      className={`inline-flex cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold text-zinc-950 ${desk.accent.cta} ${desk.accent.ctaHover}`}
                    >
                      {pending ? "Opening…" : desk.cta}
                    </span>
                    <span className="self-center text-[11px] text-zinc-500 group-hover:text-zinc-400">
                      {active === desk.id ? "Hide preview" : "Show preview"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section
          id="university"
          className={`relative mt-10 overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-950/70 p-6 sm:p-8 transition-all duration-700 ease-out ${
            uniReady ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/15 via-transparent to-transparent" />
          <div className="relative max-w-2xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
              Free to enroll
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold text-white sm:text-3xl">
              NovaStaris Trading University
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
              Learn meme coins, Solana &amp; BSC, futures &amp; perps, prediction markets, forex, and metals — then sit
              the final exam and earn a certificate. Preview as a guest; enroll free to track progress.
            </p>
            <ol className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-2 text-[11px] text-amber-100/80">
              {UNI_PATH.map((step, i) => (
                <li key={step} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="mx-1 text-amber-500/50" aria-hidden>→</span>}
                  <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-medium tracking-wide">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(() => {
                    router.push("/?tab=trading-university");
                  });
                }}
                className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:opacity-60"
              >
                {pending ? "Opening…" : "Enter Trading University"}
              </button>
              <a
                href="#desks"
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-white/30"
              >
                Or pick a desk first
              </a>
            </div>
          </div>
        </section>

        {active === "futures" && (
          <section className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-white">
                  Opportunity rail
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Curated movers — open Chart AI or Liquidation Map with the symbol filled.
                </p>
              </div>
              {snapAsOf && (
                <p className="text-[10px] text-zinc-500">
                  As of {new Date(snapAsOf).toLocaleString()} · cached ~15–30m
                </p>
              )}
            </div>
            {snapLoading && futuresRows.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Loading rail…</p>
            ) : futuresRows.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Rail unavailable right now — open Chart AI anyway.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr className="border-b border-white/10">
                      <th className="py-2 pr-3 font-medium">Symbol</th>
                      <th className="py-2 pr-3 font-medium">Mark</th>
                      <th className="py-2 pr-3 font-medium">24h</th>
                      <th className="py-2 font-medium">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {futuresRows.map((r) => (
                      <tr key={r.symbol} className="border-b border-white/5">
                        <td className="py-2.5 pr-3 font-mono font-semibold text-zinc-100">{r.symbol}</td>
                        <td className="py-2.5 pr-3 font-mono text-zinc-300">{fmtPx(r.markPx)}</td>
                        <td
                          className={`py-2.5 pr-3 font-mono ${
                            (r.dayChangePct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {fmtPct(r.dayChangePct)}
                        </td>
                        <td className="py-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              className="rounded border border-cyan-500/40 px-2 py-1 text-[10px] font-medium text-cyan-200 hover:bg-cyan-500/10"
                              onClick={() => openFuturesSymbol(r.symbol, "ai")}
                            >
                              Chart AI
                            </button>
                            <button
                              type="button"
                              className="rounded border border-white/15 px-2 py-1 text-[10px] font-medium text-zinc-300 hover:bg-white/5"
                              onClick={() => openFuturesSymbol(r.symbol, "liq")}
                            >
                              Liq map
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {active === "forex" && (
          <section className="mt-4 rounded-2xl border border-amber-500/25 bg-zinc-950/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-white">
                  Delayed Market Watch
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {snapNote ?? "Guest snapshot of majors. Live Agent / NovaQ Forex requires VIP."}
                </p>
              </div>
              {snapAsOf && (
                <p className="text-[10px] text-zinc-500">
                  As of {new Date(snapAsOf).toLocaleString()} · not live
                </p>
              )}
            </div>
            {snapLoading && forexRows.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">Loading snapshot…</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr className="border-b border-white/10">
                      <th className="py-2 pr-3 font-medium">Symbol</th>
                      <th className="py-2 pr-3 font-medium">Price</th>
                      <th className="py-2 pr-3 font-medium">Bias</th>
                      <th className="py-2 font-medium">Read</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forexRows.map((r) => (
                      <tr key={r.symbol} className="border-b border-white/5">
                        <td className="py-2.5 pr-3 font-mono font-semibold text-zinc-100">{r.symbol}</td>
                        <td className="py-2.5 pr-3 font-mono text-zinc-300">{fmtPx(r.currentPrice)}</td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={
                              r.direction === "bullish"
                                ? "text-emerald-400"
                                : r.direction === "bearish"
                                  ? "text-rose-400"
                                  : "text-zinc-400"
                            }
                          >
                            {r.direction}
                          </span>
                        </td>
                        <td className="max-w-[240px] py-2.5 text-zinc-500">{r.insight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/subscribe"
                className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
              >
                Upgrade for live Forex Agent
              </Link>
              <button
                type="button"
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-zinc-300"
                onClick={() => enterDesk(DESKS.find((d) => d.id === "forex")!)}
              >
                Open desk (VIP gate)
              </button>
            </div>
          </section>
        )}

        {(active === "prop" || active === "polymarket") && (
          <section className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/60 p-5">
            <h3 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-white">
              {active === "prop" ? "Prop firm preview" : "Polymarket preview"}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              {active === "prop"
                ? "See the challenge workspace layout and rules flow. Running bots against your prop account stays VIP — no empty locked table."
                : "See the prediction-market radar room. Live wallet intel and automations stay VIP."}
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-cyan-400"
              onClick={() => enterDesk(DESKS.find((d) => d.id === active)!)}
            >
              Open preview in app
            </button>
          </section>
        )}

        {active === "meme" && (
          <section className="mt-4 rounded-2xl border border-teal-500/25 bg-zinc-950/60 p-5">
            <h3 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-white">
              Meme hunter
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Go Hunting → Trending / Surge → AI Agent on a contract. Free guests can explore discovery; deeper AI runs
              follow your plan limits.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-teal-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-teal-300"
              onClick={() => enterDesk(DESKS.find((d) => d.id === "meme")!)}
            >
              Enter Go Hunting
            </button>
          </section>
        )}
      </main>

      {/* Instagram signal strip — full-bleed invite below the desks */}
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative z-10 mt-12 block overflow-hidden border-y border-white/10 bg-gradient-to-r from-cyan-500/10 via-transparent to-amber-500/10 py-4 transition-colors hover:border-white/20"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.4] [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="animate-[enter-ig-marquee_32s_linear_infinite] flex w-max whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="mx-6">
                Follow the desk · @{INSTAGRAM_HANDLE} · charts · desks · wins · Instagram
              </span>
            ))}
          </div>
        </div>
        <div className="relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-zinc-950/80 text-white transition-transform duration-300 group-hover:scale-105">
              <Instagram className="h-4 w-4" />
            </span>
            <div>
              <p className="font-[family-name:var(--font-space-grotesk)] text-sm font-semibold text-white">
                @{INSTAGRAM_HANDLE}
              </p>
              <p className="text-xs text-zinc-400">Behind the desks — setups, wins, and product drops</p>
            </div>
          </div>
          <span className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-100 transition-colors group-hover:border-cyan-400/50 group-hover:bg-cyan-500/10 group-hover:text-cyan-100">
            Follow on Instagram
          </span>
        </div>
      </a>

      <footer className="relative z-10 mx-auto flex max-w-6xl flex-wrap gap-4 px-4 pb-16 pt-8 text-xs text-zinc-500 sm:px-6">
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-zinc-300"
        >
          <Instagram className="h-3 w-3" />
          @{INSTAGRAM_HANDLE}
        </a>
        <Link href="/?tab=trading-university" className="hover:text-zinc-300">
          Trading University
        </Link>
        <Link href="/start-here" className="hover:text-zinc-300">
          Classic start guide
        </Link>
        <Link href="/affiliate" className="hover:text-zinc-300">
          Affiliate
        </Link>
        <Link href="/wins" className="hover:text-zinc-300">
          Wins
        </Link>
      </footer>
    </div>
  );
}
