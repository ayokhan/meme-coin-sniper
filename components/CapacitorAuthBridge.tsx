"use client";

import { useEffect, useRef } from "react";
import { CAPACITOR_APP_SCHEME, isCapacitorNative } from "@/lib/capacitor-native";

export const CAPACITOR_JUST_SIGNED_IN_KEY = "novastaris_just_signed_in";

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
  const handling = useRef(false);

  useEffect(() => {
    if (!isCapacitorNative()) return;

    let removeListener: (() => void) | undefined;

    (async () => {
      const { App } = await import("@capacitor/app");
      const { Browser } = await import("@capacitor/browser");

      const completeAuth = async (url: string) => {
        if (handling.current) return;
        const { token, next } = parseAuthCallbackUrl(url);
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
            try {
              sessionStorage.setItem(CAPACITOR_JUST_SIGNED_IN_KEY, "1");
            } catch {
              /* ignore */
            }
            // Full reload so SessionProvider mounts with the new cookie (soft navigate left guest UI).
            const dest = next && next.startsWith("/") ? next : "/";
            window.location.assign(dest);
            return;
          }
        } finally {
          handling.current = false;
        }
      };

      try {
        const launch = await App.getLaunchUrl();
        if (launch?.url) {
          await completeAuth(launch.url);
        }
      } catch {
        /* no launch URL */
      }

      const listener = await App.addListener("appUrlOpen", async (event) => {
        await completeAuth(event.url);
      });

      removeListener = () => {
        void listener.remove();
      };
    })();

    return () => {
      removeListener?.();
    };
  }, []);

  return null;
}
