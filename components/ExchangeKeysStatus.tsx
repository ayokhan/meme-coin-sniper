"use client";

import { useCallback, useEffect, useState } from "react";

type KeysState = {
  blofin: boolean | null;
  coinbase: boolean | null;
  coinbaseFeatureDisabled?: boolean;
};

type Props = {
  activeProvider?: "blofin" | "coinbase";
  className?: string;
};

/** Shows which exchange API keys are saved (owner/VIP). */
export function ExchangeKeysStatus({ activeProvider, className = "" }: Props) {
  const [state, setState] = useState<KeysState>({ blofin: null, coinbase: null });

  const load = useCallback(async () => {
    const [blofinRes, coinbaseRes] = await Promise.all([
      fetch("/api/user/blofin-config", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/user/coinbase-config", { credentials: "include" }).then((r) => r.json()).catch(() => ({})),
    ]);
    setState({
      blofin: blofinRes.success && blofinRes.configured === true,
      coinbase: coinbaseRes.featureDisabled ? false : coinbaseRes.success && coinbaseRes.configured === true,
      coinbaseFeatureDisabled: coinbaseRes.featureDisabled === true,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pill = (label: string, ok: boolean | null, active: boolean) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        active
          ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
          : ok === true
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : ok === false
              ? "border-zinc-600 bg-zinc-800/50 text-zinc-400"
              : "border-zinc-700 text-zinc-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ok === true ? "bg-emerald-400" : ok === false ? "bg-zinc-500" : "bg-zinc-600"
        }`}
      />
      {label}
      {active && <span className="text-[10px] uppercase tracking-wide opacity-80">· active</span>}
      {ok === true && !active && <span className="text-[10px] opacity-80">· keys saved</span>}
    </span>
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-900/40 px-3 py-2 ${className}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Connected</span>
      {pill("Blofin", state.blofin, activeProvider === "blofin")}
      {!state.coinbaseFeatureDisabled && pill("Coinbase", state.coinbase, activeProvider === "coinbase")}
      {state.coinbaseFeatureDisabled && (
        <span className="text-[11px] text-zinc-500">Coinbase (admin disabled)</span>
      )}
    </div>
  );
}
