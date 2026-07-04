"use client";

const PLATFORMS = [
  { name: "Dex Screener", href: "https://dexscreener.com", icon: "https://dexscreener.com/favicon.ico" },
  { name: "GMGN", href: "https://gmgn.ai", icon: "https://gmgn.ai/favicon.ico" },
  { name: "Pump.fun", href: "https://pump.fun", icon: "https://pump.fun/favicon.ico" },
  { name: "Axiom", href: "https://axiom.trade", icon: "https://axiom.trade/favicon.ico" },
  { name: "Padre", href: "https://padre.gg", icon: "https://padre.gg/favicon.ico" },
] as const;

type Props = {
  message: string;
};

export default function MemeAgentBannerDisplay({ message }: Props) {
  return (
    <div className="mb-5 rounded-xl border border-violet-400/40 dark:border-violet-600/45 bg-gradient-to-r from-violet-100/90 via-fuchsia-50/80 to-cyan-100/70 dark:from-violet-950/50 dark:via-fuchsia-950/30 dark:to-cyan-950/40 px-4 py-3.5 shadow-sm">
      <p className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">{message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {PLATFORMS.map((p) => (
          <a
            key={p.name}
            href={p.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/60 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/70 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            title={p.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.icon} alt="" width={16} height={16} className="rounded-sm shrink-0" />
            {p.name}
          </a>
        ))}
      </div>
    </div>
  );
}
