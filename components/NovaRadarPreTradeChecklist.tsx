"use client";

import type { NovaRadarPlanResult } from "@/lib/nova-radar";

type Props = {
  plans: NovaRadarPlanResult[];
  leverage: number | null;
};

export default function NovaRadarPreTradeChecklist({ plans, leverage }: Props) {
  const hasLeverage = leverage != null && leverage >= 1;
  const anyExtreme = plans.some((p) => p.leverage?.leverageRisk === "extreme" || p.leverage?.leverageRisk === "high");
  const anyPoorRr = plans.some((p) => p.leverage?.riskRewardToTp != null && p.leverage.riskRewardToTp < 1);

  const items = [
    {
      id: "blofin",
      label: "Confirm Est. Liq. Price and margin mode (isolated recommended) on Blofin before placing.",
      ok: true,
    },
    {
      id: "fill",
      label: "Limit fill is not guaranteed — check illustrative fill % on each plan card.",
      ok: plans.every((p) => (p.fillProbability?.probabilityPct ?? 50) >= 25),
    },
    {
      id: "lev",
      label:
        leverage != null && leverage >= 20
          ? `${leverage}× is aggressive — size down or lower leverage if stress ROE exceeds your comfort.`
          : "Set leverage and position size you can afford to draw down on a dip.",
      ok: !anyExtreme,
    },
    {
      id: "rr",
      label: "ROE reward to TP should exceed risk to SL/stress when using leverage.",
      ok: !anyPoorRr,
    },
    {
      id: "sl",
      label: "Define a stop loss on the exchange — do not rely on structure alone.",
      ok: plans.some((p) => p.leverage?.stopLossPrice != null),
    },
  ];

  if (!hasLeverage && plans.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/25 p-3">
      <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-2">Pre-trade checklist</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex gap-2 text-xs text-amber-950/90 dark:text-amber-50/90">
            <span className={item.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
              {item.ok ? "✓" : "!"}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
