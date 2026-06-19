"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CAPACITOR_APP_SCHEME } from "@/lib/capacitor-native";

function CapacitorReturnInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [status, setStatus] = useState("Completing sign in…");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/capacitor-handoff", { credentials: "include" });
        const data = (await res.json()) as { success?: boolean; token?: string; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.success || !data.token) {
          setError(data.error ?? "Sign-in could not be completed. Close this window and try again in the app.");
          setStatus("");
          return;
        }
        const deepLink = `${CAPACITOR_APP_SCHEME}://auth/callback?token=${encodeURIComponent(data.token)}&next=${encodeURIComponent(next)}`;
        window.location.href = deepLink;
        setStatus("Returning to NovaStaris…");
      } catch {
        if (!cancelled) {
          setError("Something went wrong. Close this window and try again in the app.");
          setStatus("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [next]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4">
      <div className="text-center space-y-2 max-w-sm">
        {status && <p className="text-lg font-medium">{status}</p>}
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    </div>
  );
}

export default function CapacitorReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-100 px-4">
          <p className="text-lg font-medium">Completing sign in…</p>
        </div>
      }
    >
      <CapacitorReturnInner />
    </Suspense>
  );
}
