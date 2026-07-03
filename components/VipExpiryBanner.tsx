"use client";

import Link from "next/link";

type Props = {
  expiresAt: string;
  daysRemaining: number;
  autoRenew?: boolean;
  cancelAtPeriodEnd?: boolean;
  onDismiss: () => void;
};

export default function VipExpiryBanner({
  expiresAt,
  daysRemaining,
  autoRenew,
  cancelAtPeriodEnd,
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
      className={`mb-6 rounded-xl border px-4 py-3.5 text-sm flex flex-col sm:flex-row sm:items-center gap-3 ${
        urgent
          ? "border-amber-400/80 dark:border-amber-600 bg-amber-50/95 dark:bg-amber-950/50"
          : "border-violet-300/80 dark:border-violet-700 bg-violet-50/90 dark:bg-violet-950/40"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${urgent ? "text-amber-900 dark:text-amber-100" : "text-violet-900 dark:text-violet-100"}`}>
          {cancelAtPeriodEnd
            ? "Auto-renewal turned off — VIP ends soon"
            : daysRemaining === 0
              ? "Your VIP subscription ends today"
              : daysRemaining === 1
                ? "Your VIP subscription ends tomorrow"
                : `Your VIP subscription ends in ${daysRemaining} days`}
        </p>
        <p className={`mt-1 leading-relaxed ${urgent ? "text-amber-800/90 dark:text-amber-200/90" : "text-violet-800/90 dark:text-violet-200/90"}`}>
          {cancelAtPeriodEnd ? (
            <>
              Access remains active until <strong>{expiryLabel}</strong>. Renew before then to keep unlimited AI Agent,
              monitoring, and VIP features without interruption.
            </>
          ) : (
            <>
              Your NovaStaris VIP access is scheduled to end on <strong>{expiryLabel}</strong>. Renew now to continue
              unlimited Meme Coins Agent, Chart Analysis, monitoring, and full platform access.
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Link
          href="/subscribe"
          className={`inline-flex items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium text-white shadow-sm ${
            urgent ? "bg-amber-600 hover:bg-amber-700" : "bg-violet-600 hover:bg-violet-700"
          }`}
        >
          Renew VIP
        </Link>
        <button type="button" onClick={onDismiss} className="text-xs text-muted-foreground hover:underline px-2 py-1">
          Remind me later
        </button>
      </div>
    </div>
  );
}
