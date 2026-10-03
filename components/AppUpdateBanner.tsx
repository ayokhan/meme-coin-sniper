"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { isCapacitorNative } from "@/lib/capacitor-native";
import { LATEST_ANDROID_VERSION_CODE, PLAY_STORE_URL } from "@/lib/app-distribution";

const DISMISS_KEY = "novastaris_app_update_dismissed_v1";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/** Android app only: nudges installs older than LATEST_ANDROID_VERSION_CODE to update from Google Play. */
export default function AppUpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isCapacitorNative()) return;
    let cancelled = false;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = Number.parseInt(info.build, 10);
        if (!Number.isFinite(installed) || installed >= LATEST_ANDROID_VERSION_CODE) return;
        const raw = localStorage.getItem(DISMISS_KEY);
        const dismissed = raw ? (JSON.parse(raw) as { code?: number; at?: number }) : null;
        if (dismissed?.code === LATEST_ANDROID_VERSION_CODE && Date.now() - (dismissed.at ?? 0) < SNOOZE_MS) return;
        if (!cancelled) setVisible(true);
      } catch {
        /* no version info: never block the app over a banner */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ code: LATEST_ANDROID_VERSION_CODE, at: Date.now() }));
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[95] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-cyan-500/40 bg-zinc-950/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <Download className="h-5 w-5 shrink-0 text-cyan-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">A new version of NovaStaris is available</p>
          <p className="text-xs text-zinc-400">Update for biometric sign-in and the latest fixes.</p>
        </div>
        <a
          href={PLAY_STORE_URL}
          onClick={dismiss}
          className="shrink-0 rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-cyan-400"
        >
          Update
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-zinc-400 hover:text-zinc-100"
          aria-label="Remind me later"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
