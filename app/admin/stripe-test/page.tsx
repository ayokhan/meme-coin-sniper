"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { CreditCard } from "lucide-react";
import {
  STRIPE_BILLING_TEST_MAX_USD,
  STRIPE_BILLING_TEST_MIN_USD,
} from "@/lib/stripe-billing-test";

function StripeTestContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;

  const [amountUsd, setAmountUsd] = useState("1.00");
  const [trialMinutes, setTrialMinutes] = useState("5");
  const [confirmLiveCharge, setConfirmLiveCharge] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const stripeTestResult = searchParams.get("stripeTest");
  const successAmount = searchParams.get("amount");

  useEffect(() => {
    if (stripeTestResult === "receipt_success") {
      setMessage(
        successAmount
          ? `Receipt test checkout completed ($${successAmount}). Check your email and Stripe → Transactions → Receipt history.`
          : "Receipt test checkout completed. Check your email and Stripe → Transactions → Receipt history."
      );
    } else if (stripeTestResult === "receipt_canceled") {
      setError("Receipt test checkout was canceled.");
    }
  }, [stripeTestResult, successAmount]);

  const runTest = async (action: "receipt_checkout" | "trial_subscription") => {
    setLoading(action);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/stripe-billing-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          amountUsd,
          trialMinutes,
          confirmLiveCharge,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Billing test failed.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage(data.message ?? "Billing test started.");
    } catch {
      setError("Billing test failed.");
    } finally {
      setLoading(null);
    }
  };

  if (status === "loading") {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">Sign in to run Stripe billing tests.</p>
          <Button asChild>
            <Link href={`/signin?callbackUrl=${encodeURIComponent("/admin/stripe-test")}`}>Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-8 text-center text-muted-foreground">
          Owner only.
          <p className="mt-2">
            <Link href="/admin" className="text-cyan-600 dark:text-cyan-400 hover:underline">
              Back to admin
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl">
      <AdminPageHeader
        title="Stripe billing tests"
        description="Owner-only. Test receipt emails and short trial subscriptions with a custom charge amount."
      />

      <Card className="border-cyan-200 dark:border-cyan-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-cyan-500" />
            Test settings
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Stripe minimum charge is <strong>${STRIPE_BILLING_TEST_MIN_USD.toFixed(2)} USD</strong> (amounts like $0.11 are rejected by Stripe). Max ${STRIPE_BILLING_TEST_MAX_USD}.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-2">
              {message}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Test amount (USD)</span>
              <input
                type="number"
                min={STRIPE_BILLING_TEST_MIN_USD}
                max={STRIPE_BILLING_TEST_MAX_USD}
                step="0.01"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                placeholder="1.00"
              />
              <span className="text-xs text-muted-foreground">Used for receipt checkout and post-trial subscription charge.</span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Trial length (minutes)</span>
              <input
                type="number"
                min={1}
                max={1440}
                step={1}
                value={trialMinutes}
                onChange={(e) => setTrialMinutes(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                placeholder="5"
              />
              <span className="text-xs text-muted-foreground">For the trial subscription test only.</span>
            </label>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
            <input
              type="checkbox"
              checked={confirmLiveCharge}
              onChange={(e) => setConfirmLiveCharge(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-cyan-600"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              I understand live Stripe tests charge real money for the amount entered above.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!confirmLiveCharge || loading !== null}
              onClick={() => runTest("receipt_checkout")}
            >
              {loading === "receipt_checkout" ? "Opening checkout…" : `Test receipt email ($${amountUsd || "?"})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!confirmLiveCharge || loading !== null}
              onClick={() => runTest("trial_subscription")}
            >
              {loading === "trial_subscription" ? "Creating…" : `Test trial subscription (${trialMinutes} min)`}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-2 border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <p>
              <strong>Receipt test:</strong> One-time Checkout — confirms Successful payments email and invoice PDF.
            </p>
            <p>
              <strong>Trial test:</strong> Creates a Stripe subscription with your trial length, then charges your amount once per day (auto-cancels after first paid period).
            </p>
            <p>
              Ensure{" "}
              <a
                href="https://dashboard.stripe.com/settings/emails"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Customer emails → Successful payments
              </a>{" "}
              is ON in Stripe.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminStripeTestPage() {
  return (
    <Suspense
      fallback={
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      }
    >
      <StripeTestContent />
    </Suspense>
  );
}
