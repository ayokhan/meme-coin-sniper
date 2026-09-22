"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NOVASTARIS_SOCIAL, PLAY_STORE_GIVEAWAY, PLAY_STORE_BADGE_IMG, PLAY_STORE_URL } from "@/lib/app-distribution";
import { isCapacitorNative } from "@/lib/capacitor-native";

const DISMISS_KEY = "novastaris_play_promo_dismissed_v2";

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
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0b] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,rgba(66,133,244,0.18),transparent_50%),radial-gradient(ellipse_at_100%_0%,rgba(52,168,83,0.12),transparent_45%)]" />
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute right-2.5 top-2.5 z-10 rounded-md px-1.5 py-0.5 text-sm text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
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
      <div className="relative z-10 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pr-10">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Now on Google Play
          </p>
          <p className="text-base font-semibold tracking-tight text-white sm:text-lg">
            Get the NovaStaris Android app
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
            Download free — or{" "}
            <Link href="/register" className="font-medium text-cyan-400 underline-offset-2 hover:underline">
              register
            </Link>{" "}
            for a chance to win{" "}
            <span className="font-semibold text-amber-300">{PLAY_STORE_GIVEAWAY.prizeLabel}</span> by{" "}
            {PLAY_STORE_GIVEAWAY.drawLabel}.
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
            <a
              href={NOVASTARIS_SOCIAL.tiktok.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300"
            >
              TikTok @{NOVASTARIS_SOCIAL.tiktok.handle}
            </a>
            <span className="text-zinc-700">·</span>
            <a
              href={NOVASTARIS_SOCIAL.x.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300"
            >
              X @{NOVASTARIS_SOCIAL.x.handle}
            </a>
          </p>
        </div>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 self-start transition-opacity hover:opacity-90 sm:self-center"
          aria-label="Get it on Google Play"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PLAY_STORE_BADGE_IMG}
            alt="Get it on Google Play"
            width={168}
            height={65}
            className="h-[58px] w-auto drop-shadow-md"
          />
        </a>
      </div>
    </div>
  );
}
