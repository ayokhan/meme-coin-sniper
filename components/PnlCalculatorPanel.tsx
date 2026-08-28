"use client";

import { useCallback, useEffect, useState } from "react";
import NovaPulsePnlCalculator from "@/components/NovaPulsePnlCalculator";
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
    <NovaPulsePnlCalculator
      enabled={enabled}
      isVip={isVip}
      isGuest={isGuest || !!quota?.isGuest}
      visitorId={visitorId}
      novaForexScalpBot={novaForexScalpBot}
      quota={quota}
      onQuotaChange={() => void refreshQuota()}
    />
  );
}
