"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export type AiAgentOnboardingStep = 1 | 2 | 3;

type Props = {
  step: AiAgentOnboardingStep;
  onStepChange: (step: AiAgentOnboardingStep) => void;
  contractAddress: string;
  onContractAddressChange: (value: string) => void;
  amountUsd: string;
  onAmountUsdChange: (value: string) => void;
  onAnalyze: () => void;
  analyzeLoading: boolean;
  hasAnalysisResult: boolean;
  onPin: () => void;
  pinLoading?: boolean;
  onSkipPin: () => void;
  onDismiss: () => void;
};

export default function AiAgentOnboardingPanel({
  step,
  onStepChange,
  contractAddress,
  onContractAddressChange,
  amountUsd,
  onAmountUsdChange,
  onAnalyze,
  analyzeLoading,
  hasAnalysisResult,
  onPin,
  pinLoading,
  onSkipPin,
  onDismiss,
}: Props) {
  const steps: { n: AiAgentOnboardingStep; label: string }[] = [
    { n: 1, label: "Paste contract" },
    { n: 2, label: "Analyze token" },
    { n: 3, label: "Pin (optional)" },
  ];

  return (
    <div className="mb-6 rounded-xl border-2 border-cyan-400/70 dark:border-cyan-600/70 bg-gradient-to-br from-cyan-50/90 to-violet-50/40 dark:from-cyan-950/40 dark:to-violet-950/20 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Quick start</p>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
            Welcome — run your first Meme Coins analysis
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Three steps to see NovaStaris AI in action. Free accounts get daily limits; VIP is unlimited.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-zinc-700 dark:hover:text-zinc-300 underline"
        >
          Skip tour
        </button>
      </div>

      <ol className="flex flex-wrap gap-2 mb-5">
        {steps.map(({ n, label }) => {
          const active = step === n;
          const done = step > n || (n === 2 && hasAnalysisResult && step >= 3);
          return (
            <li
              key={n}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                active
                  ? "border-cyan-500 bg-cyan-500 text-white dark:bg-cyan-600"
                  : done
                    ? "border-emerald-400/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-zinc-300 dark:border-zinc-600 text-muted-foreground"
              }`}
            >
              <span className="font-bold">{n}</span> {label}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Paste a Solana mint or an EVM 0x contract. We detect Solana vs BSC/ETH from the address and the live pool — no chain tab needed.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Solana mint or 0x…"
                value={contractAddress}
                onChange={(e) => onContractAddressChange(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={() => onStepChange(2)}
              disabled={!contractAddress.trim()}
            >
              Continue →
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Run Analyze (or use the form below). We&apos;ll pick Solana, BSC, or ETH from the contract.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Solana mint or 0x…"
                value={contractAddress}
                onChange={(e) => onContractAddressChange(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="min-w-[100px]">
              <input
                type="text"
                placeholder="Amount $ (opt)"
                value={amountUsd}
                onChange={(e) => onAmountUsdChange(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <Button
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-700"
              onClick={onAnalyze}
              disabled={analyzeLoading || !contractAddress.trim()}
            >
              {analyzeLoading ? "Analyzing…" : "Analyze"}
            </Button>
          </div>
          {hasAnalysisResult && (
            <Button size="sm" variant="outline" onClick={() => onStepChange(3)}>
              Continue to pin step →
            </Button>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Pin this token to the <strong>Nova Staris Monitoring Board</strong> for auto re-checks every ~3 min
            (counts toward your free daily limit).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onPin} disabled={pinLoading || !hasAnalysisResult}>
              {pinLoading ? "Pinning…" : "Pin to monitoring board"}
            </Button>
            <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={onSkipPin}>
              Skip — I&apos;m done
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-4">
        Need unlimited uses?{" "}
        <Link href="/subscribe" className="text-cyan-600 dark:text-cyan-400 hover:underline">
          Upgrade to VIP
        </Link>
      </p>
    </div>
  );
}
