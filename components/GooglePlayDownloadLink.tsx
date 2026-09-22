"use client";

import { useEffect, useState } from "react";
import { PLAY_STORE_BADGE_IMG, PLAY_STORE_URL } from "@/lib/app-distribution";
import { isCapacitorNative } from "@/lib/capacitor-native";

/** Official Google Play triangle mark (brand colors). */
export function GooglePlayMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M3.6 2.2 13.3 12 3.6 21.8c-.5-.3-.8-.8-.8-1.4V3.6c0-.6.3-1.1.8-1.4z" />
      <path fill="#FBBC04" d="M16.7 8.6 13.3 12l3.4 3.4 3.5-2c.7-.4.7-1.4 0-1.8l-3.5-2z" />
      <path fill="#4285F4" d="M3.6 2.2c.3-.2.6-.2.9 0L16.7 8.6 13.3 12 3.6 2.2z" />
      <path fill="#34A853" d="M13.3 12 16.7 15.4 4.5 21.8c-.3.2-.6.2-.9 0L13.3 12z" />
    </svg>
  );
}

type Props = {
  className?: string;
  variant?: "badge" | "button" | "compact";
  showInNativeApp?: boolean;
};

/** Google Play download CTA — always uses official badge or Play mark (never a tiny ▶). */
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
        className={`inline-flex items-center gap-2 rounded-md border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:border-white/30 hover:bg-black/80 ${className}`}
        aria-label="Get it on Google Play"
      >
        <GooglePlayMark className="h-4 w-4 shrink-0" />
        <span className="leading-none">Google Play</span>
      </a>
    );
  }

  if (variant === "button") {
    return (
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2.5 rounded-lg border border-white/20 bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:border-white/35 hover:bg-zinc-900 ${className}`}
        aria-label="Get it on Google Play"
      >
        <GooglePlayMark className="h-5 w-5 shrink-0" />
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
