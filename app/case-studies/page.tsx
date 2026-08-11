"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import SiteInstagramFooter from "@/components/SiteInstagramFooter";
import {
  DEFAULT_CASE_STUDIES_PAGE,
  type CaseStudiesPageConfig,
  type CaseStudyStory,
} from "@/lib/case-studies-content";
import { ArrowRight, CheckCircle2, Shield, TrendingUp, Waves, Zap } from "lucide-react";

const accentStyles = {
  cyan: {
    badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    ring: "from-cyan-400/40 via-sky-300/20 to-transparent",
    bar: "bg-cyan-500",
    soft: "bg-cyan-50/80 dark:bg-cyan-950/30 border-cyan-200/70 dark:border-cyan-800/60",
  },
  violet: {
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    ring: "from-violet-400/40 via-fuchsia-300/15 to-transparent",
    bar: "bg-violet-500",
    soft: "bg-violet-50/80 dark:bg-violet-950/30 border-violet-200/70 dark:border-violet-800/60",
  },
  emerald: {
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    ring: "from-emerald-400/40 via-teal-300/20 to-transparent",
    bar: "bg-emerald-500",
    soft: "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-800/60",
  },
} as const;

export default function CaseStudiesPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [config, setConfig] = useState<CaseStudiesPageConfig>(DEFAULT_CASE_STUDIES_PAGE);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/case-studies", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success) {
          setEnabled(data.enabled !== false);
          if (data.config) setConfig(data.config as CaseStudiesPageConfig);
        } else {
          setEnabled(true);
        }
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const studies = config.studies.filter((s) => s.enabled);

  return (
    <div className="min-h-screen relative overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.18),_transparent_55%),radial-gradient(ellipse_at_80%_20%,_rgba(16,185,129,0.14),_transparent_45%),radial-gradient(ellipse_at_20%_80%,_rgba(251,191,36,0.12),_transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%),radial-gradient(ellipse_at_80%_20%,_rgba(16,185,129,0.1),_transparent_45%),radial-gradient(ellipse_at_20%_80%,_rgba(251,191,36,0.08),_transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2] [background-image:linear-gradient(rgba(24,24,27,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(24,24,27,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px]"
      />

      <header className="sticky top-0 z-10 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/about"
              className="hidden sm:inline text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              About
            </Link>
            <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      {enabled === false ? (
        <main className="relative mx-auto max-w-xl px-3 sm:px-4 py-16 space-y-4 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
            {config.heroEyebrow}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Case studies is temporarily off
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            This page is disabled by the site owner right now. You can still use the NovaStaris dashboard and other
            tools.
          </p>
          <Button asChild>
            <Link href="/">Open app</Link>
          </Button>
        </main>
      ) : (
        <main className="relative mx-auto max-w-5xl px-3 sm:px-4 py-10 sm:py-14 space-y-14 sm:space-y-20">
          <section className="text-center space-y-5 animate-in fade-in duration-700">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">
              {config.heroEyebrow}
            </p>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              {config.heroTitleBefore}{" "}
              <span className="bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-500 bg-clip-text text-transparent">
                {config.heroTitleAccent}
              </span>
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              {config.heroBlurb}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 px-3 py-1">
                <Shield className="h-3.5 w-3.5 text-cyan-500" /> Meme checks
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 px-3 py-1">
                <TrendingUp className="h-3.5 w-3.5 text-violet-500" /> Futures structure
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/60 px-3 py-1">
                <Waves className="h-3.5 w-3.5 text-emerald-500" /> Forex desks
              </span>
            </div>
          </section>

          <div className="space-y-16 sm:space-y-24">
            {studies.map((study: CaseStudyStory, index: number) => {
              const a = accentStyles[study.accent] ?? accentStyles.cyan;
              const imageLeft = index % 2 === 1;
              return (
                <article
                  key={study.id}
                  id={study.id}
                  className="grid gap-8 lg:grid-cols-2 lg:gap-10 items-center animate-in fade-in slide-in-from-bottom-4 duration-700"
                >
                  <div className={`space-y-4 ${imageLeft ? "lg:order-2" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wider rounded-full border px-2.5 py-1 ${a.badge}`}
                      >
                        {study.eyebrow}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {study.name} · {study.role}
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {study.headline}
                    </h2>

                    <div className={`rounded-2xl border p-4 space-y-3 ${a.soft}`}>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          The problem
                        </p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed">{study.problem}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          The NovaStaris workflow
                        </p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1 leading-relaxed">{study.solution}</p>
                      </div>
                      <div className="flex gap-2 items-start">
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 mt-0.5 ${
                            study.accent === "cyan"
                              ? "text-cyan-600"
                              : study.accent === "violet"
                                ? "text-violet-600"
                                : "text-emerald-600"
                          }`}
                        />
                        <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{study.outcome}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {study.tools.map((tool) => (
                        <span
                          key={tool}
                          className="text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/70 px-2.5 py-1 text-zinc-700 dark:text-zinc-300"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>

                    <Button
                      asChild
                      className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900"
                    >
                      <Link href={study.ctaHref}>
                        {study.ctaLabel}
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Link>
                    </Button>
                  </div>

                  <div className={`relative ${imageLeft ? "lg:order-1" : ""}`}>
                    <div aria-hidden className={`absolute -inset-4 rounded-[2rem] bg-gradient-to-br ${a.ring} blur-2xl`} />
                    <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-900 shadow-2xl shadow-zinc-900/20 dark:shadow-black/40 rotate-[-1.25deg] hover:rotate-0 transition-transform duration-500">
                      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-700/80 bg-zinc-950/90">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
                        <span className="ml-2 text-[10px] text-zinc-400 truncate">novastaris.ai</span>
                      </div>
                      <Image
                        src={study.imageSrc}
                        alt={study.imageAlt}
                        width={1600}
                        height={900}
                        className="w-full h-auto"
                        sizes="(max-width: 1024px) 100vw, 560px"
                        priority={index === 0}
                      />
                      <div className={`h-1 ${a.bar}`} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="rounded-3xl border border-amber-300/50 dark:border-amber-700/40 bg-gradient-to-br from-amber-50 via-white to-cyan-50 dark:from-amber-950/40 dark:via-zinc-900 dark:to-cyan-950/30 p-6 sm:p-8 text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Pick a path. Use the same desks.
            </h2>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
              Start free with meme tools, or go VIP for Forecast, Pulse, Forex, Coach Calls, and more.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="bg-cyan-600 hover:bg-cyan-500 text-white">
                <Link href={config.ctaPrimaryHref}>{config.ctaPrimaryLabel}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={config.ctaSecondaryHref}>{config.ctaSecondaryLabel}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={config.ctaTertiaryHref}>{config.ctaTertiaryLabel}</Link>
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
              {config.footerDisclaimer}
            </p>
          </section>
        </main>
      )}

      <SiteInstagramFooter />
    </div>
  );
}
