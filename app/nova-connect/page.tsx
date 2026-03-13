"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Standalone URL for NovaConnect: redirects to the main dashboard with NovaConnect tab active.
 * e.g. novastaris.ai/nova-connect → novastaris.ai/?tab=nova-connect
 */
export default function NovaConnectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?tab=nova-connect");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <p className="text-sm text-muted-foreground">Redirecting to NovaConnect…</p>
    </div>
  );
}
