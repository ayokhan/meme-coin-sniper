import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Zap } from "lucide-react";
import SiteInstagramFooter from "@/components/SiteInstagramFooter";
import {
  DEFAULT_STRATEGY_CALL_BOOKING_URL,
  getStrategyCallBookingUrl,
  isStrategyCallPromoted,
} from "@/lib/strategy-call";

export const metadata: Metadata = {
  title: "Free strategy call | NovaStaris",
  description:
    "Book a free NovaStaris strategy call to walk through features, pick a path, and take one clear next step.",
};

export const dynamic = "force-dynamic";

export default async function StrategyCallPage() {
  const [bookingUrl, promoted] = await Promise.all([
    getStrategyCallBookingUrl(),
    isStrategyCallPromoted(),
  ]);
  const calendlyUrl = bookingUrl || DEFAULT_STRATEGY_CALL_BOOKING_URL;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/enter" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/start-here"
              className="text-sm font-medium text-teal-700 dark:text-teal-400 hover:underline"
            >
              Start here
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

      <main className="mx-auto max-w-3xl px-3 sm:px-4 py-10 sm:py-14 space-y-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-600 dark:text-teal-400">
            Free strategy call
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
            Walk through NovaStaris features with us
          </h1>
          <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Book a short call to go over the product — which desks fit how you trade, how the tabs work
            together, and one clear next step so you&apos;re not stuck on day one.
          </p>
        </div>

        <section
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-5 sm:p-6 space-y-4"
          aria-labelledby="what-we-cover"
        >
          <h2 id="what-we-cover" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            What we cover
          </h2>
          <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300 list-disc list-inside">
            <li>Your path: meme, crypto futures, forex, wallets, Polymarket, or bots</li>
            <li>The right tabs for that path (and what to ignore for now)</li>
            <li>One practical first action inside NovaStaris</li>
            <li>VIP / partner options only if they&apos;re relevant — no hard sell</li>
          </ul>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            About 30 minutes. Free. You pick a time on Calendly; we meet on the invite they send you.
          </p>
        </section>

        {promoted ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold px-5 py-3 transition-colors"
            >
              <CalendarDays className="h-4 w-4" aria-hidden />
              Book on Calendly
            </a>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
              Opens Calendly in a new tab. Reschedule or cancel anytime from the same link.
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 px-4 py-3">
            Strategy calls are paused right now. Use{" "}
            <Link href="/start-here" className="text-teal-600 dark:text-teal-400 underline underline-offset-2">
              Start here
            </Link>
            ,{" "}
            <Link href="/chat" className="text-teal-600 dark:text-teal-400 underline underline-offset-2">
              Chat
            </Link>
            , or{" "}
            <Link href="/support" className="text-teal-600 dark:text-teal-400 underline underline-offset-2">
              Support
            </Link>{" "}
            instead.
          </p>
        )}

        <section className="border-t border-zinc-200 dark:border-zinc-800 pt-8 space-y-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Prefer to explore alone?{" "}
            <Link href="/start-here" className="text-teal-600 dark:text-teal-400 underline underline-offset-2">
              Open Start here
            </Link>
            .
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 pt-2">
            Not financial advice. Always confirm prices and risk with your broker or venue.
          </p>
          <SiteInstagramFooter className="border-0 pt-4 pb-0" />
        </section>
      </main>
    </div>
  );
}
