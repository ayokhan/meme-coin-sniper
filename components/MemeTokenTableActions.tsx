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

const copyBtnQuietClass =
  "inline-flex items-center rounded-md border border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-50/90 dark:bg-zinc-800/70 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:border-teal-500/35 hover:text-teal-800 dark:hover:text-teal-200 transition-colors";
const copyBtnQuietCopiedClass =
  "inline-flex items-center rounded-md border border-emerald-300/70 dark:border-emerald-700/60 bg-emerald-50/90 dark:bg-emerald-950/50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300";

/** Soft secondary share chip (desk rows) — less loud than amber pill, still clearly a control */
export const memeTableShareBtnQuietClass =
  "inline-flex items-center rounded-md border border-amber-300/50 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/40 px-2 py-1 text-[11px] font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100/90 dark:hover:bg-amber-900/50 transition-colors";
export const memeTableShareBtnQuietCopiedClass =
  "inline-flex items-center rounded-md border border-emerald-300/70 dark:border-emerald-700/60 bg-emerald-50/90 dark:bg-emerald-950/50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300";

/** Soft external link chip for Go Hunting — readable as clickable without pill clutter */
export const memeTableExtLinkQuietClass =
  "inline-flex items-center rounded-md border border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/60 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:border-teal-500/40 hover:text-teal-800 dark:hover:text-teal-200 transition-colors";

type Props = {
  contractAddress: string;
  chain?: "solana" | "bsc";
  /**
   * Desk row: soft Copy chip + always-visible purple Analyze
   * (matches “Don’t Get Rugged” / purple Analyze messaging).
   */
  variant?: "default" | "quiet";
};

export default function MemeTokenTableActions({
  contractAddress,
  chain = "solana",
  variant = "default",
}: Props) {
  const [copied, setCopied] = useState(false);
  const quiet = variant === "quiet";

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
        onClick={() => openNovaStarisAiAgent(contractAddress, chain)}
        className={analyzeBtnClass}
        title="Run Nova AI Analysis on this coin"
      >
        <Sparkles className="h-3 w-3 mr-0.5 inline" />
        Analyze
      </button>
      <button
        type="button"
        onClick={() => void copyId()}
        className={
          quiet
            ? copied
              ? copyBtnQuietCopiedClass
              : copyBtnQuietClass
            : copied
              ? copyBtnCopiedClass
              : copyBtnClass
        }
        title={`Copy contract: ${contractAddress}`}
      >
        {copied ? (
          <Check className={`h-3 w-3 mr-0.5 ${quiet ? "" : "text-emerald-600 dark:text-emerald-400"}`} />
        ) : (
          <Copy className="h-3 w-3 mr-0.5 inline" />
        )}
        {copied ? "Copied" : "Copy ID"}
      </button>
    </>
  );
}
