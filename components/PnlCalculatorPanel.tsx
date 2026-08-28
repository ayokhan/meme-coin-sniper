"use client";

import { useCallback, useEffect, useState } from "react";
import NovaPulsePnlCalculator from "@/components/NovaPulsePnlCalculator";

type Quota = {
  unlimited: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
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
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const refreshQuota = useCallback(async () => {
    if (isGuest) {
      setNeedsSignIn(true);
      setQuota(null);
      return;
    }
    try {
      const res = await fetch("/api/pnl-calculator/access", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!data?.success) {
        setAccessError(data?.error ?? "PnL Calculator unavailable.");
        setNeedsSignIn(!!data?.needsSignIn);
        setQuota(null);
        return;
      }
      setAccessError(null);
      setNeedsSignIn(false);
      setQuota({
        unlimited: !!data.unlimited,
        used: data.used ?? 0,
        limit: data.limit ?? null,
        remaining: data.remaining ?? null,
      });
    } catch {
      setAccessError("Could not load PnL Calculator access.");
    }
  }, [isGuest]);

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

  if (isGuest || needsSignIn) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-3">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">Sign in to calculate PnL</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Free accounts get 2 full calculations per day. VIP gets unlimited.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <a href="/signin" className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
            Sign in
          </a>
          <span className="text-muted-foreground">·</span>
          <a href="/register" className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
            Create free account
          </a>
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 text-center space-y-2">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">PnL Calculator</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{accessError}</p>
      </div>
    );
  }

  return (
    <NovaPulsePnlCalculator
      enabled={enabled}
      isVip={isVip}
      novaForexScalpBot={novaForexScalpBot}
      quota={quota}
      onQuotaChange={() => void refreshQuota()}
    />
  );
}
