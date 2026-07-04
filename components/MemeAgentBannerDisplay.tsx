"use client";

const PLATFORMS = [
  { name: "Dex Screener", href: "https://dexscreener.com", icon: "/platform-icons/dexscreener.svg" },
  { name: "GMGN", href: "https://gmgn.ai", icon: "/platform-icons/gmgn.svg" },
  { name: "Pump.fun", href: "https://pump.fun", icon: "/platform-icons/pumpfun.svg" },
  { name: "Axiom", href: "https://axiom.trade", icon: "/platform-icons/axiom.svg" },
  { name: "Padre", href: "https://padre.gg", icon: "/platform-icons/padre.svg" },
] as const;

type Props = {
  title: string;
  message: string;
};

export default function MemeAgentBannerDisplay({ title, message }: Props) {
  return (
    <div className="mb-5 rounded-xl border border-violet-400/45 dark:border-violet-600/50 bg-gradient-to-br from-violet-100/95 via-fuchsia-50/85 to-cyan-100/75 dark:from-violet-950/55 dark:via-fuchsia-950/35 dark:to-cyan-950/45 px-4 py-4 sm:px-5 sm:py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-amber-500 text-lg shadow-sm"
          aria-hidden
        >
          🛡️
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-none bg-gradient-to-r from-rose-600 via-fuchsia-600 to-violet-600 dark:from-rose-400 dark:via-fuchsia-400 dark:to-violet-400 bg-clip-text text-transparent">
            {title}
          </h3>
          <p className="text-sm sm:text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
            {message}
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-2 pl-12 sm:pl-12">
        {PLATFORMS.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/70 dark:border-zinc-700/80 bg-white/90 dark:bg-zinc-900/75 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            title={p.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.icon} alt="" width={16} height={16} className="rounded-sm shrink-0 object-contain" />
            {p.name}
          </a>
        ))}
      </div>
    </div>
  );
}
