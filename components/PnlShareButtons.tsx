"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildPnlShareCaption,
  downloadBlob,
  nativeSharePnlBlob,
  openTelegramShare,
  shareToInstagram,
} from "@/lib/pnl-share";

type PnlShareButtonsProps = {
  getBlob: () => Promise<Blob>;
  filename: string;
  /** Used for default caption when `caption` is omitted. */
  symbol?: string;
  roiPct?: number;
  pnlUsdt?: number;
  showUsdt?: boolean;
  investedUsdt?: number | null;
  showAmountInvested?: boolean;
  heldFor?: string | null;
  showHoldDuration?: boolean;
  kind?: "open" | "closed";
  /** Override caption (e.g. analysis share). */
  caption?: string;
  disabled?: boolean;
  compact?: boolean;
  primaryLabel?: string;
};

export default function PnlShareButtons({
  getBlob,
  filename,
  symbol = "",
  roiPct = 0,
  pnlUsdt = 0,
  showUsdt = true,
  investedUsdt = null,
  showAmountInvested = false,
  heldFor = null,
  showHoldDuration = false,
  kind = "closed",
  caption: captionOverride,
  disabled,
  compact,
  primaryLabel = "Card",
}: PnlShareButtonsProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const caption =
    captionOverride ??
    buildPnlShareCaption({
      symbol,
      roiPct,
      pnlUsdt,
      showUsdt,
      kind,
      investedUsdt,
      showAmountInvested,
      heldFor,
      showHoldDuration,
    });
  const h = compact ? "h-6 text-[10px] px-1.5" : "h-7 text-xs";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "mt-1.5" : "mt-2"}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`${h} border-cyan-500/60 text-cyan-700 dark:text-cyan-300`}
        disabled={disabled || busy != null}
        onClick={() =>
          run("jpeg", async () => {
            const blob = await getBlob();
            downloadBlob(blob, filename);
          })
        }
      >
        {busy === "jpeg" ? "…" : primaryLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={h}
        disabled={disabled || busy != null}
        title="Share via phone apps (Telegram, Instagram, …)"
        onClick={() =>
          run("share", async () => {
            const blob = await getBlob();
            await nativeSharePnlBlob(blob, filename, caption);
          })
        }
      >
        {busy === "share" ? "…" : "Share"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`${h} border-sky-500/50 text-sky-700 dark:text-sky-300`}
        disabled={disabled || busy != null}
        title="Open Telegram share"
        onClick={() => run("tg", async () => openTelegramShare(caption))}
      >
        TG
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`${h} border-pink-500/50 text-pink-700 dark:text-pink-300`}
        disabled={disabled || busy != null}
        title="Share or save for Instagram Stories"
        onClick={() =>
          run("ig", async () => {
            const blob = await getBlob();
            await shareToInstagram(blob, filename, caption);
          })
        }
      >
        IG
      </Button>
    </div>
  );
}
