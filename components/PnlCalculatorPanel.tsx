"use client";

import { useCallback, useEffect, useState } from "react";
import NovaPulsePnlCalculator from "@/components/NovaPulsePnlCalculator";
import { Button } from "@/components/ui/button";
import {
  buildPnlCalculatorShareCaption,
  downloadPnlCalculatorPostcard,
  drawPnlCalculatorPostcard,
} from "@/lib/pnl-calculator-share-image";
import { sharePnlWithFallback } from "@/lib/pnl-share";
import { getVisitorId } from "@/lib/visitor-id";

type Quota = {
  unlimited: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
  isGuest?: boolean;
};

type Props = {
  enabled: boolean;
  isVip: boolean;
  isGuest: boolean;
  novaForexScalpBot?: boolean;
};

export default function PnlCalculatorPanel({ enabled, isVip, isGuest, novaForexScalpBot }: Props) {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [needsRegister, setNeedsRegister] = useState(false);
  const [postcardBusy, setPostcardBusy] = useState(false);
  const visitorId = getVisitorId();

  const refreshQuota = useCallback(async () => {
    try {
      const params = visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : "";
      const res = await fetch(`/api/pnl-calculator/access${params}`, { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!data?.success) {
        setAccessError(data?.error ?? "PnL Calculator unavailable.");
        setNeedsRegister(!!data?.needsRegister);
        setQuota(null);
        return;
      }
      setAccessError(null);
      setNeedsRegister(false);
      setQuota({
        unlimited: !!data.unlimited,
        used: data.used ?? 0,
        limit: data.limit ?? null,
        remaining: data.remaining ?? null,
        isGuest: !!data.isGuest,
      });
    } catch {
      setAccessError("Could not load PnL Calculator access.");
    }
  }, [visitorId]);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-2">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">PnL Calculator</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This tool is not enabled right now — contact support if you need access.
        </p>
      </div>
    );
  }

  if (accessError && !quota) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-3">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">PnL Calculator</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{accessError}</p>
        {needsRegister && (
          <div className="flex flex-wrap justify-center gap-2">
            <a href="/register" className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
              Register free — 4 calculations/day
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NovaPulsePnlCalculator
        enabled={enabled}
        isVip={isVip}
        isGuest={isGuest || !!quota?.isGuest}
        visitorId={visitorId}
        novaForexScalpBot={novaForexScalpBot}
        quota={quota}
        onQuotaChange={() => void refreshQuota()}
      />

      <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-gradient-to-b from-amber-50/40 to-transparent dark:from-amber-950/20 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Share on social</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Download a 1080×1080 postcard for X, Instagram, WhatsApp, or Telegram — includes caption text when your
            device supports native share.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={postcardBusy}
            onClick={async () => {
              setPostcardBusy(true);
              try {
                const blob = await drawPnlCalculatorPostcard();
                await sharePnlWithFallback(
                  blob,
                  `NovaStaris_PnL_Calculator_${new Date().toISOString().slice(0, 10)}.jpg`,
                  buildPnlCalculatorShareCaption()
                );
              } finally {
                setPostcardBusy(false);
              }
            }}
          >
            {postcardBusy ? "Preparing…" : "Share postcard"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={postcardBusy}
            onClick={async () => {
              setPostcardBusy(true);
              try {
                await downloadPnlCalculatorPostcard();
              } finally {
                setPostcardBusy(false);
              }
            }}
          >
            Download postcard
          </Button>
        </div>
      </div>
    </div>
  );
}
