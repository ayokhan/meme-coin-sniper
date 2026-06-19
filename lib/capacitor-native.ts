"use client";

export function isCapacitorNative(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
    return !!w.Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export const CAPACITOR_APP_SCHEME = "ai.novastaris.app";
export const CAPACITOR_SITE_ORIGIN = "https://novastaris.ai";
