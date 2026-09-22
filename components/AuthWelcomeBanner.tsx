"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CAPACITOR_JUST_SIGNED_IN_KEY } from "@/components/CapacitorAuthBridge";

/** Brief on-screen confirmation after Capacitor Google (or email) sign-in completes. */
export default function AuthWelcomeBanner() {
  const { status, data: session } = useSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    try {
      if (sessionStorage.getItem(CAPACITOR_JUST_SIGNED_IN_KEY) !== "1") return;
      sessionStorage.removeItem(CAPACITOR_JUST_SIGNED_IN_KEY);
    } catch {
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(t);
  }, [status]);

  if (!visible) return null;

  const name = session?.user?.name?.split(" ")[0] || session?.user?.email?.split("@")[0] || "there";

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pointer-events-none"
    >
      <div className="pointer-events-auto max-w-md rounded-lg border border-emerald-500/40 bg-emerald-950/95 px-4 py-3 text-center shadow-lg backdrop-blur-sm">
        <p className="text-sm font-semibold text-emerald-100">You&apos;re signed in, {name}</p>
        <p className="mt-0.5 text-xs text-emerald-200/80">Welcome to NovaStaris — no need to sign in again.</p>
      </div>
    </div>
  );
}
