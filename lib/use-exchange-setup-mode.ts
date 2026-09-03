"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExchangeSetupMode } from "@/components/ExchangeSetupSelector";

/** Persist Blofin / Coinbase / both picker per page. */
export function useExchangeSetupMode(storageKey: string, defaultMode: ExchangeSetupMode = "blofin") {
  const [mode, setModeState] = useState<ExchangeSetupMode>(defaultMode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === "blofin" || raw === "coinbase" || raw === "both") {
        setModeState(raw);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  const setMode = useCallback(
    (next: ExchangeSetupMode) => {
      setModeState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

  return { mode, setMode, hydrated };
}
