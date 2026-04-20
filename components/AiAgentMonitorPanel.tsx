"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const INTERVALS_MS = [
  { label: "30 sec", ms: 30_000 },
  { label: "1 min", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
  { label: "5 min", ms: 300_000 },
] as const;

type Props = {
  isPaid: boolean;
  syncChain: "solana" | "bsc";
  syncContract: string;
  /** Optional $ amount passed through to the same AI analyze path as the main form */
  syncAmountUsd?: string;
};

export default function AiAgentMonitorPanel({ isPaid, syncChain, syncContract, syncAmountUsd }: Props) {
  const [monitorChain, setMonitorChain] = useState<"solana" | "bsc">("solana");
  const [monitorContract, setMonitorContract] = useState("");
  const [monitorOn, setMonitorOn] = useState(false);
  const [intervalMs, setIntervalMs] = useState(60_000);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [monitorMessage, setMonitorMessage] = useState<string | null>(null);
  const [lastFingerprint, setLastFingerprint] = useState<string | null>(null);
  const fpRef = useRef<string | null>(null);

  const parseAmount = useCallback((): number | undefined => {
    const raw = (syncAmountUsd ?? "").trim().replace(/,/g, "");
    if (!raw) return undefined;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }, [syncAmountUsd]);

  const pollMonitor = useCallback(async () => {
    const c = monitorContract.trim();
    if (!c) return;
    setMonitorLoading(true);
    setMonitorError(null);
    try {
      const sameAsForm =
        monitorChain === syncChain && c.toLowerCase() === syncContract.trim().toLowerCase();
      const amountUsd = sameAsForm ? parseAmount() : undefined;
      const res = await fetch("/api/ai-analyze-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          chain: monitorChain,
          contract: c,
          previousFingerprint: fpRef.current,
          ...(amountUsd != null ? { amountUsd } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMonitorError(data?.error ?? `Monitor failed (${res.status})`);
        if (res.status === 403 && data?.locked) setMonitorError(data.error || "Subscribe to use AI monitor.");
        return;
      }
      fpRef.current = data.fingerprint;
      setLastFingerprint(data.fingerprint);
      setMonitorMessage(data.message ?? null);
    } catch (e) {
      setMonitorError(e instanceof Error ? e.message : "Monitor failed");
    } finally {
      setMonitorLoading(false);
    }
  }, [monitorChain, monitorContract, parseAmount, syncChain, syncContract]);

  useEffect(() => {
    if (!monitorOn || !monitorContract.trim()) return;
    void pollMonitor();
    const id = window.setInterval(() => void pollMonitor(), intervalMs);
    return () => window.clearInterval(id);
  }, [monitorOn, intervalMs, monitorChain, monitorContract, pollMonitor]);

  if (!isPaid) return null;

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 bg-zinc-50/80 dark:bg-zinc-900/40">
      <div>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">AI monitor (auto-refresh)</p>
        <p className="text-xs text-muted-foreground mt-1">
          Polls the same full NovaStaris AI snapshot as <strong className="text-zinc-700 dark:text-zinc-300">Analyze</strong>. If the fingerprint changes between polls, reassess or consider exiting; if unchanged, you might stay with your plan. Not financial advice.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Chain</label>
          <select
            value={monitorChain}
            onChange={(e) => setMonitorChain(e.target.value === "bsc" ? "bsc" : "solana")}
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
          >
            <option value="solana">Solana</option>
            <option value="bsc">BSC</option>
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="text-[11px] text-muted-foreground block mb-0.5">Contract</label>
          <input
            value={monitorContract}
            onChange={(e) => setMonitorContract(e.target.value)}
            placeholder={monitorChain === "bsc" ? "0x…" : "Mint address"}
            className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 font-mono"
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground block mb-0.5">Interval</label>
          <select
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800"
          >
            {INTERVALS_MS.map((o) => (
              <option key={o.ms} value={o.ms}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setMonitorChain(syncChain);
            setMonitorContract(syncContract.trim());
          }}
          disabled={!syncContract.trim()}
          className="text-xs"
        >
          Use address above
        </Button>
        <Button
          type="button"
          size="sm"
          variant={monitorOn ? "destructive" : "default"}
          className={!monitorOn ? "bg-cyan-500 hover:bg-cyan-600 text-white" : ""}
          onClick={() => {
            if (!monitorOn) {
              fpRef.current = null;
              setLastFingerprint(null);
            }
            setMonitorOn((v) => !v);
          }}
          disabled={!monitorContract.trim()}
        >
          {monitorOn ? "Stop monitor" : "Start AI monitor"}
        </Button>
      </div>
      {monitorChain === "bsc" && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">BSC uses the same Pro/VIP rules as Analyze above.</p>
      )}
      {monitorError && <p className="text-xs text-rose-600 dark:text-rose-400">{monitorError}</p>}
      {monitorOn && (
        <div className="text-xs space-y-1 border-t border-zinc-200 dark:border-zinc-700 pt-3">
          {monitorLoading && <p className="text-muted-foreground">Fetching snapshot…</p>}
          {lastFingerprint && (
            <p className="font-mono text-[10px] text-muted-foreground break-all">Fingerprint: {lastFingerprint}</p>
          )}
          {monitorMessage && <p className="text-zinc-800 dark:text-zinc-200">{monitorMessage}</p>}
        </div>
      )}
    </div>
  );
}
