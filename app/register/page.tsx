"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

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
      await signIn("google", { callbackUrl });
    } catch {
      setError("Unable to continue with Google right now.");
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
          <CardTitle className="text-lg mt-2">Create an account</CardTitle>
          <p className="text-sm text-muted-foreground">Register with your email to get started.</p>
        </CardHeader>
        <CardContent className="space-y-4">
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
                {googleLoading ? "Connecting Google..." : "Continue with Gmail"}
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
              <input
                type="password"
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
          <CardTitle className="text-lg mt-2">Create an account</CardTitle>
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
