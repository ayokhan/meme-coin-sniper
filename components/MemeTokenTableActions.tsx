"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { openNovaStarisAiAgent } from "@/lib/novastaris-events";

const actionBtnClass =
  "inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors";

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
        className={actionBtnClass}
        title={`Copy contract: ${contractAddress}`}
      >
        {copied ? <Check className="h-3 w-3 mr-0.5 text-emerald-600" /> : <Copy className="h-3 w-3 mr-0.5 inline" />}
        {copied ? "Copied" : "Copy ID"}
      </button>
      <button
        type="button"
        onClick={() => openNovaStarisAiAgent(contractAddress, chain)}
        className={actionBtnClass}
        title="Analyze in NovaStaris AI Agent"
      >
        <Sparkles className="h-3 w-3 mr-0.5 inline" />
        Analyze
      </button>
    </>
  );
}
