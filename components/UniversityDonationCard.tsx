"use client";

import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRESETS = [5, 10, 20, 1000] as const;

type Props = {
  /** Compact card for graduate home; full card for pass result. */
  variant?: "full" | "compact";
  className?: string;
};

export default function UniversityDonationCard({ variant = "full", className = "" }: Props) {
  const [amount, setAmount] = useState<number>(10);
  const [custom, setCustom] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingCustom, setUsingCustom] = useState(false);

  const effectiveAmount = usingCustom ? Number(custom) : amount;

  const startDonate = async () => {
    setError(null);
    const usd = Math.round(Number(effectiveAmount) * 100) / 100;
    if (!Number.isFinite(usd) || usd < 1) {
      setError("Please enter a valid amount of at least $1.");
      return;
    }
    setBusy(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://novastaris.ai";
      const res = await fetch("/api/stripe/create-donation-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd: usd,
          monthly,
          custom: usingCustom,
          successUrl: `${origin}/?tab=trading-university&donation=success`,
          cancelUrl: `${origin}/?tab=trading-university&donation=canceled`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        setError(data.error || "Could not start card checkout.");
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Network error starting checkout.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={`rounded-xl border border-cyan-500/25 bg-cyan-500/5 text-left p-4 sm:p-5 space-y-3 ${className}`}
    >
      <div className="flex items-start gap-2">
        <Heart className="h-5 w-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Support free Trading University
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            NovaStaris is committed to keeping Trading University free so anyone can learn markets,
            risk, and responsible trading. If this course helped you, a voluntary donation helps us
            maintain and expand free education for others. Your certificate is yours either way —
            donations are optional and processed securely by card via Stripe.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={!usingCustom && amount === n ? "default" : "outline"}
            disabled={busy}
            onClick={() => {
              setUsingCustom(false);
              setAmount(n);
              setCustom("");
            }}
          >
            ${n.toLocaleString()}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={usingCustom ? "default" : "outline"}
          disabled={busy}
          onClick={() => setUsingCustom(true)}
        >
          Custom
        </Button>
      </div>

      {usingCustom && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">$</span>
          <input
            type="number"
            min={1}
            max={10000}
            step={1}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Amount in USD"
            className="w-40 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm"
          />
        </div>
      )}

      <label className="flex items-start gap-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={monthly}
          disabled={busy}
          onChange={(e) => setMonthly(e.target.checked)}
        />
        <span>
          Make this a <strong>monthly</strong> donation (automatic card billing each month). You can
          cancel anytime through Stripe’s billing portal or by contacting support.
        </span>
      </label>

      {error && (
        <p className="text-xs text-amber-700 dark:text-amber-300 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" disabled={busy} onClick={() => void startDonate()} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
          {busy
            ? "Redirecting…"
            : monthly
              ? `Donate $${Number.isFinite(effectiveAmount) ? effectiveAmount : "—"}/mo by card`
              : `Donate $${Number.isFinite(effectiveAmount) ? effectiveAmount : "—"} by card`}
        </Button>
        {variant === "full" && (
          <p className="text-[11px] text-muted-foreground">Credit / debit card only · Not a VIP purchase</p>
        )}
      </div>
    </section>
  );
}
