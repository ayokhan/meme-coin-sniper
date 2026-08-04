"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildPnlShareCaption,
  downloadBlob,
  nativeSharePnlBlob,
  openTelegramShare,
  shareToInstagram,
} from "@/lib/pnl-share";
import {
  fetchPnlShareReferral,
  readPnlShareReferralOptIn,
  stampPnlReferralFooter,
  writePnlShareReferralOptIn,
  type PnlShareReferral,
} from "@/lib/pnl-share-referral";

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
  /** Override caption (e.g. analysis share). Referral line is appended when include invite is on. */
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
  const [winsEnabled, setWinsEnabled] = useState(true);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [referral, setReferral] = useState<PnlShareReferral | null>(null);
  const [includeInvite, setIncludeInvite] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIncludeInvite(readPnlShareReferralOptIn());

    Promise.all([
      fetch("/api/feature-flags-public").then((r) => r.json()).catch(() => null),
      fetchPnlShareReferral(),
    ]).then(([flagsData, ref]) => {
      if (cancelled) return;
      setWinsEnabled(flagsData?.flags?.page_tab_wins !== false);
      const showRef = flagsData?.pnlShare?.showReferral !== false;
      setReferralEnabled(showRef);
      setReferral(showRef ? ref : null);
      if (!showRef || !ref) setIncludeInvite(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeReferral = referralEnabled && includeInvite && referral ? referral : null;

  const caption = useMemo(() => {
    const shareUrl = activeReferral?.link ?? "https://novastaris.ai/wins";
    const code = activeReferral?.code ?? null;

    if (captionOverride) {
      if (!activeReferral) return captionOverride;
      // Preserve custom caption body; ensure invite isn’t already present.
      if (captionOverride.includes(activeReferral.link) || captionOverride.includes(activeReferral.code)) {
        return captionOverride;
      }
      return `${captionOverride.trim()}\n\nJoin with my code ${activeReferral.code}\n${activeReferral.link}`;
    }

    return buildPnlShareCaption({
      symbol,
      roiPct,
      pnlUsdt,
      showUsdt,
      kind,
      investedUsdt,
      showAmountInvested,
      heldFor,
      showHoldDuration,
      shareUrl,
      referralCode: code,
    });
  }, [
    captionOverride,
    activeReferral,
    symbol,
    roiPct,
    pnlUsdt,
    showUsdt,
    kind,
    investedUsdt,
    showAmountInvested,
    heldFor,
    showHoldDuration,
  ]);

  const h = compact ? "h-6 text-[10px] px-1.5" : "h-7 text-xs";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const resolveBlob = async () => {
    const raw = await getBlob();
    if (!activeReferral) return raw;
    try {
      return await stampPnlReferralFooter(raw, activeReferral);
    } catch {
      return raw;
    }
  };

  const shareUrl = activeReferral?.link ?? "https://novastaris.ai/wins";

  return (
    <div className={`space-y-1 ${compact ? "mt-1.5" : "mt-2"}`}>
      {referralEnabled && referral && (
        <label
          className={`flex items-center gap-1.5 cursor-pointer text-muted-foreground ${
            compact ? "text-[10px]" : "text-xs"
          }`}
          title="Your Affiliate code + QR are stamped on the card and added to share text"
        >
          <input
            type="checkbox"
            className="rounded border-zinc-400"
            checked={includeInvite}
            onChange={(e) => {
              const on = e.target.checked;
              setIncludeInvite(on);
              writePnlShareReferralOptIn(on);
            }}
          />
          <span>
            Include my invite{" "}
            <span className="font-mono text-cyan-700 dark:text-cyan-300">{referral.code}</span>
          </span>
        </label>
      )}
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`${h} border-cyan-500/60 text-cyan-700 dark:text-cyan-300`}
          disabled={disabled || busy != null}
          onClick={() =>
            run("jpeg", async () => {
              const blob = await resolveBlob();
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
              const blob = await resolveBlob();
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
          onClick={() => run("tg", async () => openTelegramShare(caption, shareUrl))}
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
              const blob = await resolveBlob();
              await shareToInstagram(blob, filename, caption);
            })
          }
        >
          IG
        </Button>
        {winsEnabled && (
          <a
            href={shareUrl.includes("/register") ? shareUrl : "/wins"}
            target="_blank"
            rel="noopener noreferrer"
            className={`self-center text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ${
              compact ? "text-[10px] px-0.5" : "text-xs px-1"
            }`}
            title={
              activeReferral
                ? "Your invite / register link"
                : "Public page linked when you share PNL cards"
            }
          >
            {activeReferral ? "Invite" : "Wins"}
          </a>
        )}
      </div>
    </div>
  );
}
