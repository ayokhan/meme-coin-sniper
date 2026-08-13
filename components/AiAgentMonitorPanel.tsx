"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NoticeInline } from "@/components/NoticeBanner";
import type { MemeAgentChainMode } from "@/lib/meme-contract-format";

const INTERVALS_MS = [
  { label: "30 sec", ms: 30_000 },
  { label: "1 min", ms: 60_000 },
  { label: "2 min", ms: 120_000 },
  { label: "5 min", ms: 300_000 },
] as const;

type Props = {
  enabled: boolean;
  quotaExhausted: boolean;
  onUsageRecorded?: () => void;
  syncChain: MemeAgentChainMode;
  syncContract: string;
  syncAmountUsd?: string;
};

export default function AiAgentMonitorPanel({
  enabled,
  quotaExhausted,
  onUsageRecorded,
  syncChain,
  syncContract,
  syncAmountUsd,
}: Props) {
  const [monitorChain, setMonitorChain] = useState<MemeAgentChainMode>("auto");
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
        if (res.status === 429 && data.limitReached) {
          setMonitorError(data.error || "Daily Meme Coins Agent limit reached.");
          setMonitorOn(false);
        } else if (res.status === 401 && data.locked) {
          setMonitorError(data.error || "Sign in to use AI monitor.");
        } else {
          setMonitorError(data?.error ?? `Monitor failed (${res.status})`);
        }
        return;
      }
      fpRef.current = data.fingerprint;
      setLastFingerprint(data.fingerprint);
      setMonitorMessage(data.message ?? null);
      onUsageRecorded?.();
    } catch (e) {
      setMonitorError(e instanceof Error ? e.message : "Monitor failed");
    } finally {
      setMonitorLoading(false);
    }
  }, [monitorChain, monitorContract, parseAmount, syncChain, syncContract, onUsageRecorded]);

  useEffect(() => {
    if (!monitorOn || !monitorContract.trim() || quotaExhausted) return;
    void pollMonitor();
    const id = window.setInterval(() => void pollMonitor(), intervalMs);
    return () => window.clearInterval(id);
  }, [monitorOn, intervalMs, monitorChain, monitorContract, pollMonitor, quotaExhausted]);

  if (!enabled) return null;

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 bg-zinc-50/80 dark:bg-zinc-900/40">
      <div>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">AI monitor (auto-refresh)</p>
        <p className="text-xs text-muted-foreground mt-1">
          Each poll runs a full NovaStaris AI analysis and <strong className="text-zinc-700 dark:text-zinc-300">counts toward your Meme Coins Agent daily limit</strong> (Solana, BSC, and ETH combined). VIP: unlimited.
        </p>
      </div>
      {quotaExhausted && (
        <NoticeInline>
          Daily limit reached —{" "}
          <a href="/subscribe" className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
            upgrade to VIP
          </a>{" "}
          for unlimited monitor polls.
        </NoticeInline>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label className="text-[11px] text-muted-foreground block mb-0.5">Contract</label>
          <input
            value={monitorContract}
            onChange={(e) => setMonitorContract(e.target.value)}
            placeholder="Solana mint or 0x…"
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
          disabled={!monitorContract.trim() || quotaExhausted}
        >
          {monitorOn ? "Stop monitor" : "Start AI monitor"}
        </Button>
      </div>
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
