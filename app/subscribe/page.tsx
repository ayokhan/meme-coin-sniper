"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, CreditCard } from "lucide-react";
import { CARD_PAYMENT_FEE_USD, getCardPriceUsd } from "@/lib/subscription";
import VipExpiryBanner from "@/components/VipExpiryBanner";

type Plan = { id: string; label: string; months: number; priceUsd: number };

function expiryDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function SubscribeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = (searchParams.get("copy") ?? "a").toLowerCase();
  const isVariantB = copy === "b";
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<"vip" | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [cardSuccessPending, setCardSuccessPending] = useState(false);
  const [vipPlans, setVipPlans] = useState<Plan[]>([]);
  const [paymentWallet, setPaymentWallet] = useState("");
  const [usdcMint, setUsdcMint] = useState("");
  const [paymentTermsAcceptedAt, setPaymentTermsAcceptedAt] = useState<string | null>(null);
  const [termsCheckbox, setTermsCheckbox] = useState(false);
  const [termsAccepting, setTermsAccepting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("1month");
  const [txSignature, setTxSignature] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [cardPaymentFeeUsd, setCardPaymentFeeUsd] = useState(CARD_PAYMENT_FEE_USD);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState("");
  const [autoRenew, setAutoRenew] = useState(false);
  const [subscriptionAutoRenew, setSubscriptionAutoRenew] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [billingActionLoading, setBillingActionLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [vipExpiryBannerDismissed, setVipExpiryBannerDismissed] = useState(true);
  const [payByCardEnabled, setPayByCardEnabled] = useState(true);
  const [payByUsdcEnabled, setPayByUsdcEnabled] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/subscription");
        const data = await res.json();
        if (data.success) {
          setPaid(!!data.paid);
          setSubscriptionTier(data.subscriptionTier ?? null);
          setExpiresAt(data.expiresAt ?? null);
          setVipPlans(Array.isArray(data.vipPlans) ? data.vipPlans : []);
          setCardPaymentFeeUsd(
            typeof data.cardPaymentFeeUsd === "number" ? data.cardPaymentFeeUsd : CARD_PAYMENT_FEE_USD
          );
          setPaymentWallet(data.paymentWallet ?? "");
          setUsdcMint(data.usdcMint ?? "");
          setPaymentTermsAcceptedAt(data.paymentTermsAcceptedAt ?? null);
          setSubscriptionAutoRenew(!!data.autoRenew);
          setCancelAtPeriodEnd(!!data.cancelAtPeriodEnd);
          setHasStripeSubscription(!!data.hasStripeSubscription);
          setHasStripeCustomer(!!data.hasStripeCustomer);
          setPayByCardEnabled(data.payByCardEnabled !== false);
          setPayByUsdcEnabled(data.payByUsdcEnabled !== false);
          if (data.paymentTermsAcceptedAt) setTermsCheckbox(true);
          const exp = typeof data.expiresAt === "string" ? data.expiresAt : null;
          if (exp && typeof window !== "undefined") {
            try {
              const dismissedFor = sessionStorage.getItem(`novastaris-vip-expiry-dismiss:${exp}`);
              setVipExpiryBannerDismissed(dismissedFor === "1");
            } catch {
              setVipExpiryBannerDismissed(false);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  useEffect(() => {
    const success = searchParams.get("success");
    if (success !== "1" || status !== "authenticated" || loading) return;

    setCardSuccessPending(true);
    let attempts = 0;
    const maxAttempts = 15;
    const pollMs = 2000;

    const poll = () => {
      fetch("/api/subscription")
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.paid) {
            setPaid(true);
            setSubscriptionTier(data.subscriptionTier ?? null);
            setExpiresAt(data.expiresAt ?? null);
            setCardSuccessPending(false);
            router.replace("/subscribe", { scroll: false });
            return;
          }
          attempts += 1;
          if (attempts < maxAttempts) setTimeout(poll, pollMs);
          else setCardSuccessPending(false);
        })
        .catch(() => {
          attempts += 1;
          if (attempts < maxAttempts) setTimeout(poll, pollMs);
          else setCardSuccessPending(false);
        });
    };

    poll();
  }, [searchParams, status, loading, router]);

  const handleTermsCheckboxChange = async (checked: boolean) => {
    setTermsCheckbox(checked);
    if (!checked) return;
    if (paymentTermsAcceptedAt) return;
    setTermsAccepting(true);
    try {
      const res = await fetch("/api/accept-payment-terms", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setPaymentTermsAcceptedAt(new Date().toISOString());
      }
    } finally {
      setTermsAccepting(false);
    }
  };

  const termsAcceptedForPayment = termsCheckbox;
  const cardFee = cardPaymentFeeUsd;
  const plans = vipPlans;
  const plan = plans.find((p) => p.id === selectedPlan) ?? plans[0];
  const amountUsdc = plan?.priceUsd ?? 150;
  const planCardPrice = plan ? getCardPriceUsd(plan.priceUsd) : 0;
  const daysRemaining = expiryDaysRemaining(expiresAt);
  const hasActiveAutoRenew = subscriptionAutoRenew && !cancelAtPeriodEnd;
  const showExpiryBanner =
    paid &&
    !!expiresAt &&
    daysRemaining !== null &&
    daysRemaining >= 0 &&
    daysRemaining <= 7 &&
    !hasActiveAutoRenew &&
    !vipExpiryBannerDismissed;
  const showActiveOnlyView = paid && !!expiresAt && !showExpiryBanner;

  useEffect(() => {
    const inTier = plans.some((p) => p.id === selectedPlan);
    if (!inTier && plans.length) setSelectedPlan(plans[0].id);
  }, [plans, selectedPlan]);

  useEffect(() => {
    if (!verifySuccess) return;
    const t = setTimeout(() => router.push("/"), 2500);
    return () => clearTimeout(t);
  }, [verifySuccess, router]);

  const handlePayWithCard = async () => {
    if (!termsAcceptedForPayment) return;
    setCardError("");
    setCardLoading(true);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedPlan,
          autoRenew,
          successUrl: typeof window !== "undefined" ? `${window.location.origin}/subscribe?success=1` : undefined,
          cancelUrl: typeof window !== "undefined" ? `${window.location.origin}/subscribe` : undefined,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setCardError(data.error || "Could not start checkout. Try again.");
    } catch {
      setCardError("Request failed. Try again.");
    } finally {
      setCardLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    setVerifySuccess(false);
    const sig = txSignature.trim();
    if (!sig) {
      setVerifyError("Paste the transaction signature from your wallet.");
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan, txSignature: sig }),
      });
      const data = await res.json();
      if (data.success && data.subscribed) {
        setVerifySuccess(true);
        setPaid(true);
        setExpiresAt(data.expiresAt ?? null);
        setTxSignature("");
      } else {
        setVerifyError(data.error || "Verification failed. Check the signature and try again.");
      }
    } catch {
      setVerifyError("Request failed. Try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const openBillingPortal = async () => {
    setBillingActionLoading(true);
    setBillingMessage("");
    try {
      const res = await fetch("/api/stripe/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/subscribe` }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
        return;
      }
      setBillingMessage(data.error ?? "Could not open billing portal.");
    } catch {
      setBillingMessage("Something went wrong. Try again.");
    } finally {
      setBillingActionLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <span className="text-zinc-500 dark:text-zinc-400">Loading…</span>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-3 sm:px-4 py-6">
        <p className="text-zinc-700 dark:text-zinc-300 mb-4">Sign in to subscribe.</p>
        <Button asChild>
          <Link href="/signin">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (showActiveOnlyView) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-3 sm:px-4 py-6">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-6 py-4 text-center max-w-md w-full">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">You have an active subscription</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
            VIP access · Valid until {new Date(expiresAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
          {hasStripeSubscription && (
            <p className="text-sm text-emerald-700/90 dark:text-emerald-300/90 mt-2">
              {cancelAtPeriodEnd
                ? "Auto-renewal is off — access continues until the date above."
                : subscriptionAutoRenew
                  ? "Auto-renewal is on — your card will be charged automatically at renewal."
                  : "Card subscription on file."}
            </p>
          )}
          {billingMessage && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">{billingMessage}</p>
          )}
          {(hasStripeSubscription || hasStripeCustomer) && (
            <div className="mt-4 flex flex-col gap-2">
              {hasStripeSubscription && cancelAtPeriodEnd ? (
                <Button
                  type="button"
                  disabled={billingActionLoading}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={async () => {
                    setBillingActionLoading(true);
                    setBillingMessage("");
                    try {
                      const res = await fetch("/api/stripe/resume-auto-renew", { method: "POST" });
                      const data = await res.json();
                      if (data.success) {
                        setCancelAtPeriodEnd(false);
                        setSubscriptionAutoRenew(true);
                        setBillingMessage(data.message ?? "Auto-renewal enabled.");
                      } else {
                        setBillingMessage(data.error ?? "Could not enable auto-renewal.");
                      }
                    } finally {
                      setBillingActionLoading(false);
                    }
                  }}
                >
                  {billingActionLoading ? "Updating…" : "Turn auto-renewal back on"}
                </Button>
              ) : hasStripeSubscription && subscriptionAutoRenew ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={billingActionLoading}
                  className="w-full"
                  onClick={async () => {
                    setBillingActionLoading(true);
                    setBillingMessage("");
                    try {
                      const res = await fetch("/api/stripe/cancel-auto-renew", { method: "POST" });
                      const data = await res.json();
                      if (data.success) {
                        setCancelAtPeriodEnd(true);
                        setBillingMessage(data.message ?? "Auto-renewal will stop at period end.");
                      } else {
                        setBillingMessage(data.error ?? "Could not update billing.");
                      }
                    } finally {
                      setBillingActionLoading(false);
                    }
                  }}
                >
                  {billingActionLoading ? "Updating…" : "Turn off auto-renewal"}
                </Button>
              ) : null}
              {hasStripeCustomer && (
                <Button type="button" variant="outline" disabled={billingActionLoading} className="w-full" onClick={openBillingPortal}>
                  {billingActionLoading ? "Opening…" : "Update payment method"}
                </Button>
              )}
            </div>
          )}
          {(hasStripeSubscription || hasStripeCustomer) && (
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-3">
              Manage billing anytime from{" "}
              <Link href="/account" className="underline font-medium">
                Account → VIP billing
              </Link>
              .
            </p>
          )}
          <Button asChild className="mt-4">
            <Link href="/?from=subscribe">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/about" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              About
            </Link>
            <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-10">
        {showExpiryBanner && expiresAt && daysRemaining !== null && (
          <VipExpiryBanner
            expiresAt={expiresAt}
            daysRemaining={daysRemaining}
            autoRenew={subscriptionAutoRenew}
            cancelAtPeriodEnd={cancelAtPeriodEnd}
            hideRenewLink
            onDismiss={() => {
              try {
                sessionStorage.setItem(`novastaris-vip-expiry-dismiss:${expiresAt}`, "1");
              } catch {
                /* ignore */
              }
              setVipExpiryBannerDismissed(true);
            }}
          />
        )}
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          {showExpiryBanner ? "Renew VIP subscription" : "VIP subscription"}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          {isVariantB ? (
            <>
              One plan — full platform access. NovaForecast, Nova Forex Agent, Nova Polymarket, wallet intelligence,
              and on-demand premium workflows for traders scaling into bigger opportunities.
            </>
          ) : (
            <>
              NovaStaris is free to explore; <strong className="text-zinc-800 dark:text-zinc-200">VIP</strong> unlocks the
              full workspace — meme discovery, futures decision support, wallet tracking, prediction markets, NovaForecast,
              Nova Forex Agent, and on-demand tools such as AI Trading Bot, Nova Prop Firm Challenge, and Nova Ultimate.
              Pay by USDC (Solana) at list price, or card (includes a ${cardFee} card payment fee).
              {!payByCardEnabled && payByUsdcEnabled ? " Card checkout is temporarily unavailable." : ""}
              {payByCardEnabled && !payByUsdcEnabled ? " USDC payment is temporarily unavailable." : ""}
              {!payByCardEnabled && !payByUsdcEnabled ? " New payments are temporarily unavailable." : ""}
            </>
          )}
        </p>
        <div className="rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50/60 dark:bg-cyan-950/30 p-4 mb-6">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">What&apos;s included in VIP</p>
          <ul className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 list-disc list-inside space-y-1">
            <li>Surge, Transactions, Crypto Narratives, NovaStaris AI Agent (Solana + BSC), Crypto Futures, NovaConnect</li>
            <li>CT Scan, Wallet Tracker, Coach Calls + Telegram Signals (on-demand where noted)</li>
            <li>NovaForecast, Nova Forex Agent, NovaQ, Nova Investment Agent, Nova+, NovaScalper</li>
            <li>On-demand: AI Trading Bot, Nova Polymarket, Nova Prop Firm Challenge, Nova Ultimate</li>
          </ul>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
          VIP: $150/month
          {payByUsdcEnabled ? " USDC" : ""}
          {payByUsdcEnabled && payByCardEnabled ? ` ($${150 + cardFee} card)` : ""}
          {payByCardEnabled && !payByUsdcEnabled ? ` card ($${150 + cardFee} incl. fee)` : ""}
          . 6 months $750
          {payByUsdcEnabled ? " USDC" : ""}
          ; 12 months $1,500
          {payByUsdcEnabled ? " USDC" : ""}.
        </p>

        <div className="grid gap-4 mb-8 sm:grid-cols-3">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlan(p.id)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                selectedPlan === p.id
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-500"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{p.label}</div>
              <div className="mt-1 text-lg font-bold text-violet-600 dark:text-violet-400">
                ${p.priceUsd}
                {payByUsdcEnabled ? " USDC" : ""}
              </div>
              {payByCardEnabled && (
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  ${p.priceUsd + cardFee} with card (incl. ${cardFee} fee)
                </div>
              )}
            </button>
          ))}
        </div>

        {cardSuccessPending && (
          <div className="mb-6 rounded-xl border-2 border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/40 px-5 py-4 text-cyan-800 dark:text-cyan-200">
            <p className="font-bold text-lg">Payment received</p>
            <p className="mt-1 text-sm">Activating your subscription… Please wait a moment.</p>
          </div>
        )}
        {verifySuccess && (
          <div className="mb-6 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-5 py-4 text-emerald-800 dark:text-emerald-200">
            <p className="font-bold text-lg">Subscription activated!</p>
            <p className="mt-1 text-sm">You now have VIP access. Redirecting to dashboard…</p>
            <p className="mt-2 text-sm">
              <Link href="/?from=subscribe" className="underline font-medium">
                Go to dashboard now
              </Link>
            </p>
          </div>
        )}

        {(payByCardEnabled || payByUsdcEnabled) && (
          <div className="rounded-lg border border-cyan-500/25 dark:border-cyan-600/35 bg-slate-50/90 dark:bg-slate-900/60 p-4 mb-6">
            <label htmlFor="payment-terms-checkbox" className="flex items-start gap-3 cursor-pointer">
              <input
                id="payment-terms-checkbox"
                type="checkbox"
                checked={termsCheckbox}
                onChange={(e) => handleTermsCheckboxChange(e.target.checked)}
                disabled={termsAccepting}
                className="mt-1 h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500 disabled:opacity-70 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-zinc-800 dark:text-zinc-200">
                I agree to the{" "}
                <Link href="/payment-terms" className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  Payment Terms and Conditions
                </Link>{" "}
                (no refund after 24 hours of use).
              </span>
            </label>
          </div>
        )}

        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Payment method</h2>
        {!payByCardEnabled && !payByUsdcEnabled ? (
          <div className="mb-8 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-5 py-4 text-amber-900 dark:text-amber-100">
            <p className="font-semibold">New payments temporarily unavailable</p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              Card and USDC checkout are both turned off right now. If you already have VIP, you can still manage
              billing from Account. Otherwise, please check back later or contact support.
            </p>
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 gap-4 mb-8 ${
              payByCardEnabled && payByUsdcEnabled ? "lg:grid-cols-2" : ""
            }`}
          >
            {payByCardEnabled && (
              <Card className="border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-cyan-500" />
                    Pay with card
                  </CardTitle>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Includes a ${cardFee} card payment fee. Secure checkout via Stripe.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cardError && <p className="text-sm text-rose-600 dark:text-rose-400">{cardError}</p>}
                  <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                    <input
                      type="checkbox"
                      checked={autoRenew}
                      onChange={(e) => setAutoRenew(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      <strong className="text-zinc-900 dark:text-zinc-100">Enable automatic renewal</strong>
                      <span className="block mt-0.5 text-zinc-500 dark:text-zinc-400">
                        Your card is charged each billing period until you turn this off. Manage your card anytime from Account → VIP billing after checkout.
                      </span>
                    </span>
                  </label>
                  <Button
                    type="button"
                    onClick={handlePayWithCard}
                    disabled={!termsAcceptedForPayment || cardLoading}
                    className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
                  >
                    {cardLoading
                      ? "Redirecting…"
                      : termsAcceptedForPayment
                        ? autoRenew
                          ? `Subscribe $${planCardPrice}/period with card`
                          : `Pay $${planCardPrice} with card`
                        : "Accept terms above to pay with card"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {payByUsdcEnabled && (
              <Card className="border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-lg">Pay with USDC (Solana)</CardTitle>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Send <strong>{amountUsdc} USDC</strong> (list price — no card fee) to the wallet below, then paste the transaction signature.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentWallet ? (
                    <>
                      <p className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-mono break-all">{paymentWallet}</p>
                      <form onSubmit={handleVerify} className="space-y-3">
                        <input
                          type="text"
                          placeholder="Transaction signature"
                          value={txSignature}
                          onChange={(e) => setTxSignature(e.target.value)}
                          className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                        />
                        {verifyError && <p className="text-sm text-rose-600 dark:text-rose-400">{verifyError}</p>}
                        <Button type="submit" disabled={verifyLoading || !termsAcceptedForPayment} className="bg-cyan-500 hover:bg-cyan-600 text-white">
                          {verifyLoading ? "Verifying…" : "Verify payment & activate"}
                        </Button>
                      </form>
                    </>
                  ) : (
                    <p className="text-sm text-amber-700 dark:text-amber-400">Payment is not configured. Contact support.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-zinc-500">Loading…</div>}>
      <SubscribeContent />
    </Suspense>
  );
}
