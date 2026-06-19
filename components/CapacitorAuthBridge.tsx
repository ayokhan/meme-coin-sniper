"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CAPACITOR_APP_SCHEME, isCapacitorNative } from "@/lib/capacitor-native";

function parseAuthCallbackUrl(url: string): { token?: string; next?: string } {
  const prefix = `${CAPACITOR_APP_SCHEME}://auth/callback`;
  if (!url.startsWith(prefix)) return {};
  const query = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  return {
    token: params.get("token") ?? undefined,
    next: params.get("next") ?? undefined,
  };
}

export default function CapacitorAuthBridge() {
  const router = useRouter();
  const handling = useRef(false);

  useEffect(() => {
    if (!isCapacitorNative()) return;

    let removeListener: (() => void) | undefined;

    (async () => {
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");

      const listener = await App.addListener("appUrlOpen", async (event) => {
        if (handling.current) return;
        const { token, next } = parseAuthCallbackUrl(event.url);
        if (!token) return;

        handling.current = true;
        try {
          try {
            await Browser.close();
          } catch {
            /* browser may already be closed */
          }

          const res = await fetch("/api/auth/capacitor-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token }),
          });
          const data = (await res.json()) as { success?: boolean };
          if (data.success) {
            const dest = next && next.startsWith("/") ? next : "/";
            router.push(dest);
            router.refresh();
          }
        } finally {
          handling.current = false;
        }
      });

      removeListener = () => {
        void listener.remove();
      };
    })();

    return () => {
      removeListener?.();
    };
  }, [router]);

  return null;
}
