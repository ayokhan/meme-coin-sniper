"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

export type ExchangeSetupMode = "blofin" | "coinbase" | "both";

type Props = {
  value: ExchangeSetupMode;
  onChange: (mode: ExchangeSetupMode) => void;
  coinbaseAvailable?: boolean;
  blofinConnected?: boolean | null;
  coinbaseConnected?: boolean | null;
  className?: string;
  title?: string;
  subtitle?: string;
};

const MODES: { id: ExchangeSetupMode; label: string; blurb: string }[] = [
  { id: "blofin", label: "Blofin", blurb: "USDT/USDC perps · Blofin API keys" },
  { id: "coinbase", label: "Coinbase", blurb: "USDC nano perps · CDP API keys" },
  { id: "both", label: "Both", blurb: "Run Blofin and Coinbase side by side" },
];

function logoSrc(exchange: "blofin" | "coinbase"): string {
  return exchange === "coinbase" ? "/partners/coinbase-logo.svg" : "/partners/blofin-logo-light.png";
}

export function exchangeSetupShowsBlofin(mode: ExchangeSetupMode): boolean {
  return mode === "blofin" || mode === "both";
}

export function exchangeSetupShowsCoinbase(mode: ExchangeSetupMode, coinbaseAvailable = true): boolean {
  return coinbaseAvailable && (mode === "coinbase" || mode === "both");
}

export function ExchangeSetupSelector({
  value,
  onChange,
  coinbaseAvailable = true,
  blofinConnected = null,
  coinbaseConnected = null,
  className = "",
  title = "Choose your exchange",
  subtitle = "Pick Blofin, Coinbase, or both. We only show the API keys and bot settings for what you select.",
}: Props) {
  const options = MODES.filter((m) => m.id !== "coinbase" || coinbaseAvailable);

  return (
    <div
      className={`rounded-xl border border-zinc-200/90 dark:border-zinc-700/80 bg-gradient-to-br from-zinc-50/90 via-white to-zinc-100/50 dark:from-zinc-950 dark:via-zinc-900/80 dark:to-zinc-950 p-4 sm:p-5 ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-prose">{subtitle}</p>
      </div>
      <div className={`grid gap-3 ${options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((opt) => {
          const active = value === opt.id;
          const isBlofin = opt.id === "blofin";
          const isCoinbase = opt.id === "coinbase";
          const connected =
            opt.id === "both"
              ? blofinConnected === true || coinbaseConnected === true
              : isBlofin
                ? blofinConnected === true
                : isCoinbase
                  ? coinbaseConnected === true
                  : false;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`relative text-left rounded-xl border px-4 py-3.5 transition-all ${
                active
                  ? isCoinbase
                    ? "border-blue-500/60 bg-blue-500/10 ring-2 ring-blue-500/30 shadow-sm"
                    : opt.id === "both"
                      ? "border-violet-500/50 bg-violet-500/10 ring-2 ring-violet-500/25 shadow-sm"
                      : "border-cyan-500/60 bg-cyan-500/10 ring-2 ring-cyan-500/30 shadow-sm"
                  : "border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {opt.id === "both" ? (
                    <div className="flex -space-x-2 shrink-0">
                      <Image src={logoSrc("blofin")} alt="" width={28} height={28} className="h-7 w-auto rounded bg-zinc-900/90 px-1" />
                      <Image src={logoSrc("coinbase")} alt="" width={28} height={28} className="h-7 w-auto rounded bg-zinc-900/90 px-1" />
                    </div>
                  ) : (
                    <Image
                      src={logoSrc(isCoinbase ? "coinbase" : "blofin")}
                      alt=""
                      width={72}
                      height={24}
                      className="h-6 w-auto shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{opt.blurb}</p>
                  </div>
                </div>
                {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />}
              </div>
              {connected && (
                <span className="inline-flex mt-2 items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Keys saved
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CoinbaseFuturesFormatNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-blue-500/20 bg-blue-950/20 dark:bg-blue-950/30 px-3 py-2.5 text-xs text-blue-100/90 space-y-1.5 ${className}`}
    >
      <p className="font-semibold text-blue-200">Coinbase Futures format</p>
      <ul className="list-disc pl-4 space-y-0.5 text-blue-100/80">
        <li>
          Instruments map to <span className="font-mono">BTC_USDC-PERPETUAL</span> (nano BTC perp in the UI).
        </li>
        <li>Margin and PnL are in <strong>USDC</strong>. Contract size is set by Coinbase (often 0.01 BTC per contract for nano).</li>
        <li>Size is sent in <strong>contracts</strong>; NovaStaris converts your margin × leverage using live mark price.</li>
        <li>Entry / exit / stop prices use the same units as Coinbase mark on your chart.</li>
      </ul>
    </div>
  );
}
