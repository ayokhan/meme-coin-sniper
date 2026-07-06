"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TwoFactorSecurityNudgeBannerConfig } from "@/lib/two-factor-security-nudge-banner";
import { DEFAULT_TWO_FACTOR_SECURITY_NUDGE } from "@/lib/two-factor-security-nudge-banner";

export const TWO_FACTOR_NUDGE_DISMISS_KEY = "novastaris_2fa_nudge_dismissed";
export const TWO_FACTOR_NUDGE_LATER_KEY = "novastaris_2fa_nudge_later";

export function readTwoFactorNudgeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TWO_FACTOR_NUDGE_DISMISS_KEY) === "1";
}

export function dismissTwoFactorNudgePermanent(): void {
  try {
    localStorage.setItem(TWO_FACTOR_NUDGE_DISMISS_KEY, "1");
    sessionStorage.removeItem(TWO_FACTOR_NUDGE_LATER_KEY);
  } catch {
    /* ignore */
  }
}

export function dismissTwoFactorNudgeLater(): void {
  try {
    sessionStorage.setItem(TWO_FACTOR_NUDGE_LATER_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function readTwoFactorNudgeLater(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(TWO_FACTOR_NUDGE_LATER_KEY) === "1";
}

type ModalProps = {
  open: boolean;
  config?: Pick<TwoFactorSecurityNudgeBannerConfig, "title" | "body" | "ctaLabel"> | null;
  onRemindLater: () => void;
  onDismissPermanent: () => void;
};

export function TwoFactorSecurityNudgeModal({ open, config, onRemindLater, onDismissPermanent }: ModalProps) {
  const cfg = config ?? DEFAULT_TWO_FACTOR_SECURITY_NUDGE;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onRemindLater();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onRemindLater]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="two-factor-nudge-title"
      onClick={onRemindLater}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50 bg-white dark:bg-zinc-900 shadow-2xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onRemindLater}
          className="absolute top-3 right-3 rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <div className="mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-3">
            <Shield className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <h2 id="two-factor-nudge-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100 pr-8">
            {cfg.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{cfg.body}</p>
          <ul className="mt-3 w-full text-left text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 shrink-0">•</span>
              <span>
                <strong className="text-zinc-800 dark:text-zinc-200">Google Authenticator</strong> — scan a QR code
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 shrink-0">•</span>
              <span>
                <strong className="text-zinc-800 dark:text-zinc-200">Email code</strong> — receive a code at sign-in
              </span>
            </li>
          </ul>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            <Link href="/account#two-factor" onClick={onRemindLater}>
              {cfg.ctaLabel}
            </Link>
          </Button>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onRemindLater}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 underline-offset-2 hover:underline"
            >
              Remind me later
            </button>
            <button
              type="button"
              onClick={onDismissPermanent}
              className="text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Don&apos;t show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type HostProps = {
  /** Wait until another modal (e.g. dashboard path picker) closes first. */
  blocked?: boolean;
};

/** Fetches eligibility and shows the 2FA security modal after sign-in. */
export function TwoFactorSecurityNudgeHost({ blocked = false }: HostProps) {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Pick<TwoFactorSecurityNudgeBannerConfig, "title" | "body" | "ctaLabel"> | null>(
    null
  );

  const closeLater = useCallback(() => {
    dismissTwoFactorNudgeLater();
    setOpen(false);
  }, []);

  const closePermanent = useCallback(() => {
    dismissTwoFactorNudgePermanent();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || blocked) return;
    if (readTwoFactorNudgeDismissed() || readTwoFactorNudgeLater()) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch("/api/account/two-factor-nudge")
        .then((r) => r.json())
        .then((data: { success?: boolean; show?: boolean; banner?: { title: string; body: string; ctaLabel: string } }) => {
          if (cancelled || !data.success || !data.show) return;
          if (readTwoFactorNudgeDismissed() || readTwoFactorNudgeLater()) return;
          if (data.banner) setConfig(data.banner);
          setOpen(true);
        })
        .catch(() => {});
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status, blocked]);

  return (
    <TwoFactorSecurityNudgeModal
      open={open}
      config={config}
      onRemindLater={closeLater}
      onDismissPermanent={closePermanent}
    />
  );
}
