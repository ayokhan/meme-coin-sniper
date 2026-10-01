"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BIOMETRIC_PROMPT_DISMISSED_KEY,
  BiometricCancelledError,
  enableBiometricSignIn,
  getBiometricAvailability,
  getLocalEnrollment,
} from "@/lib/biometric-client";

function dismissedFor(userId: string): boolean {
  try {
    const raw = localStorage.getItem(BIOMETRIC_PROMPT_DISMISSED_KEY);
    return !!raw && (JSON.parse(raw) as string[]).includes(userId);
  } catch {
    return false;
  }
}

function markDismissed(userId: string) {
  try {
    const raw = localStorage.getItem(BIOMETRIC_PROMPT_DISMISSED_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    if (!ids.includes(userId)) ids.push(userId);
    localStorage.setItem(BIOMETRIC_PROMPT_DISMISSED_KEY, JSON.stringify(ids.slice(-10)));
  } catch {
    /* ignore */
  }
}

/** Android app: one-time offer to turn on fingerprint sign-in after the user signs in. */
export default function BiometricEnrollPrompt() {
  const { status, data: session } = useSession();
  const pathname = usePathname();
  const userId = session?.user?.id ?? "";
  const label = session?.user?.email ?? session?.user?.name ?? "";
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const skip = pathname?.startsWith("/signin") || pathname?.startsWith("/register") || pathname?.startsWith("/account");

  useEffect(() => {
    if (status !== "authenticated" || !userId || skip) return;
    if (getLocalEnrollment()?.userId === userId || dismissedFor(userId)) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      const availability = await getBiometricAvailability();
      if (!cancelled && availability.status === "available") setVisible(true);
    }, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [status, userId, skip]);

  if (!visible) return null;

  const close = () => {
    markDismissed(userId);
    setVisible(false);
  };

  const enable = async () => {
    setError("");
    setBusy(true);
    try {
      await enableBiometricSignIn({ id: userId, label });
      markDismissed(userId);
      setDone(true);
      window.setTimeout(() => setVisible(false), 2500);
    } catch (e) {
      if (!(e instanceof BiometricCancelledError)) {
        setError(e instanceof Error ? e.message : "Could not enable fingerprint sign-in.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md rounded-xl border border-cyan-500/40 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-sm">
        {done ? (
          <p className="text-sm font-semibold text-emerald-300 text-center">Fingerprint sign-in is on.</p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <Fingerprint className="h-8 w-8 shrink-0 text-cyan-400" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">Sign in faster with your fingerprint?</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Skip typing your password next time. You can remove it anytime in Account.
                </p>
              </div>
            </div>
            {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="ghost" className="flex-1 text-zinc-300" disabled={busy} onClick={close}>
                Not now
              </Button>
              <Button type="button" className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white" disabled={busy} onClick={() => void enable()}>
                {busy ? "Waiting…" : "Enable"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
