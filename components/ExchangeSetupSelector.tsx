"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { PartnerLogosStrip } from "@/components/PartnerLogosStrip";

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

const MODES: { id: ExchangeSetupMode; label: string; blurb: string; accent: string }[] = [
  {
    id: "blofin",
    label: "Blofin",
    blurb: "USDT/USDC perpetuals · Blofin API keys",
    accent: "cyan",
  },
  {
    id: "coinbase",
    label: "Coinbase Futures",
    blurb: "USDC nano perps · CDP API keys",
    accent: "blue",
  },
  {
    id: "both",
    label: "Both exchanges",
    blurb: "Run Blofin and Coinbase in parallel",
    accent: "violet",
  },
];

function logoSrc(exchange: "blofin" | "coinbase"): string {
  return exchange === "coinbase" ? "/partners/coinbase-logo.svg" : "/partners/blofin-logo-light.png";
}

function activeCardClass(active: boolean, accent: string): string {
  if (!active) {
    return "border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-900/40 dark:bg-zinc-900/50 hover:border-zinc-400/60 dark:hover:border-zinc-600 hover:bg-zinc-800/40";
  }
  if (accent === "blue") {
    return "border-blue-500/50 bg-gradient-to-b from-blue-500/15 to-blue-950/20 ring-2 ring-blue-500/25 shadow-[0_0_24px_-4px_rgba(59,130,246,0.35)]";
  }
  if (accent === "violet") {
    return "border-violet-500/45 bg-gradient-to-b from-violet-500/12 to-indigo-950/25 ring-2 ring-violet-500/20 shadow-[0_0_24px_-4px_rgba(139,92,246,0.3)]";
  }
  return "border-cyan-500/50 bg-gradient-to-b from-cyan-500/12 to-cyan-950/20 ring-2 ring-cyan-500/25 shadow-[0_0_24px_-4px_rgba(34,211,238,0.3)]";
}

function ExchangePartnershipHeader({
  mode,
  coinbaseAvailable,
}: {
  mode: ExchangeSetupMode;
  coinbaseAvailable: boolean;
}) {
  if (!coinbaseAvailable) {
    return (
      <div className="mb-5 flex justify-center sm:justify-start">
        <PartnerLogosStrip partner="blofin" className="w-full max-w-md" />
      </div>
    );
  }

  if (mode === "both") {
    return (
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <PartnerLogosStrip partner="blofin" className="w-full justify-center" />
        <PartnerLogosStrip partner="coinbase" className="w-full justify-center" />
      </div>
    );
  }

  return (
    <div className="mb-5 flex justify-center sm:justify-start">
      <PartnerLogosStrip
        partner={mode === "coinbase" ? "coinbase" : "blofin"}
        className="w-full max-w-md"
      />
    </div>
  );
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
      className={`overflow-hidden rounded-2xl border border-zinc-700/60 bg-gradient-to-br from-zinc-950 via-zinc-900/95 to-zinc-950 shadow-xl ${className}`}
    >
      {/* Top partnership band */}
      <div className="border-b border-zinc-800/80 bg-gradient-to-r from-zinc-900/90 via-zinc-900/50 to-zinc-900/90 px-4 py-4 sm:px-6 sm:py-5">
        <ExchangePartnershipHeader mode={value} coinbaseAvailable={coinbaseAvailable} />
        <div className="text-center sm:text-left">
          <h3 className="text-base font-semibold tracking-tight text-zinc-50">{title}</h3>
          <p className="text-xs text-zinc-400 mt-1.5 max-w-xl leading-relaxed">{subtitle}</p>
        </div>
      </div>

      {/* Exchange cards */}
      <div className="p-4 sm:p-5">
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
                className={`relative flex flex-col rounded-xl border px-4 py-4 text-left transition-all duration-200 ${activeCardClass(active, opt.accent)}`}
              >
                {active && (
                  <CheckCircle2
                    className="absolute top-3 right-3 h-4 w-4 text-emerald-400"
                    aria-hidden
                  />
                )}

                <div className="flex flex-col items-center text-center gap-2 mb-2 pt-1">
                  {opt.id === "both" ? (
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-950/80 px-3 py-2">
                      <Image
                        src={logoSrc("blofin")}
                        alt="Blofin"
                        width={64}
                        height={20}
                        className="h-5 w-auto opacity-90"
                      />
                      <span className="text-[10px] font-bold text-zinc-500">+</span>
                      <Image
                        src={logoSrc("coinbase")}
                        alt="Coinbase"
                        width={72}
                        height={20}
                        className="h-5 w-auto"
                      />
                    </div>
                  ) : isCoinbase ? (
                    <div className="rounded-lg border border-blue-500/25 bg-blue-950/40 px-4 py-2.5">
                      <Image
                        src={logoSrc("coinbase")}
                        alt="Coinbase"
                        width={100}
                        height={28}
                        className="h-7 w-auto"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-cyan-500/20 bg-zinc-950/80 px-4 py-2.5">
                      <Image
                        src={logoSrc("blofin")}
                        alt="Blofin"
                        width={88}
                        height={24}
                        className="h-6 w-auto"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{opt.label}</p>
                    <p className="text-[11px] text-zinc-400 leading-snug mt-0.5 px-1">{opt.blurb}</p>
                  </div>
                </div>

                {connected && (
                  <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Keys saved
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {coinbaseAvailable && (value === "coinbase" || value === "both") && (
          <p className="mt-4 text-center text-[11px] text-blue-300/70 sm:text-left">
            NovaStaris × Coinbase — trade nano BTC perps with your CDP API keys.
          </p>
        )}
      </div>
    </div>
  );
}

export function CoinbaseFuturesFormatNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-blue-500/25 bg-gradient-to-br from-blue-950/50 via-zinc-950/90 to-indigo-950/40 overflow-hidden ${className}`}
    >
      <div className="border-b border-blue-500/15 px-3 py-2.5 bg-blue-950/30">
        <PartnerLogosStrip partner="coinbase" size="sm" className="border-0 bg-transparent p-0" />
      </div>
      <div className="px-3 py-2.5 text-xs text-blue-100/90 space-y-1.5">
        <p className="font-semibold text-blue-200">Coinbase Futures format</p>
        <ul className="list-disc pl-4 space-y-0.5 text-blue-100/75">
          <li>
            Instruments map to <span className="font-mono text-blue-200/90">BTC_USDC-PERPETUAL</span> (nano BTC perp in
            the Coinbase UI).
          </li>
          <li>
            Prefer <strong className="text-blue-100">Size mode → Contracts</strong> so Amount matches Coinbase Advanced
            Trade (1 contract ≈ contract size in base, often 0.01 BTC for nano).
          </li>
          <li>
            <strong className="text-blue-100">TP / SL:</strong> Trading Bot uses Take profit % and Stop loss %.
            NovaScalper uses Exit price + Stop loss (+ optional attach TP/SL on Coinbase).
          </li>
          <li>
            <strong className="text-blue-100">Max leverage</strong> is fetched from Coinbase per instrument and clamped
            automatically (often up to 50×).
          </li>
        </ul>
      </div>
    </div>
  );
}
