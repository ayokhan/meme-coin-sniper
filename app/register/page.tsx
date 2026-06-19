"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProviders } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { PromoBannerDisplay } from "@/components/PromoBannerDisplay";
import type { PromoBannerAdmin } from "@/lib/promo-banner";
import { PasswordInput } from "@/components/PasswordInput";
import { signInWithGoogle } from "@/lib/google-oauth-client";

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 sm:h-[22px] sm:w-[22px]" viewBox="0 0 18 18">
      <path fill="#EA4335" d="M9 7.2v3.6h5.1c-.22 1.16-.9 2.14-1.92 2.8l3.1 2.4c1.8-1.66 2.84-4.1 2.84-7 0-.7-.06-1.38-.18-2.04H9z" />
      <path fill="#34A853" d="M9 18c2.58 0 4.74-.86 6.32-2.34l-3.1-2.4c-.86.58-1.96.92-3.22.92-2.48 0-4.58-1.68-5.32-3.94l-3.2 2.48C2.04 15.8 5.26 18 9 18z" />
      <path fill="#4A90E2" d="M3.68 10.24A5.39 5.39 0 0 1 3.38 9c0-.44.1-.86.3-1.24L.48 5.28A9 9 0 0 0 0 9c0 1.44.34 2.8.94 4l2.74-2.76z" />
      <path fill="#FBBC05" d="M9 3.58c1.4 0 2.66.48 3.66 1.42l2.74-2.74A8.98 8.98 0 0 0 9 0C5.26 0 2.04 2.2.48 5.28l3.2 2.48C4.42 5.26 6.52 3.58 9 3.58z" />
    </svg>
  );
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const signInHref = callbackUrl !== "/" ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/signin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [experienceTradingCrypto, setExperienceTradingCrypto] = useState("");
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [novaConnectOptIn, setNovaConnectOptIn] = useState(true);
  const [acceptCommunityRules, setAcceptCommunityRules] = useState(false);
  const [acceptPresencePrivacy, setAcceptPresencePrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sitePromo, setSitePromo] = useState<PromoBannerAdmin | null>(null);

  useEffect(() => {
    fetch("/api/promo-banner")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setSitePromo(data.promo ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProviders = async () => {
      try {
        const providers = await getProviders();
        if (!mounted) return;
        setGoogleEnabled(!!providers?.google);
      } catch {
        if (!mounted) return;
        setGoogleEnabled(false);
      }
    };
    loadProviders();
    return () => {
      mounted = false;
    };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || undefined,
          preferredName: preferredName.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          phone: phone.trim() || undefined,
          country: country.trim() || undefined,
          experienceTradingCrypto: experienceTradingCrypto || undefined,
          newsletterOptIn,
          novaConnectOptIn,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Registration failed.");
        return;
      }
      setSuccess("Registration successful. Sign in to continue.");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle(callbackUrl);
    } catch {
      setError("Unable to continue with Google right now.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-3 sm:px-4 py-6">
      <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <CardHeader className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            <Zap className="h-6 w-6 text-amber-500" />
            NovaStaris
          </Link>
          <CardTitle className="text-lg mt-2">Create a free account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Join NovaStaris for free — no credit card required. Save watchlists, track wallets, and upgrade to Pro or VIP when you are ready.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {sitePromo?.active && sitePromo.showOnRegister && (
            <PromoBannerDisplay promo={sitePromo} compact />
          )}
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-2 flex flex-col gap-2">
              <span>{success}</span>
              <Button asChild size="sm" className="w-fit bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700">
                <Link href={signInHref}>Sign in</Link>
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {googleEnabled && (
              <Button type="button" variant="outline" className="w-full" disabled={googleLoading} onClick={handleGoogleSignUp}>
                <span className="inline-flex items-center gap-2.5 font-medium">
                  <GoogleLogo />
                  {googleLoading ? "Connecting Gmail..." : "Continue registration with Gmail"}
                </span>
              </Button>
            )}
            <form onSubmit={handleRegister} className="space-y-3">
              <input
                type="text"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Preferred name (optional — how you appear on NovaConnect)"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
              <input
                type="url"
                placeholder="Profile picture URL (optional)"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                required
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Country (optional)"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
              <select
                value={experienceTradingCrypto}
                onChange={(e) => setExperienceTradingCrypto(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              >
                <option value="">Experience trading crypto (optional)</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
              <PasswordInput
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                required
                minLength={8}
              />
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newsletterOptIn}
                  onChange={(e) => setNewsletterOptIn(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
                Subscribe to NovaStaris newsletter (weekly digest, product updates)
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={novaConnectOptIn}
                  onChange={(e) => setNovaConnectOptIn(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-600"
                />
                Join <span className="font-semibold">NovaConnect</span> (social portal — show my profile as online to other traders)
              </label>
              <p className="text-xs text-muted-foreground">
                By creating an account you agree to our{" "}
                <Link href="/terms" className="underline hover:no-underline">Terms of Service</Link>
                ,{" "}
                <Link href="/privacy" className="underline hover:no-underline">Privacy Policy</Link>
                , and the following. You must read and accept before registering:
              </p>
              <div className="space-y-2 pl-1">
                <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptCommunityRules}
                    onChange={(e) => setAcceptCommunityRules(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-600 mt-0.5"
                  />
                  <span>
                    I have read and accept the{" "}
                    <Link href="/nova-connect-terms#rules" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                      Community rules (summary)
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptPresencePrivacy}
                    onChange={(e) => setAcceptPresencePrivacy(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-600 mt-0.5"
                  />
                  <span>
                    I have read and accept the{" "}
                    <Link href="/nova-connect-terms#privacy" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                      Presence &amp; privacy
                    </Link>
                  </span>
                </label>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !acceptCommunityRules || !acceptPresencePrivacy}>
                {loading ? "Creating account…" : "Register"}
              </Button>
            </form>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center">
              <Button variant="outline" size="sm" className="bg-white dark:bg-zinc-900" asChild>
                <Link href={signInHref}>Already have an account? Sign in</Link>
              </Button>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            <Link href="/" className="underline hover:no-underline">Back to app</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RegisterFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-3 sm:px-4 py-6">
      <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <CardHeader className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            <Zap className="h-6 w-6 text-amber-500" />
            NovaStaris
          </Link>
          <CardTitle className="text-lg mt-2">Create a free account</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterForm />
    </Suspense>
  );
}
