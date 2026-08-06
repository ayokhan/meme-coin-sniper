"use client";

import type { ReactNode } from "react";

export type DeskAccent = "meme" | "futures" | "forex" | "prop" | "polymarket";

const ACCENT: Record<
  DeskAccent,
  {
    wash: string;
    bar: string;
    eyebrow: string;
    ring: string;
  }
> = {
  meme: {
    wash: "from-teal-500/15 via-transparent to-transparent dark:from-teal-500/20",
    bar: "bg-teal-500 dark:bg-teal-400",
    eyebrow: "text-teal-700/90 dark:text-teal-200/85",
    ring: "border-teal-500/30 dark:border-teal-400/25",
  },
  futures: {
    wash: "from-cyan-500/15 via-transparent to-transparent dark:from-cyan-500/20",
    bar: "bg-cyan-500 dark:bg-cyan-400",
    eyebrow: "text-cyan-700/90 dark:text-cyan-200/85",
    ring: "border-cyan-500/30 dark:border-cyan-400/25",
  },
  forex: {
    wash: "from-amber-500/12 via-transparent to-transparent dark:from-amber-500/18",
    bar: "bg-amber-500 dark:bg-amber-400",
    eyebrow: "text-amber-800/90 dark:text-amber-200/85",
    ring: "border-amber-500/30 dark:border-amber-400/25",
  },
  prop: {
    wash: "from-rose-500/12 via-transparent to-transparent dark:from-rose-500/18",
    bar: "bg-rose-500 dark:bg-rose-400",
    eyebrow: "text-rose-700/90 dark:text-rose-200/85",
    ring: "border-rose-500/30 dark:border-rose-400/25",
  },
  polymarket: {
    wash: "from-sky-500/12 via-transparent to-transparent dark:from-sky-500/18",
    bar: "bg-sky-500 dark:bg-sky-400",
    eyebrow: "text-sky-700/90 dark:text-sky-200/85",
    ring: "border-sky-500/30 dark:border-sky-400/25",
  },
};

type Props = {
  accent: DeskAccent;
  eyebrow: string;
  title: string;
  line: string;
  /** Optional filter / view controls under the blurb */
  children?: ReactNode;
  className?: string;
};

/**
 * Landing-aligned desk header for signed-in tabs (Go Hunting, Futures, …).
 * Atmosphere + hierarchy only — keep tables/forms utilitarian below.
 */
export default function DeskTabChrome({
  accent,
  eyebrow,
  title,
  line,
  children,
  className = "",
}: Props) {
  const a = ACCENT[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${a.ring} bg-gradient-to-br ${a.wash} px-3.5 py-3.5 sm:px-4 sm:py-4 ${className}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${a.bar}`} aria-hidden />
      <p
        className={`pl-3 text-[10px] font-semibold uppercase tracking-[0.22em] ${a.eyebrow}`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1 pl-3 font-[family-name:var(--font-space-grotesk)] text-xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl pl-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {line}
      </p>
      {children ? <div className="mt-3 pl-3">{children}</div> : null}
    </div>
  );
}

type SegmentProps<T extends string> = {
  accent: DeskAccent;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (id: T) => void;
  hint?: string;
};

const SEGMENT_ACTIVE: Record<DeskAccent, string> = {
  meme: "border-teal-500 text-teal-800 dark:border-teal-400 dark:text-teal-200",
  futures: "border-cyan-500 text-cyan-800 dark:border-cyan-400 dark:text-cyan-200",
  forex: "border-amber-500 text-amber-900 dark:border-amber-400 dark:text-amber-200",
  prop: "border-rose-500 text-rose-800 dark:border-rose-400 dark:text-rose-200",
  polymarket: "border-sky-500 text-sky-800 dark:border-sky-400 dark:text-sky-200",
};

/** Quiet underline segment control — replaces filled zinc pill trays. */
export function DeskViewSegment<T extends string>({
  accent,
  value,
  options,
  onChange,
  hint,
}: SegmentProps<T>) {
  return (
    <div>
      <div className="flex flex-wrap items-end gap-1 border-b border-zinc-200/90 dark:border-zinc-700/80">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`-mb-px px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                active
                  ? SEGMENT_ACTIVE[accent]
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}
