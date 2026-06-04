"use client";

import { Button } from "@/components/ui/button";
import { pathHintCopy, type DashboardPath } from "@/lib/dashboard-onboarding";

type Props = {
  path: DashboardPath | null;
  dismissed: boolean;
  onDismiss: () => void;
  onChangePath: () => void;
};

export default function DashboardPathHintBanner({ path, dismissed, onDismiss, onChangePath }: Props) {
  if (dismissed) return null;

  return (
    <div className="mb-6 rounded-xl border border-cyan-200/80 dark:border-cyan-800/80 bg-gradient-to-r from-cyan-50/95 via-white/90 to-violet-50/80 dark:from-cyan-950/50 dark:via-zinc-900/80 dark:to-violet-950/30 px-4 py-3 text-sm text-cyan-900 dark:text-cyan-100 shadow-sm flex items-center justify-between gap-3 flex-wrap">
      <span>{pathHintCopy(path)}</span>
      <span className="flex gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onChangePath}
          className="text-cyan-800 dark:text-cyan-200 hover:bg-cyan-200/50 dark:hover:bg-cyan-800/50"
        >
          Change path
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-cyan-800 dark:text-cyan-200 hover:bg-cyan-200/50 dark:hover:bg-cyan-800/50"
        >
          Dismiss
        </Button>
      </span>
    </div>
  );
}
