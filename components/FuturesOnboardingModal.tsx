"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "novastaris-futures-onboarding-v1";

type Props = {
  open: boolean;
  onClose: () => void;
  onGoNovaRadar?: () => void;
};

export function useFuturesOnboarding(): {
  shouldShow: boolean;
  dismiss: () => void;
} {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setShouldShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setShouldShow(false);
  };

  return { shouldShow, dismiss };
}

export default function FuturesOnboardingModal({ open, onClose, onGoNovaRadar }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="max-w-md w-full rounded-lg border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-zinc-900 p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Crypto Futures — quick start</h3>
        <p className="text-sm text-muted-foreground mb-4">
          NovaStaris futures tools are built for <strong className="text-zinc-800 dark:text-zinc-200">structured decisions</strong>, not
          guaranteed signals.
        </p>
        <ol className="text-sm space-y-2 list-decimal pl-5 text-zinc-700 dark:text-zinc-300 mb-4">
          <li>
            <strong>Institutional Workflow</strong> — macro bias and rules before you trade.
          </li>
          <li>
            <strong>NovaRadar (VIP)</strong> — compare two limit orders with fill odds, leverage ROE, and Blofin-style risk.
          </li>
          <li>
            <strong>AI Chart Analysis</strong> — upload a chart for levels and TP/SL ideas.
          </li>
          <li>
            <strong>Trading Bot</strong> — connect Blofin keys; confirm demo vs live mode.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground mb-4">
          Ontario users: futures execution is oriented around Blofin per our docs. Always confirm liquidation price on the exchange.
        </p>
        <div className="flex flex-wrap gap-2">
          {onGoNovaRadar && (
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={() => { onGoNovaRadar(); onClose(); }}>
              Open NovaRadar
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
