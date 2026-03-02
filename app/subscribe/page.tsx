"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

type Plan = { id: string; label: string; months: number; priceUsd: number };

export default function SubscribePage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [proPlans, setProPlans] = useState<Plan[]>([]);
  const [vipPlans, setVipPlans] = useState<Plan[]>([]);
  const [paymentWallet, setPaymentWallet] = useState("");
  const [usdcMint, setUsdcMint] = useState("");
  const [tier, setTier] = useState<"pro" | "vip">("pro");
  const [selectedPlan, setSelectedPlan] = useState<string>("1month");
  const [txSignature, setTxSignature] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [usageThisMonth, setUsageThisMonth] = useState<{ aiAnalyses: number; alerts: number } | null>(null);

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
          setExpiresAt(data.expiresAt ?? null);
          setProPlans(Array.isArray(data.proPlans) ? data.proPlans : []);
          setVipPlans(Array.isArray(data.vipPlans) ? data.vipPlans : []);
          setPaymentWallet(data.paymentWallet ?? "");
          setUsdcMint(data.usdcMint ?? "");
          setUsageThisMonth(
            data.usageThisMonth && typeof data.usageThisMonth.aiAnalyses === "number" && typeof data.usageThisMonth.alerts === "number"
              ? { aiAnalyses: data.usageThisMonth.aiAnalyses, alerts: data.usageThisMonth.alerts }
              : null
          );
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const plans = tier === "pro" ? proPlans : vipPlans;
  const plan = plans.find((p) => p.id === selectedPlan) ?? plans[0];
  const amountUsdc = plan?.priceUsd ?? 100;

  useEffect(() => {
    const inTier = plans.some((p) => p.id === selectedPlan);
    if (!inTier && plans.length) setSelectedPlan(plans[0].id);
  }, [tier, plans, selectedPlan]);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <p className="text-zinc-700 dark:text-zinc-300 mb-4">Sign in to subscribe.</p>
        <Button asChild>
          <Link href="/signin">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (paid && expiresAt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-6 py-4 text-center max-w-md">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">You have an active subscription</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">Valid until {new Date(expiresAt).toLocaleDateString()}</p>
          <Button asChild className="mt-4">
            <Link href="/">Back to Dashboard</Link>
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

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Choose your plan</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Pro: Surge, Transactions, NovaStaris AI Agent, Crypto Futures. VIP: everything in Pro + CT Scan, Wallet Tracker, Coach Calls + Telegram Signals, and on-demand access to the NovaStaris AI Trading Bot (Crypto Futures).
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          Usage this month: AI analyses {usageThisMonth?.aiAnalyses ?? "—"} · Alerts {usageThisMonth?.alerts ?? "—"}
        </p>

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
          {tier === "pro" ? "Pro: $50/month. Surge, Transactions, NovaStaris AI Agent (Solana + BSC), Crypto Futures." : "VIP: $150/month. Everything in Pro + CT Scan, Wallet Tracker, Coach Calls + Telegram Signals, and on-demand access to the NovaStaris AI Trading Bot (Crypto Futures)."}
        </p>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 space-y-1">
          {tier === "pro" ? (
            <>
              <p className="font-medium text-zinc-600 dark:text-zinc-300">Pro includes:</p>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                <li>Surge (volume &amp; momentum)</li>
                <li>Transactions</li>
                <li>NovaStaris AI Agent (Solana &amp; BSC token analysis)</li>
                <li>Crypto Futures (AI chart analysis, Institutional Workflow)</li>
              </ul>
            </>
          ) : (
            <>
              <p className="font-medium text-zinc-600 dark:text-zinc-300">VIP includes everything in Pro, plus:</p>
              <ul className="list-disc list-inside pl-1 space-y-0.5">
                <li>CT Scan (Twitter / CT tracker)</li>
                <li>Wallet Tracker (Meme Coins Traders + Top Leverage Traders)</li>
                <li>Coach Calls + Telegram Signals (exclusive CA in-app and via Telegram)</li>
                <li>NovaStaris AI Trading Bot — on-demand access (Crypto Futures on Blofin)</li>
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
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Pay in USDC (Solana)</div>
            </button>
          ))}
        </div>

        {verifySuccess && (
          <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-emerald-800 dark:text-emerald-200">
            Subscription activated. You now have {tier === "vip" ? "VIP" : "Pro"} access. <Link href="/" className="underline font-medium">Go to dashboard</Link>
          </div>
        )}

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Pay with USDC (Solana)</CardTitle>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Send <strong>{amountUsdc} USDC</strong> to the wallet below. Use the same Solana network (mainnet). After sending, paste the transaction signature to activate your {tier.toUpperCase()} subscription.
            </p>
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
                  <Button type="submit" disabled={verifyLoading} className="bg-cyan-500 hover:bg-cyan-600 text-white">
                    {verifyLoading ? "Verifying…" : "Verify payment & activate"}
                  </Button>
                </form>
              </>
            ) : (
              <p className="text-sm text-amber-700 dark:text-amber-400">Payment is not configured. Contact support.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
