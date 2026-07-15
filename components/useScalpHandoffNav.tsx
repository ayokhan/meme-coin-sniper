"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  openScalpHandoffUrl,
  readScalpHandoffNavPref,
  writeScalpHandoffNavPref,
  type ScalpHandoffNavMode,
} from "@/lib/nova-scalp-handoff-nav";

export type ScalpHandoffPending = {
  /** Destination path, e.g. /?tab=trading-bot */
  url: string;
  /** Write sessionStorage prefill before navigating. */
  prepare: () => void;
  /** Shown in the dialog title/body. */
  label: string;
};

/**
 * Prefer saved preference; otherwise queue a one-time dialog.
 * Returns { requestHandoff, dialog }.
 */
export function useScalpHandoffNav() {
  const [pending, setPending] = useState<ScalpHandoffPending | null>(null);
  const [remember, setRemember] = useState(true);

  const requestHandoff = useCallback((next: ScalpHandoffPending) => {
    const pref = readScalpHandoffNavPref();
    if (pref) {
      next.prepare();
      openScalpHandoffUrl(next.url, pref);
      return;
    }
    setRemember(true);
    setPending(next);
  }, []);

  const confirm = useCallback(
    (mode: ScalpHandoffNavMode) => {
      if (!pending) return;
      if (remember) writeScalpHandoffNavPref(mode);
      pending.prepare();
      openScalpHandoffUrl(pending.url, mode);
      setPending(null);
    },
    [pending, remember]
  );

  const cancel = useCallback(() => setPending(null), []);

  const dialog =
    pending == null ? null : (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/55"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scalp-handoff-nav-title"
        onClick={cancel}
      >
        <div
          className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-xl p-4 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <h3
              id="scalp-handoff-nav-title"
              className="text-sm font-semibold text-zinc-900 dark:text-zinc-50"
            >
              Open destination
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Continue with <span className="font-medium text-zinc-800 dark:text-zinc-200">{pending.label}</span>.
              Opening in a new tab keeps your current Scalp plan visible. You can change this later by clearing site
              data for this preference.
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-zinc-400"
            />
            Remember my choice for future handoffs
          </label>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={cancel}>
              Cancel
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => confirm("same_tab")}>
              Current tab
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => confirm("new_tab")}
            >
              New tab (recommended)
            </Button>
          </div>
        </div>
      </div>
    );

  return { requestHandoff, dialog };
}
