"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BiometricCancelledError,
  type BiometricAvailability,
  disableBiometricSignIn,
  enableBiometricSignIn,
  getBiometricAvailability,
  getLocalEnrollment,
} from "@/lib/biometric-client";

/** Android app only: turn fingerprint sign-in on or off for this device. */
export default function BiometricSettings() {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? "";
  const label = session?.user?.email ?? session?.user?.name ?? "";

  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [enabledHere, setEnabledHere] = useState(false);
  const [otherAccountLinked, setOtherAccountLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    setAvailability(await getBiometricAvailability());
    const local = getLocalEnrollment();
    setEnabledHere(!!local && local.userId === userId);
    setOtherAccountLinked(!!local && local.userId !== userId);
  }, [userId]);

  useEffect(() => {
    if (userId) void refresh();
  }, [userId, refresh]);

  if (!availability || availability.status === "unsupported" || availability.status === "update-required" || !userId) {
    return null;
  }

  const enable = async () => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await enableBiometricSignIn({ id: userId, label });
      setSuccess("Fingerprint sign-in is on. Next time, tap \"Sign in with fingerprint\".");
      await refresh();
    } catch (e) {
      if (!(e instanceof BiometricCancelledError)) {
        setError(e instanceof Error ? e.message : "Could not enable fingerprint sign-in.");
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      await disableBiometricSignIn();
      setSuccess("Fingerprint sign-in removed from this device.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Fingerprint className="h-5 w-5 text-cyan-500" />
          Fingerprint sign-in
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to the NovaStaris Android app with your fingerprint instead of typing your password.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">{error}</div>
        )}
        {success && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-2">{success}</div>
        )}

        {availability.status === "not-enrolled-on-device" && !enabledHere && (
          <p className="text-sm text-muted-foreground">
            No fingerprint is set up on this phone. Add one in your phone&apos;s Settings → Security, then come back here.
          </p>
        )}

        {enabledHere && (
          <>
            <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">On for this device</p>
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={busy} onClick={() => void remove()}>
              {busy ? "Removing…" : "Remove fingerprint sign-in"}
            </Button>
          </>
        )}

        {availability.status === "available" && !enabledHere && (
          <>
            {otherAccountLinked && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Fingerprint sign-in on this phone is linked to another NovaStaris account. Turning it on here will replace it.
              </p>
            )}
            <Button type="button" className="w-full sm:w-auto" disabled={busy} onClick={() => void enable()}>
              <Fingerprint className="h-4 w-4 mr-2" />
              {busy ? "Waiting for fingerprint…" : "Enable fingerprint sign-in"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
