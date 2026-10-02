"use client";

import { Check, Crown, Minus, Sparkles } from "lucide-react";

type Product = "vip" | "nova_pro";

type Props = {
  product: Product;
  onChange: (p: Product) => void;
  novaPro: { plans: { months: number; priceUsd: number }[]; sharedDailyLimit: number; pulseDailyLimit: number };
  vipMonthly: number;
  cardFee: number;
  /** Pro subscribers upgrading: only VIP is selectable. */
  hidePro?: boolean;
};

const ROWS: { label: string; pro: string | boolean; vip: string | boolean }[] = [
  { label: "Every AI desk (AI Agent, NovaForecast, Forex Agent, NovaQ, Nova+, Wallet Tracker…)", pro: true, vip: true },
  { label: "AI runs per day", pro: "limit", vip: "Unlimited" },
  { label: "Nova Pulse runs per day", pro: "pulse", vip: "Unlimited" },
  { label: "Bots: NovaScalper, Forex Bots, GMGN, Prop Firm, Nova Ultimate, Polymarket", pro: false, vip: true },
  { label: "Coach Calls", pro: false, vip: true },
];

export default function NovaProPlanSwitcher({ product, onChange, novaPro, vipMonthly, cardFee, hidePro }: Props) {
  const proMonthly = novaPro.plans.find((p) => p.months === 1)?.priceUsd ?? 50;
  const cell = (v: string | boolean) => {
    if (v === true) return <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Included" />;
    if (v === false) return <Minus className="mx-auto h-4 w-4 text-zinc-400" aria-label="Not included" />;
    if (v === "limit") return <span>{novaPro.sharedDailyLimit}/day</span>;
    if (v === "pulse") return <span>{novaPro.pulseDailyLimit}/day</span>;
    return <span>{v}</span>;
  };

  return (
    <div className="mb-5 space-y-3">
      {!hidePro && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70 p-1">
          <button
            type="button"
            onClick={() => onChange("nova_pro")}
            className={`rounded-lg px-3 py-2.5 text-left transition-all ${
              product === "nova_pro" ? "bg-white dark:bg-zinc-900 shadow ring-2 ring-violet-500" : "hover:bg-white/50 dark:hover:bg-zinc-900/50"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
              <Sparkles className="h-4 w-4" aria-hidden /> Nova Pro
            </span>
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">
              ${proMonthly + cardFee}/mo card · ${proMonthly} USDC
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChange("vip")}
            className={`rounded-lg px-3 py-2.5 text-left transition-all ${
              product === "vip" ? "bg-white dark:bg-zinc-900 shadow ring-2 ring-amber-500" : "hover:bg-white/50 dark:hover:bg-zinc-900/50"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <Crown className="h-4 w-4" aria-hidden /> VIP
            </span>
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">
              ${vipMonthly + cardFee}/mo card · ${vipMonthly} USDC
            </span>
          </button>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700 text-zinc-500">
              <th className="px-3 py-2 text-left font-medium">Compare</th>
              <th className="px-3 py-2 text-center font-semibold text-violet-700 dark:text-violet-300">Nova Pro</th>
              <th className="px-3 py-2 text-center font-semibold text-amber-700 dark:text-amber-300">VIP</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{r.label}</td>
                <td className="px-3 py-2 text-center text-zinc-800 dark:text-zinc-200">{cell(r.pro)}</td>
                <td className="px-3 py-2 text-center text-zinc-800 dark:text-zinc-200">{cell(r.vip)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
