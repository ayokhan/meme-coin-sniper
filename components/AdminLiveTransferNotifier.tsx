"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/** Poll only when live support is enabled; slower to cut Fluid Active CPU. */
const POLL_MS = 45_000;
const BANNER_MS = 22_000;

type TransferRow = { sessionId: string; customerName: string | null; liveTransferAt: string };

export default function AdminLiveTransferNotifier() {
  const { data: session, status } = useSession();
  const isOwner = !!session?.user?.isOwner;
  const lastAfterRef = useRef<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [banners, setBanners] = useState<Array<{ key: string; name: string; sessionId: string }>>([]);

  const dismiss = useCallback((key: string) => {
    setBanners((prev) => prev.filter((b) => b.key !== key));
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !isOwner) return;
    let cancelled = false;
    fetch("/api/feature-flags-public")
      .then((r) => r.json())
      .then((d: { liveSupportChatEnabled?: boolean }) => {
        if (!cancelled) setEnabled(!!d.liveSupportChatEnabled);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, isOwner]);

  useEffect(() => {
    if (status !== "authenticated" || !isOwner || !enabled) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    void Notification.requestPermission();
  }, [status, isOwner, enabled]);

  useEffect(() => {
    if (status !== "authenticated" || !isOwner || !enabled) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (lastAfterRef.current === null) {
        lastAfterRef.current = new Date().toISOString();
        return;
      }

      try {
        const after = lastAfterRef.current;
        const res = await fetch(`/api/admin/chat/live-transfers?after=${encodeURIComponent(after)}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          success?: boolean;
          disabled?: boolean;
          transfers?: TransferRow[];
        };
        if (data.disabled) {
          setEnabled(false);
          return;
        }
        if (!data.success || !Array.isArray(data.transfers) || cancelled) return;

        let maxAfter = after;
        for (const t of data.transfers) {
          const name = t.customerName?.trim() || "Customer";
          const key = `${t.sessionId}-${t.liveTransferAt}`;

          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification("NovaStaris — Live chat", {
                body: `${name} was transferred to a live agent.`,
                tag: `live-transfer-${t.sessionId}`,
              });
            } catch {
              /* ignore */
            }
          }

          setBanners((prev) => {
            if (prev.some((b) => b.key === key)) return prev;
            return [...prev, { key, name, sessionId: t.sessionId }];
          });

          if (t.liveTransferAt > maxAfter) maxAfter = t.liveTransferAt;
        }

        if (data.transfers.length > 0) lastAfterRef.current = maxAfter;
      } catch {
        /* ignore transient network errors */
      }
    };

    const id = setInterval(() => void poll(), POLL_MS);
    void poll();

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [status, isOwner, enabled]);

  useEffect(() => {
    const timers = banners.map((b) => setTimeout(() => dismiss(b.key), BANNER_MS));
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [banners, dismiss]);

  if (!isOwner || !enabled || banners.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[260] flex max-w-[min(100vw-2rem,22rem)] flex-col gap-2 pointer-events-none sm:top-20">
      {banners.map((b) => (
        <div
          key={b.key}
          className="pointer-events-auto relative rounded-xl border border-cyan-400/40 bg-zinc-900/95 text-zinc-100 shadow-lg shadow-cyan-900/30 backdrop-blur-md px-4 py-3 pr-10 text-sm"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            onClick={() => dismiss(b.key)}
            className="absolute top-2.5 right-2.5 rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="font-semibold text-cyan-200">Live chat</p>
          <p className="mt-1 text-zinc-200">
            <span className="font-medium">{b.name}</span> was routed to you.
          </p>
          <Link
            href="/admin/chat"
            className="mt-2 inline-flex text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
          >
            Open support inbox
          </Link>
        </div>
      ))}
    </div>
  );
}
