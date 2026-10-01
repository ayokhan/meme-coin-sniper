"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CAPACITOR_JUST_SIGNED_IN_KEY } from "@/components/CapacitorAuthBridge";
import {
  BiometricCancelledError,
  getBiometricAvailability,
  getLocalEnrollment,
  signInWithBiometric,
} from "@/lib/biometric-client";

const AUTO_PROMPTED_KEY = "novastaris_biometric_auto_prompted";

/** Shown on /signin in the Android app when biometric sign-in is enabled on this device. */
export default function BiometricSignInButton({
  callbackUrl,
  onError,
}: {
  callbackUrl: string;
  onError: (message: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    onError("");
    try {
      await signInWithBiometric();
      try {
        sessionStorage.setItem(CAPACITOR_JUST_SIGNED_IN_KEY, "1");
      } catch {
        /* ignore */
      }
      window.location.assign(callbackUrl.startsWith("/") ? callbackUrl : "/");
      return;
    } catch (e) {
      if (!(e instanceof BiometricCancelledError)) {
        onError(e instanceof Error ? e.message : "Biometric sign-in failed.");
      }
      if (!getLocalEnrollment()) setReady(false);
    }
    busyRef.current = false;
    setBusy(false);
  }, [callbackUrl, onError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = getLocalEnrollment();
      if (!local) return;
      const availability = await getBiometricAvailability();
      if (cancelled || availability.status !== "available") return;
      setLabel(local.label);
      setReady(true);
      try {
        if (sessionStorage.getItem(AUTO_PROMPTED_KEY) === "1") return;
        sessionStorage.setItem(AUTO_PROMPTED_KEY, "1");
      } catch {
        return;
      }
      void run();
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  if (!ready) return null;

  return (
    <div className="space-y-1">
      <Button
        type="button"
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white"
        disabled={busy}
        onClick={() => void run()}
      >
        <Fingerprint className="h-5 w-5 mr-2" />
        {busy ? "Waiting for biometrics…" : "Sign in with biometrics"}
      </Button>
      {label && <p className="text-xs text-center text-muted-foreground">as {label}</p>}
    </div>
  );
}
