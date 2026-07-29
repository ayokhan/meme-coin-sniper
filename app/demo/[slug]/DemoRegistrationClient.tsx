"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Zap } from "lucide-react";
import {
  DEFAULT_DEMO_PAGE_EYEBROW,
  DEFAULT_DEMO_SUBMIT_LABEL,
  DEMO_EXPERIENCE_LEVELS,
  DEMO_SOURCES,
} from "@/lib/demo-sessions";
import { DEMO_COUNTRIES, regionsForCountry } from "@/lib/demo-geo";

type DemoSessionPublic = {
  slug: string;
  title: string;
  description: string | null;
  pageEyebrow: string;
  submitLabel: string;
  sessionAt: string | null;
  timezone: string | null;
  locationNote: string | null;
  meetingPlatform: string | null;
  registrationOpen: boolean;
  spotsLeft: number | null;
  registeredCount: number;
  isPaid: boolean;
  priceUsdCents: number | null;
  priceLabel: string | null;
};

const inputClass =
  "mt-1.5 w-full h-10 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50";
const labelClass = "block text-xs font-medium text-zinc-400";

export default function DemoRegistrationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = String(params?.slug ?? "");
  const srcFromQuery = searchParams.get("src")?.trim() || "";
  const paidOk = searchParams.get("paid") === "1";
  const canceled = searchParams.get("canceled") === "1";

  const [session, setSession] = useState<DemoSessionPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(
    paidOk ? "Payment received. You're registered — check your email for confirmation." : null
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [cryptoExperience, setCryptoExperience] = useState("");
  const [forexExperience, setForexExperience] = useState("");
  const [source, setSource] = useState(
    DEMO_SOURCES.some((s) => s.value === srcFromQuery) ? srcFromQuery : srcFromQuery || "direct"
  );
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [promoOptIn, setPromoOptIn] = useState(false);

  const regionOptions = useMemo(() => (country ? regionsForCountry(country) : null), [country]);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("Invalid session link.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/demo/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || "Session not found.");
          setSession(null);
          return;
        }
        setSession(data.session);
      } catch {
        if (!cancelled) setError("Could not load this session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (srcFromQuery && DEMO_SOURCES.some((s) => s.value === srcFromQuery)) {
      setSource(srcFromQuery);
    } else if (srcFromQuery) {
      setSource(srcFromQuery);
    }
  }, [srcFromQuery]);

  useEffect(() => {
    setRegion("");
  }, [country]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/demo/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          city: city || undefined,
          country,
          region,
          cryptoExperience: cryptoExperience || undefined,
          forexExperience: forexExperience || undefined,
          source: source || "direct",
          newsletterOptIn,
          promoOptIn,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Registration failed.");
        return;
      }
      if (data.requiresPayment && data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      setDoneMessage(
        data.message || "You're registered. Check your email for session details."
      );
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const whenLabel = session?.sessionAt
    ? new Date(session.sessionAt).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      })
    : null;

  const eyebrow = session?.pageEyebrow || DEFAULT_DEMO_PAGE_EYEBROW;
  const submitLabel = session?.submitLabel || DEFAULT_DEMO_SUBMIT_LABEL;
  const canSubmit =
    name.trim() &&
    email.trim() &&
    country &&
    region.trim() &&
    (regionOptions ? regionOptions.some((r) => r.value === region) : region.trim().length >= 2);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.08),_transparent_55%)]" />
      <div className="relative mx-auto max-w-lg px-4 py-10 sm:py-14">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-zinc-50"
          >
            <Zap className="h-7 w-7 text-amber-500" />
            NovaStaris
          </Link>
          <p className="mt-2 text-sm text-zinc-500">{eyebrow}</p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-zinc-500">Loading session…</p>
        ) : doneMessage ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-8 text-center shadow-xl shadow-black/40">
            <p className="text-lg font-semibold text-emerald-400">You&apos;re in</p>
            <p className="mt-3 text-sm text-zinc-300 leading-relaxed">{doneMessage}</p>
            {session && (
              <p className="mt-4 text-xs text-zinc-500">
                {session.title}
                {whenLabel ? ` · ${whenLabel}` : ""}
              </p>
            )}
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-amber-500 px-5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 transition-colors"
            >
              Back to NovaStaris
            </Link>
          </div>
        ) : error && !session ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-8 text-center">
            <p className="text-sm text-rose-400">{error}</p>
            <Link href="/" className="mt-4 inline-block text-sm text-amber-500 hover:underline">
              Go home
            </Link>
          </div>
        ) : session ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-8 shadow-xl shadow-black/40">
            <h1 className="text-xl sm:text-2xl font-semibold text-zinc-50 tracking-tight">
              {session.title}
            </h1>
            {session.description && (
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{session.description}</p>
            )}
            <div className="mt-4 space-y-1 text-xs text-zinc-500">
              {whenLabel && (
                <p>
                  {whenLabel}
                  {session.timezone ? ` (${session.timezone})` : ""}
                </p>
              )}
              {session.locationNote && <p>{session.locationNote}</p>}
              {session.isPaid && session.priceLabel && (
                <p className="text-amber-400/90 font-medium">
                  Registration fee: {session.priceLabel} USD (Stripe)
                </p>
              )}
              {session.spotsLeft != null && (
                <p>
                  {session.spotsLeft > 0
                    ? `${session.spotsLeft} spot${session.spotsLeft === 1 ? "" : "s"} left`
                    : "Session is full"}
                </p>
              )}
            </div>

            {!session.registrationOpen ? (
              <p className="mt-6 text-sm text-amber-400/90">
                Registration is closed for this session.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {canceled && (
                  <div className="rounded-lg bg-amber-950/40 border border-amber-900/50 px-3 py-2 text-sm text-amber-200">
                    Payment was canceled. You can complete registration below when ready.
                  </div>
                )}
                {error && (
                  <div className="rounded-lg bg-rose-950/50 border border-rose-900/60 px-3 py-2 text-sm text-rose-300">
                    {error}
                  </div>
                )}

                <label className={labelClass}>
                  Full name *
                  <input
                    className={inputClass}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Your name"
                  />
                </label>

                <label className={labelClass}>
                  Email *
                  <input
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@email.com"
                  />
                </label>

                <label className={labelClass}>
                  Phone
                  <input
                    type="tel"
                    className={inputClass}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="Optional"
                  />
                </label>

                <label className={labelClass}>
                  Country *
                  <select
                    className={inputClass}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    required
                    autoComplete="country-name"
                  >
                    <option value="">Select country…</option>
                    {DEMO_COUNTRIES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Province / State *
                  {regionOptions ? (
                    <select
                      className={inputClass}
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      required
                      disabled={!country}
                    >
                      <option value="">Select province / state…</option>
                      {regionOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inputClass}
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      required
                      disabled={!country}
                      autoComplete="address-level1"
                      placeholder={country ? "Province / state / region" : "Select a country first"}
                    />
                  )}
                </label>

                <label className={labelClass}>
                  City <span className="text-zinc-600 font-normal">(optional)</span>
                  <input
                    className={inputClass}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoComplete="address-level2"
                    placeholder="City"
                  />
                </label>

                <label className={labelClass}>
                  Crypto experience
                  <select
                    className={inputClass}
                    value={cryptoExperience}
                    onChange={(e) => setCryptoExperience(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {DEMO_EXPERIENCE_LEVELS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  Forex experience
                  <select
                    className={inputClass}
                    value={forexExperience}
                    onChange={(e) => setForexExperience(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {DEMO_EXPERIENCE_LEVELS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  How did you hear about this?
                  <select
                    className={inputClass}
                    value={DEMO_SOURCES.some((s) => s.value === source) ? source : "other"}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    {DEMO_SOURCES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-start gap-2.5 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/40"
                    checked={newsletterOptIn}
                    onChange={(e) => setNewsletterOptIn(e.target.checked)}
                  />
                  <span>Send me NovaStaris updates and trading tips</span>
                </label>

                <label className="flex items-start gap-2.5 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-zinc-600 bg-zinc-900 text-amber-500 focus:ring-amber-500/40"
                    checked={promoOptIn}
                    onChange={(e) => setPromoOptIn(e.target.checked)}
                  />
                  <span>I&apos;m open to promo offers and partner deals</span>
                </label>

                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="w-full h-11 rounded-lg bg-amber-500 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting
                    ? session.isPaid
                      ? "Redirecting to payment…"
                      : "Submitting…"
                    : session.isPaid && session.priceLabel
                      ? `${submitLabel} · ${session.priceLabel}`
                      : submitLabel}
                </button>

                <p className="text-[11px] text-center text-zinc-600">
                  {session.isPaid
                    ? "You'll complete payment securely with Stripe. Confirmation is emailed after payment."
                    : "You'll get a confirmation email after registering. Meeting details may follow closer to the session."}
                </p>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
