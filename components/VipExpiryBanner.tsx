"use client";

import Link from "next/link";

type Props = {
  expiresAt: string;
  daysRemaining: number;
  autoRenew?: boolean;
  cancelAtPeriodEnd?: boolean;
  /** When true, omits the Renew VIP link (e.g. user is already on /subscribe). */
  hideRenewLink?: boolean;
  onDismiss: () => void;
};

export default function VipExpiryBanner({
  expiresAt,
  daysRemaining,
  autoRenew,
  cancelAtPeriodEnd,
  hideRenewLink,
  onDismiss,
}: Props) {
  const expiryLabel = new Date(expiresAt).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const urgent = daysRemaining <= 3;

  if (autoRenew && !cancelAtPeriodEnd) {
    return null;
  }

  return (
    <div
      className={`mb-6 relative overflow-hidden rounded-xl border px-4 py-3.5 text-sm flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm ${
        urgent
          ? "border-cyan-400/50 dark:border-cyan-500/40 bg-gradient-to-r from-slate-50 via-cyan-50/80 to-indigo-50/60 dark:from-slate-900/95 dark:via-cyan-950/50 dark:to-indigo-950/40 ring-1 ring-cyan-500/20 dark:ring-cyan-400/15"
          : "border-slate-200/90 dark:border-slate-700/80 bg-gradient-to-r from-slate-50 to-cyan-50/50 dark:from-slate-900/90 dark:to-cyan-950/30"
      }`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${urgent ? "bg-gradient-to-b from-cyan-400 to-indigo-500" : "bg-gradient-to-b from-cyan-500 to-slate-400"}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0 pl-2">
        <p className={`font-semibold tracking-tight ${urgent ? "text-slate-900 dark:text-slate-50" : "text-slate-800 dark:text-slate-100"}`}>
          {cancelAtPeriodEnd
            ? "Auto-renewal turned off — VIP ends soon"
            : daysRemaining === 0
              ? "Your VIP subscription ends today"
              : daysRemaining === 1
                ? "Your VIP subscription ends tomorrow"
                : `Your VIP subscription ends in ${daysRemaining} days`}
        </p>
        <p className={`mt-1 leading-relaxed ${urgent ? "text-slate-600 dark:text-slate-300" : "text-slate-600 dark:text-slate-400"}`}>
          {cancelAtPeriodEnd ? (
            <>
              Access remains active until <strong className="text-slate-800 dark:text-slate-200">{expiryLabel}</strong>. Renew before then to keep unlimited AI Agent,
              monitoring, and VIP features without interruption.
            </>
          ) : (
            <>
              Your NovaStaris VIP access is scheduled to end on <strong className="text-slate-800 dark:text-slate-200">{expiryLabel}</strong>.
              {hideRenewLink
                ? " Choose a plan below to renew and keep unlimited Meme Coins Agent, Chart Analysis, monitoring, and full platform access."
                : " Renew now to continue unlimited Meme Coins Agent, Chart Analysis, monitoring, and full platform access."}
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0 pl-2">
        {!hideRenewLink && (
          <Link
            href="/subscribe"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white shadow-md bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 dark:from-cyan-500 dark:to-indigo-600 dark:hover:from-cyan-400 dark:hover:to-indigo-500 transition-colors"
          >
            Renew VIP
          </Link>
        )}
        <button type="button" onClick={onDismiss} className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1">
          Remind me later
        </button>
      </div>
    </div>
  );
}
