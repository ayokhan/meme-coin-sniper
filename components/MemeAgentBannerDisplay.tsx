"use client";

import type { MemeAgentTitleFont, MemeAgentTitleSize } from "@/lib/meme-agent-banner";

const PLATFORMS = [
  { name: "NovaStaris AI Agent", href: "/?tab=ai-analysis&agent=meme", icon: "/platform-icons/novastaris.svg", external: false },
  { name: "Dex Screener", href: "https://dexscreener.com", icon: "/platform-icons/dexscreener.png", external: true },
  { name: "GMGN", href: "https://gmgn.ai", icon: "/platform-icons/gmgn.png", external: true },
  { name: "Pump.fun", href: "https://pump.fun", icon: "/platform-icons/pumpfun.png", external: true },
  { name: "Axiom", href: "https://axiom.trade", icon: "/platform-icons/axiom.png", external: true },
  { name: "Padre", href: "https://padre.gg", icon: "/platform-icons/padre.png", external: true },
  { name: "FOMO", href: "https://fomo.family", icon: "/platform-icons/fomo.png", external: true },
] as const;

const TITLE_SIZE_CLASSES: Record<MemeAgentTitleSize, string> = {
  lg: "text-lg leading-normal",
  xl: "text-xl leading-normal",
  "2xl": "text-xl sm:text-2xl leading-normal",
  "3xl": "text-2xl sm:text-3xl leading-normal",
};

type Props = {
  title: string;
  message: string;
  titleColor?: string;
  titleSize?: MemeAgentTitleSize;
  titleFont?: MemeAgentTitleFont;
  className?: string;
};

export default function MemeAgentBannerDisplay({
  title,
  message,
  titleColor = "#f472b6",
  titleSize = "2xl",
  titleFont = "display",
  className = "mb-5",
}: Props) {
  const titleFontClass = titleFont === "display" ? "font-display" : "font-sans";

  return (
    <div
      className={`rounded-xl border border-violet-400/45 dark:border-violet-600/50 bg-gradient-to-br from-violet-100/95 via-fuchsia-50/85 to-cyan-100/75 dark:from-violet-950/55 dark:via-fuchsia-950/35 dark:to-cyan-950/45 px-4 py-4 sm:px-5 sm:py-4 shadow-sm overflow-visible ${className}`.trim()}
    >
      <div className="flex items-start gap-3 overflow-visible">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/platform-icons/novastaris.svg"
          alt="NovaStaris"
          width={36}
          height={36}
          className="mt-0.5 h-9 w-9 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1 space-y-1.5 overflow-visible">
          <h3
            className={`${titleFontClass} ${TITLE_SIZE_CLASSES[titleSize]} font-bold tracking-tight`}
            style={{ color: titleColor }}
          >
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
            {...(p.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/70 dark:border-zinc-700/80 bg-white/90 dark:bg-zinc-900/75 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            title={p.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.icon} alt="" width={18} height={18} className="rounded-sm shrink-0 object-contain bg-white/90 dark:bg-zinc-900/90" />
            {p.name}
          </a>
        ))}
      </div>
    </div>
  );
}
