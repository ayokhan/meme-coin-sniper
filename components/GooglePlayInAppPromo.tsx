"use client";

import { useEffect, useState } from "react";
import { PLAY_STORE_URL, NOVASTARIS_SOCIAL, PLAY_STORE_GIVEAWAY } from "@/lib/app-distribution";
import { isCapacitorNative } from "@/lib/capacitor-native";
import GooglePlayDownloadLink from "@/components/GooglePlayDownloadLink";
import Link from "next/link";

const DISMISS_KEY = "novastaris_play_promo_dismissed_v1";

/** Soft in-app / dashboard promo: Google Play + $250 USDC giveaway (hidden inside native app). */
export default function GooglePlayInAppPromo({ className = "" }: { className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isCapacitorNative()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-cyan-500/25 bg-gradient-to-r from-zinc-950 via-zinc-900 to-emerald-950/40 px-4 py-3 ${className}`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded p-1 text-zinc-500 hover:text-zinc-300"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
          setShow(false);
        }}
      >
        ×
      </button>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:pr-6">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-white">NovaStaris is on Google Play</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Download the Android app — or{" "}
            <Link href="/register" className="text-cyan-400 underline hover:no-underline">
              register free
            </Link>{" "}
            for a chance to win {PLAY_STORE_GIVEAWAY.prizeLabel} by {PLAY_STORE_GIVEAWAY.drawLabel}.
          </p>
          <p className="text-[11px] text-zinc-500">
            Follow @{NOVASTARIS_SOCIAL.tiktok.handle} on TikTok · @{NOVASTARIS_SOCIAL.x.handle} on X
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <GooglePlayDownloadLink variant="button" />
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-500 underline hover:text-zinc-300 sm:hidden"
          >
            Open listing
          </a>
        </div>
      </div>
    </div>
  );
}
