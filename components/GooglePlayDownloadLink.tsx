"use client";

import { useEffect, useState } from "react";
import { PLAY_STORE_BADGE_IMG, PLAY_STORE_URL } from "@/lib/app-distribution";
import { isCapacitorNative } from "@/lib/capacitor-native";

type Props = {
  className?: string;
  variant?: "badge" | "button" | "compact";
  showInNativeApp?: boolean;
};

/** Google Play download CTA — landing, footers, in-app (web). */
export default function GooglePlayDownloadLink({
  className = "",
  variant = "badge",
  showInNativeApp = false,
}: Props) {
  const [hiddenNative, setHiddenNative] = useState(false);

  useEffect(() => {
    if (!showInNativeApp && isCapacitorNative()) setHiddenNative(true);
  }, [showInNativeApp]);

  if (hiddenNative) return null;

  if (variant === "compact") {
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 text-xs text-zinc-400 transition-colors hover:text-cyan-300 ${className}`}
      >
        <span aria-hidden className="text-[10px] font-bold tracking-wide text-emerald-400">
          ▶
        </span>
        Get it on Google Play
      </a>
    );
  }

  if (variant === "button") {
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-cyan-400/40 hover:bg-zinc-900 ${className}`}
      >
        <span className="text-emerald-400" aria-hidden>
          ▶
        </span>
        Get it on Google Play
      </a>
    );
  }

  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block transition-opacity hover:opacity-90 ${className}`}
      aria-label="Get NovaStaris on Google Play"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PLAY_STORE_BADGE_IMG}
        alt="Get it on Google Play"
        width={155}
        height={60}
        className="h-[52px] w-auto"
      />
    </a>
  );
}
