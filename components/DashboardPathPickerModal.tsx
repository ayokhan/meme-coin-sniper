"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_PATH_OPTIONS,
  applyDashboardPath,
  saveDashboardPath,
  type DashboardPath,
  type DashboardPathApplyResult,
} from "@/lib/dashboard-onboarding";

type Props = {
  open: boolean;
  onClose: () => void;
  onApply: (result: DashboardPathApplyResult) => void;
};

export default function DashboardPathPickerModal({ open, onClose, onApply }: Props) {
  const [selected, setSelected] = useState<DashboardPath | null>(null);

  if (!open) return null;

  const confirm = () => {
    const path = selected ?? "all";
    saveDashboardPath(path);
    onApply(applyDashboardPath(path));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-path-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl p-5 sm:p-6">
        <h2 id="dashboard-path-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          What do you trade most?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll focus your tabs and filters. You can change this anytime from the hint banner.
        </p>
        <div className="mt-4 grid gap-2">
          {DASHBOARD_PATH_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelected(opt.id)}
              className={`text-left rounded-xl border px-4 py-3 transition-all ${
                selected === opt.id
                  ? "border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 ring-1 ring-cyan-500/40"
                  : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              <span className="text-lg mr-2" aria-hidden>
                {opt.emoji}
              </span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{opt.title}</span>
              <p className="mt-0.5 text-xs text-muted-foreground pl-7">{opt.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Skip for now
          </Button>
          <Button type="button" size="sm" onClick={confirm} disabled={!selected}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
