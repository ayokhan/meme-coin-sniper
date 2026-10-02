"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCapacitorNative } from "@/lib/capacitor-native";
import {
  BiometricCancelledError,
  BiometricInvalidatedError,
  getLocalEnrollment,
  verifyBiometricUnlock,
} from "@/lib/biometric-client";

/** sessionStorage dies with the WebView, so a missing flag means a cold app start. */
const UNLOCKED_KEY = "novastaris_app_unlocked_v1";
const RELOCK_AFTER_MS = 5 * 60 * 1000;

function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

function unlockedThisSession(): boolean {
  try {
    return sessionStorage.getItem(UNLOCKED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Android app only: when biometric sign-in is enabled on this phone, the signed-in user stays signed in
 * but must pass fingerprint/face on app open and after RELOCK_AFTER_MS in the background.
 */
export default function BiometricAppLock() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? "";
  const [locked, setLocked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [invalidated, setInvalidated] = useState(false);
  const autoPromptedRef = useRef(false);
  const backgroundedAtRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (isCapacitorNative() && getLocalEnrollment() && !unlockedThisSession()) setLocked(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      markUnlocked();
      setLocked(false);
      return;
    }
    if (status === "authenticated" && locked && getLocalEnrollment()?.userId !== userId) {
      markUnlocked();
      setLocked(false);
    }
  }, [status, userId, locked]);

  const unlock = useCallback(async () => {
    setError("");
    setVerifying(true);
    try {
      await verifyBiometricUnlock();
      markUnlocked();
      setLocked(false);
    } catch (e) {
      if (e instanceof BiometricInvalidatedError) {
        setInvalidated(true);
        setError("Your fingerprint or face settings changed on this phone. Sign in with your password, then turn biometric sign-in back on in Account.");
      } else if (!(e instanceof BiometricCancelledError)) {
        setError(e instanceof Error ? e.message : "Not recognized. Try again or use your password.");
      }
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    if (!locked) {
      autoPromptedRef.current = false;
      return;
    }
    if (status !== "authenticated" || autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    void unlock();
  }, [locked, status, unlock]);

  useEffect(() => {
    if (!isCapacitorNative()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          backgroundedAtRef.current = Date.now();
          return;
        }
        const since = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (since == null || Date.now() - since < RELOCK_AFTER_MS) return;
        if (!getLocalEnrollment()) return;
        try {
          sessionStorage.removeItem(UNLOCKED_KEY);
        } catch {
          /* storage unavailable */
        }
        setError("");
        setLocked(true);
      });
      if (cancelled) void listener.remove();
      else remove = () => void listener.remove();
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);

  if (!locked) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] flex flex-col items-center justify-center gap-6 bg-[#05080f] px-6 text-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label="NovaStaris is locked"
    >
      <p className="font-[family-name:var(--font-space-grotesk)] text-2xl tracking-tight text-white">NovaStaris</p>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/30">
        <Fingerprint className="h-8 w-8 text-cyan-400" aria-hidden />
      </div>
      <p className="max-w-xs text-sm text-zinc-400">
        {session?.user?.email ? `Signed in as ${session.user.email}. ` : ""}Unlock with your fingerprint or face to continue.
      </p>
      {error && <p className="max-w-xs text-sm text-rose-400">{error}</p>}
      <div className="flex w-full max-w-xs flex-col gap-3">
        {!invalidated && (
          <Button type="button" className="w-full" disabled={verifying || status !== "authenticated"} onClick={() => void unlock()}>
            <Fingerprint className="h-4 w-4 mr-2" />
            {verifying ? "Waiting for biometrics…" : "Unlock"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          className="w-full text-zinc-300 hover:text-white"
          disabled={verifying}
          onClick={() => void signOut({ callbackUrl: "/signin" })}
        >
          Use password instead
        </Button>
      </div>
    </div>
  );
}
