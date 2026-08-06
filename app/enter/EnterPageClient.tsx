"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EnterDesksClient from "@/components/EnterDesksClient";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05080f]">
      <p className="font-[family-name:var(--font-space-grotesk)] text-lg tracking-tight text-white">
        NovaStaris
      </p>
    </div>
  );
}

/** Gate `/enter` on the enter_landing_enabled feature flag. */
export default function EnterPageClient() {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feature-flags-public", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const on = data?.enterLandingEnabled !== false;
        if (!on) {
          router.replace("/");
          setEnabled(false);
          return;
        }
        setEnabled(true);
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (enabled === null) return <Splash />;
  if (!enabled) return <Splash />;
  return <EnterDesksClient />;
}
