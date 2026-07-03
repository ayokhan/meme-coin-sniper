"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { openNovaStarisAiAgent } from "@/lib/novastaris-events";

const copyBtnClass =
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors " +
  "bg-sky-100 text-sky-800 border-sky-300/80 hover:bg-sky-200 " +
  "dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-700/70 dark:hover:bg-sky-900/80";

const copyBtnCopiedClass =
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors " +
  "bg-emerald-100 text-emerald-800 border-emerald-300/80 " +
  "dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700/70";

const analyzeBtnClass =
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors " +
  "bg-violet-100 text-violet-800 border-violet-300/80 hover:bg-violet-200 " +
  "dark:bg-violet-950/70 dark:text-violet-200 dark:border-violet-700/70 dark:hover:bg-violet-900/80";

export const memeTableShareBtnClass =
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors " +
  "bg-amber-100 text-amber-900 border-amber-300/80 hover:bg-amber-200 " +
  "dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700/70 dark:hover:bg-amber-900/80";

export const memeTableShareBtnCopiedClass =
  "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors " +
  "bg-emerald-100 text-emerald-800 border-emerald-300/80 " +
  "dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700/70";

type Props = {
  contractAddress: string;
  chain?: "solana" | "bsc";
};

export default function MemeTokenTableActions({ contractAddress, chain = "solana" }: Props) {
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(contractAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void copyId()}
        className={copied ? copyBtnCopiedClass : copyBtnClass}
        title={`Copy contract: ${contractAddress}`}
      >
        {copied ? <Check className="h-3 w-3 mr-0.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3 mr-0.5 inline" />}
        {copied ? "Copied" : "Copy ID"}
      </button>
      <button
        type="button"
        onClick={() => openNovaStarisAiAgent(contractAddress, chain)}
        className={analyzeBtnClass}
        title="Analyze in NovaStaris AI Agent"
      >
        <Sparkles className="h-3 w-3 mr-0.5 inline" />
        Analyze
      </button>
    </>
  );
}
