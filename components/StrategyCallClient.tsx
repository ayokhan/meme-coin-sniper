"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, CheckCircle2, Phone, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteInstagramFooter from "@/components/SiteInstagramFooter";
import type { PaidStrategyCallPublicConfig } from "@/lib/paid-strategy-call";

const inputClass =
  "w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2.5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100";

export default function StrategyCallClient() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const paidParam = searchParams.get("paid") === "1";
  const canceled = searchParams.get("canceled") === "1";
  const sessionId = searchParams.get("session_id");

  const [cfg, setCfg] = useState<PaidStrategyCallPublicConfig | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidConfirmed, setPaidConfirmed] = useState(paidParam);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void fetch("/api/paid-strategy-call")
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data.config) setCfg(data.config as PaidStrategyCallPublicConfig);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (session?.user?.name && !name) setName(session.user.name);
  }, [session?.user?.name, name]);

  useEffect(() => {
    if (!paidParam || !sessionId || status !== "authenticated") return;
    let cancelled = false;
    setConfirming(true);
    void fetch(`/api/stripe/confirm-strategy-call?session_id=${encodeURIComponent(sessionId)}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success && data.paid) setPaidConfirmed(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setConfirming(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paidParam, sessionId, status]);

  const price = cfg?.priceUsd ?? 200;
  const enabled = cfg?.enabled === true;

  const startCheckout = useCallback(async () => {
    setError(null);
    if (status !== "authenticated") {
      setError("Sign in to purchase a Strategy call.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/create-strategy-call-checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        setError(data.error || "Could not start checkout.");
        return;
      }
      window.location.href = data.url as string;
    } catch {
      setError("Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }, [name, phone, status]);

  if (paidConfirmed) {
    return (
      <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/80 dark:bg-emerald-950/30 p-6 sm:p-8 space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Payment received</h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              Thank you. One of our experts will contact you within <strong>24 hours</strong> by email and phone
              to schedule your 1-hour Strategy call.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400 list-disc list-inside">
              <li>Watch your inbox (and spam folder) for our message</li>
              <li>Keep your phone available — we will call the number you provided</li>
              <li>We schedule personally to avoid calendar conflicts</li>
            </ul>
            {confirming && (
              <p className="mt-3 text-xs text-zinc-500">Confirming payment with Stripe…</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-500 text-white">
            <Link href="/">Back to dashboard</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/discovery-call">Discovery call (complimentary)</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {canceled && (
        <p className="text-sm rounded-lg border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100 px-4 py-3">
          Checkout was canceled. You can try again when ready — nothing was charged.
        </p>
      )}

      <section className="grid sm:grid-cols-3 gap-4">
        {[
          {
            icon: Shield,
            title: "Expert session",
            body: "A private hour with NovaStaris experts focused on your markets and workflow.",
          },
          {
            icon: CalendarClock,
            title: "Scheduled for you",
            body: "After payment, we contact you within 24 hours to book a conflict-free time.",
          },
          {
            icon: Phone,
            title: "Phone + email",
            body: "We reach you on both channels so scheduling is clear and reliable.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 space-y-2"
          >
            <item.icon className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.body}</p>
          </div>
        ))}
      </section>

      <section
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 sm:p-7 space-y-5"
        aria-labelledby="what-you-get"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 id="what-you-get" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              What the session covers
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              60 minutes · ${price} USD · private working session
            </p>
          </div>
          <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            ${price}
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400"> / hour</span>
          </p>
        </div>
        <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-disc list-inside">
          <li>Deep review of your trading path across meme, futures, forex, wallets, or prediction markets</li>
          <li>How to structure your NovaStaris desks for daily use — not just a feature tour</li>
          <li>Practical workflow recommendations from our team</li>
          <li>Clear next steps after the call</li>
        </ul>
      </section>

      <section
        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 p-5 sm:p-7 space-y-4"
        aria-labelledby="process"
      >
        <h2 id="process" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          How booking works
        </h2>
        <ol className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">1. Share your details</span> — name and
            phone (required) so our expert can reach you.
          </li>
          <li>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">2. Pay ${price} securely</span> — card
            checkout via Stripe. You receive a confirmation email.
          </li>
          <li>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">3. We schedule within 24 hours</span> —
            an expert emails and calls you to set the 1-hour session. This is not self-serve Calendly booking, so
            we can avoid double-booking.
          </li>
        </ol>
      </section>

      {!enabled ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 px-4 py-3">
          Strategy call purchases are paused right now. For a complimentary product introduction, see{" "}
          <Link href="/discovery-call" className="text-teal-600 dark:text-teal-400 underline underline-offset-2">
            Discovery call
          </Link>
          .
        </p>
      ) : (
        <section
          className="rounded-2xl border border-teal-200/70 dark:border-teal-800/40 bg-white dark:bg-zinc-900/80 p-5 sm:p-7 space-y-4"
          aria-labelledby="purchase"
        >
          <h2 id="purchase" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Purchase Strategy call
          </h2>
          {status !== "authenticated" ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Sign in to continue. We need an account email plus your phone so our expert can contact you after
                payment.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-500 text-white">
                  <Link href={`/signin?callbackUrl=${encodeURIComponent("/strategy-call")}`}>Sign in</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/register?callbackUrl=${encodeURIComponent("/strategy-call")}`}>Create account</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Full name</span>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Phone (with country code)
                </span>
                <input
                  className={inputClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  autoComplete="tel"
                  required
                />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Signed in as {session?.user?.email}. After payment, an expert will contact this email and the phone
                above within 24 hours.
              </p>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <Button
                type="button"
                disabled={busy}
                onClick={() => void startCheckout()}
                className="bg-teal-600 hover:bg-teal-500 text-white w-full sm:w-auto"
              >
                {busy ? "Starting checkout…" : `Pay $${price} & continue`}
              </Button>
            </div>
          )}
        </section>
      )}

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Want a complimentary introduction first?{" "}
        <Link href="/discovery-call" className="text-teal-600 dark:text-teal-400 underline underline-offset-2">
          Book a Discovery call
        </Link>
        .
      </p>
    </div>
  );
}

export function StrategyCallPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50 via-zinc-50 to-zinc-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/enter" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/discovery-call"
              className="text-sm font-medium text-teal-700 dark:text-teal-400 hover:underline"
            >
              Discovery call
            </Link>
            <Link
              href="/"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-3 sm:px-4 py-10 sm:py-14 space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700 dark:text-teal-400">
            Strategy call
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Work 1:1 with NovaStaris experts
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            A focused one-hour Strategy call for traders who want more than a product walkthrough — desk setup,
            workflow, and expert guidance tailored to how you trade.
          </p>
        </div>
        {children}
        <section className="border-t border-zinc-200 dark:border-zinc-800 pt-8 space-y-3">
          <p className="text-xs text-zinc-400 dark:text-zinc-600">
            Not financial advice. Always confirm prices and risk with your broker or venue.
          </p>
          <SiteInstagramFooter className="border-0 pt-4 pb-0" />
        </section>
      </main>
    </div>
  );
}
