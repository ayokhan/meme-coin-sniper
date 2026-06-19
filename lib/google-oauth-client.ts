"use client";

import { signIn } from "next-auth/react";
import { CAPACITOR_SITE_ORIGIN, isCapacitorNative } from "@/lib/capacitor-native";

export function getCapacitorAuthReturnPath(nextPath: string): string {
  return `/auth/capacitor-return?next=${encodeURIComponent(nextPath)}`;
}

export async function signInWithGoogle(callbackUrl: string): Promise<void> {
  if (typeof window === "undefined") return;

  if (isCapacitorNative()) {
    const { Browser } = await import("@capacitor/browser");
    const returnUrl = `${CAPACITOR_SITE_ORIGIN}${getCapacitorAuthReturnPath(callbackUrl)}`;
    const authUrl = `${CAPACITOR_SITE_ORIGIN}/api/auth/signin/google?callbackUrl=${encodeURIComponent(returnUrl)}`;
    await Browser.open({ url: authUrl });
    return;
  }

  await signIn("google", { callbackUrl });
}
