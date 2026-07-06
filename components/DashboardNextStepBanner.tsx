"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  dismissNextStep,
  getNextStepForPath,
  markNextStepDone,
  readNextStepDismissed,
  readNextStepDone,
  type NextStepAction,
} from "@/lib/dashboard-next-step";
import type { DashboardPath } from "@/lib/dashboard-onboarding";
import type { DashboardTabId } from "@/lib/dashboard-tabs";

type Props = {
  path: DashboardPath | null;
  hidden?: boolean;
  onAction: (action: NextStepAction) => void;
};

export default function DashboardNextStepBanner({ path, hidden, onAction }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [done, setDone] = useState(true);

  useEffect(() => {
    if (!path) {
      setDismissed(true);
      setDone(true);
      return;
    }
    setDismissed(readNextStepDismissed(path));
    setDone(readNextStepDone(path));
  }, [path]);

  if (hidden || !path) return null;
  const step = getNextStepForPath(path);
  if (!step || dismissed || done) return null;

  const run = () => {
    markNextStepDone(path);
    setDone(true);
    onAction(step.action);
  };

  const skip = () => {
    dismissNextStep(path);
    setDismissed(true);
  };

  return (
    <div className="mb-4 rounded-xl border border-violet-200/80 dark:border-violet-800/60 bg-gradient-to-r from-violet-50/95 via-white/90 to-cyan-50/80 dark:from-violet-950/40 dark:via-zinc-900/80 dark:to-cyan-950/30 px-4 py-3 text-sm shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-violet-900 dark:text-violet-100">{step.title}</p>
        <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">{step.description}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          onClick={run}
          className="bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          {step.ctaLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={skip}
          className="text-violet-800 dark:text-violet-200 hover:bg-violet-200/50 dark:hover:bg-violet-800/50"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}

export function markNextStepDoneForTab(path: DashboardPath | null, tab: DashboardTabId): void {
  if (!path) return;
  const step = getNextStepForPath(path);
  if (!step) return;
  if (step.action.type === "tab" && step.action.tab === tab) {
    markNextStepDone(path);
  }
  if (step.action.type === "futures-workflow" && tab === "futures") {
    markNextStepDone(path);
  }
}
