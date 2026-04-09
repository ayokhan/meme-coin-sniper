"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, CreditCard } from "lucide-react";

type Plan = { id: string; label: string; months: number; priceUsd: number };

function SubscribeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<"pro" | "vip" | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [cardSuccessPending, setCardSuccessPending] = useState(false);
  const [proPlans, setProPlans] = useState<Plan[]>([]);
  const [vipPlans, setVipPlans] = useState<Plan[]>([]);
  const [paymentWallet, setPaymentWallet] = useState("");
  const [usdcMint, setUsdcMint] = useState("");
  const [paymentTermsAcceptedAt, setPaymentTermsAcceptedAt] = useState<string | null>(null);
  const [termsCheckbox, setTermsCheckbox] = useState(false);
  const [termsAccepting, setTermsAccepting] = useState(false);
  const [tier, setTier] = useState<"pro" | "vip">("pro");
  const [selectedPlan, setSelectedPlan] = useState<string>("1month");
  const [txSignature, setTxSignature] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState("");
  /** Checkbox is always toggleable; payment requires the box to be checked in this session. */
  const termsAcceptedForPayment = termsCheckbox;

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
          setProPlans(Array.isArray(data.proPlans) ? data.proPlans : []);
          setVipPlans(Array.isArray(data.vipPlans) ? data.vipPlans : []);
          setPaymentWallet(data.paymentWallet ?? "");
          setUsdcMint(data.usdcMint ?? "");
          setPaymentTermsAcceptedAt(data.paymentTermsAcceptedAt ?? null);
          if (data.paymentTermsAcceptedAt) setTermsCheckbox(true);
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

  const plans = tier === "pro" ? proPlans : vipPlans;
  const plan = plans.find((p) => p.id === selectedPlan) ?? plans[0];
  const amountUsdc = plan?.priceUsd ?? 100;

  useEffect(() => {
    const inTier = plans.some((p) => p.id === selectedPlan);
    if (!inTier && plans.length) setSelectedPlan(plans[0].id);
  }, [tier, plans, selectedPlan]);

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
          tier,
          planId: selectedPlan,
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
        body: JSON.stringify({ tier, planId: selectedPlan, txSignature: sig }),
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

  if (paid && expiresAt) {
    const tierLabel = subscriptionTier === "vip" ? "VIP" : subscriptionTier === "pro" ? "Pro" : "active";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-3 sm:px-4 py-6">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-6 py-4 text-center max-w-md">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">You have an active subscription</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">{tierLabel} access · Valid until {new Date(expiresAt).toLocaleDateString()}</p>
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
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Choose your plan</h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Pro: Surge, Transactions, Crypto Narratives, NovaStaris AI Agent (Solana + BSC), Crypto Futures, NovaConnect. VIP: everything in Pro + CT Scan (on-demand), Wallet Tracker (Top Leverage Traders for all VIP users; Meme Coins Traders on-demand), Coach Calls + Telegram Signals, NovaForecast (includes NovaRadar), NovaQ (support/resistance + direction), <strong className="text-zinc-800 dark:text-zinc-200">Nova Investment Agent</strong> (Finance &amp; Investment Agent—risk/duration leverage framing; not advice), VIP-only Crypto Futures extras (<strong className="text-zinc-800 dark:text-zinc-200">Nova+</strong>, <strong className="text-zinc-800 dark:text-zinc-200">NovaScalper</strong>—headline features; subject to on-demand access where noted), on-demand NovaStaris AI Trading Bot, and on-demand <strong className="text-zinc-800 dark:text-zinc-200">Nova Polymarket Bot</strong>, <strong className="text-zinc-800 dark:text-zinc-200">Nova Prop Firm Bot</strong>, and <strong className="text-zinc-800 dark:text-zinc-200">Nova Ultimate</strong>. Pay by card or USDC (Solana).
        </p>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 mb-6">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">What&apos;s in each plan?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-semibold text-cyan-600 dark:text-cyan-400 mb-1">Pro ($50/mo)</p>
              <p className="text-zinc-600 dark:text-zinc-400">Surge, Transactions, Crypto Narratives, NovaStaris AI Agent (Solana + BSC), Crypto Futures (AI chart analysis, Institutional Workflow), BSC AI Analysis, NovaConnect (community &amp; DMs). Pay by card or USDC.</p>
            </div>
            <div>
              <p className="font-semibold text-violet-600 dark:text-violet-400 mb-1">VIP ($150/mo)</p>
              <p className="text-zinc-600 dark:text-zinc-400">Everything in Pro + CT Scan (on-demand), Wallet Tracker (Top Leverage Traders for all VIP users; Meme Coins Traders on-demand), Coach Calls + Telegram Signals, NovaForecast (NovaRadar), NovaQ, <strong className="text-zinc-800 dark:text-zinc-200">Nova Investment Agent</strong> (Finance &amp; Investment Agent), VIP Crypto Futures add-ons (Nova+ multi-horizon framing; NovaScalper repeat-cycle tool when enabled), on-demand AI Trading Bot (Blofin), on-demand Nova Polymarket Bot, Nova Prop Firm Bot, and Nova Ultimate. Pay by card or USDC.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTier("pro")}
            className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
              tier === "pro"
                ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 dark:border-cyan-500 text-cyan-700 dark:text-cyan-300"
                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
            }`}
          >
            Pro
          </button>
          <button
            type="button"
            onClick={() => setTier("vip")}
            className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
              tier === "vip"
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-500 text-violet-700 dark:text-violet-300"
                : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
            }`}
          >
            VIP
          </button>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
        {tier === "pro" ? "Pro: $50/month. Surge, Transactions, Crypto Narratives, NovaStaris AI Agent (Solana + BSC), Crypto Futures, NovaConnect." : "VIP: $150/month. Everything in Pro + CT Scan (on-demand), Wallet Tracker, Coach Calls + Telegram Signals, NovaForecast (NovaRadar), NovaQ, Nova Investment Agent (Finance & Investment Agent), Nova+ and NovaScalper (Crypto Futures—eligible accounts), on-demand AI Trading Bot, Nova Polymarket Bot, Nova Prop Firm Bot, and Nova Ultimate."}
        </p>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 space-y-1">
          {tier === "pro" ? (
            <>
              <p className="font-medium text-zinc-600 dark:text-zinc-300">Pro includes:</p>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                <li>Surge (volume &amp; momentum)</li>
                <li>Transactions (live trades feed)</li>
                <li>Crypto Narratives (themes &amp; meme-trend context)</li>
                <li>NovaStaris AI Agent (Solana &amp; BSC token analysis)</li>
                <li>Crypto Futures (AI chart analysis, Institutional Workflow)</li>
                <li>BSC AI Analysis</li>
                <li>NovaConnect (community feed &amp; DMs)</li>
                <li>Pay by credit card or USDC (Solana)</li>
              </ul>
            </>
          ) : (
            <>
              <p className="font-medium text-zinc-600 dark:text-zinc-300">VIP includes everything in Pro, plus:</p>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                <li>CT Scan (on-demand; request access, admin enables per user)</li>
                <li>Wallet Tracker (Top Leverage Traders for all VIP users; Meme Coins Traders on-demand)</li>
                <li>Coach Calls + Telegram Signals (exclusive CA in-app and via Telegram)</li>
                <li>NovaForecast — includes NovaRadar</li>
                <li>NovaQ (NovaIntelligence) — support/resistance + market direction</li>
                <li>Nova Investment Agent (Finance &amp; Investment Agent) — risk/duration leverage framing; not personalized advice</li>
                <li>Nova+ — VIP Crypto Futures; multi-horizon context (not personalized advice)</li>
                <li>NovaScalper — optional repeat-cycle tool for enabled accounts (headline only; see product for rules)</li>
                <li>NovaStaris AI Trading Bot — on-demand (Crypto Futures on Blofin)</li>
                <li>Nova Polymarket Bot — on-demand</li>
                <li>Nova Prop Firm Bot — on-demand</li>
                <li>Nova Ultimate — on-demand (Solana meme tooling)</li>
                <li>Pay by credit card or USDC (Solana)</li>
              </ul>
            </>
          )}
        </div>

        <div className={`grid gap-4 mb-8 ${tier === "vip" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlan(p.id)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                selectedPlan === p.id
                  ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 dark:border-cyan-500"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{p.label}</div>
              <div className="mt-1 text-lg font-bold text-cyan-600 dark:text-cyan-400">${p.priceUsd} USD</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Pay by card or USDC (Solana)</div>
            </button>
          ))}
        </div>

        {cardSuccessPending && (
          <div className="mb-6 rounded-xl border-2 border-cyan-300 dark:border-cyan-700 bg-cyan-50 dark:bg-cyan-950/40 px-5 py-4 text-cyan-800 dark:text-cyan-200">
            <p className="font-bold text-lg">Payment received</p>
            <p className="mt-1 text-sm">Activating your subscription… Please wait a moment.</p>
            <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-300">If this message stays for more than 30 seconds, refresh the page or contact support.</p>
          </div>
        )}
        {searchParams.get("success") === "1" && !paid && !cardSuccessPending && (
          <div className="mb-6 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-5 py-4 text-amber-800 dark:text-amber-200">
            <p className="font-bold text-lg">Payment received</p>
            <p className="mt-1 text-sm">If your subscription does not appear above, refresh the page in a moment or contact support with your payment details.</p>
          </div>
        )}
        {verifySuccess && (
          <div className="mb-6 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-5 py-4 text-emerald-800 dark:text-emerald-200">
            <p className="font-bold text-lg">Subscription activated!</p>
            <p className="mt-1 text-sm">You now have {tier === "vip" ? "VIP" : "Pro"} access. Redirecting to dashboard…</p>
            <p className="mt-2 text-sm"><Link href="/?from=subscribe" className="underline font-medium">Go to dashboard now</Link></p>
          </div>
        )}

        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-4 mb-6">
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
              <Link
                href="/payment-terms"
                className="font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Payment Terms and Conditions
              </Link>{" "}
              (no refund after 24 hours of use). You must accept before paying.
              {paymentTermsAcceptedAt && <span className="block mt-1 text-xs text-zinc-500">You previously accepted the payment terms. You can check or uncheck above; the box must be checked to pay.</span>}
            </span>
          </label>
          {termsAccepting && <p className="text-xs text-zinc-500 mt-1">Saving…</p>}
        </div>

        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Payment method</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-cyan-500" />
                Pay with card
              </CardTitle>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Pay by credit or debit card. You will be redirected to our secure payment page.
              </p>
            </CardHeader>
            <CardContent>
              {cardError && <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{cardError}</p>}
              <Button
                type="button"
                onClick={handlePayWithCard}
                disabled={!termsAcceptedForPayment || cardLoading}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                {cardLoading ? "Redirecting…" : termsAcceptedForPayment ? `Pay $${plan?.priceUsd ?? 0} with card` : "Accept terms above to pay with card"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Pay with USDC (Solana)</CardTitle>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Send <strong>{amountUsdc} USDC</strong> to the wallet below. Use the same Solana network (mainnet). After sending, paste the transaction signature to activate your {tier.toUpperCase()} subscription.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
              <strong>How we verify payment:</strong> We only check that the correct amount of USDC reached the wallet above by reading the transaction on Solana. We never hold your keys or custody your funds.
            </p>
            {!termsAcceptedForPayment && (
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">Accept the Payment Terms above to verify USDC payment.</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentWallet ? (
              <>
                <div>
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Payment wallet address</label>
                  <p className="mt-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-sm font-mono break-all text-zinc-900 dark:text-zinc-100">
                    {paymentWallet}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Amount: {amountUsdc} USDC (SPL token, mint: {usdcMint})</p>
                </div>
                <form onSubmit={handleVerify} className="space-y-3">
                  <div>
                    <label htmlFor="tx-sig" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Transaction signature</label>
                    <input
                      id="tx-sig"
                      type="text"
                      placeholder="Paste the tx signature from your wallet after sending USDC"
                      value={txSignature}
                      onChange={(e) => setTxSignature(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
                    />
                  </div>
                  {verifyError && <p className="text-sm text-rose-600 dark:text-rose-400">{verifyError}</p>}
                  <Button type="submit" disabled={verifyLoading || !termsAcceptedForPayment} className="bg-cyan-500 hover:bg-cyan-600 text-white">
                    {verifyLoading ? "Verifying…" : termsAcceptedForPayment ? "Verify payment & activate" : "Accept terms to verify"}
                  </Button>
                </form>
              </>
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-400">Payment is not configured. Contact support.</p>
            )}
          </CardContent>
        </Card>
        </div>
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
