"use client";

import { Suspense, useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
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

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"totp" | "email" | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [error, setError] = useState("");

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!twoFactorStep) {
        const checkRes = await fetch("/api/auth/2fa/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const checkData = (await checkRes.json()) as {
          success?: boolean;
          error?: string;
          requires2fa?: boolean;
          method?: "totp" | "email" | null;
        };
        if (!checkRes.ok || !checkData.success) {
          setError(checkData.error ?? "Invalid email or password.");
          return;
        }
        if (checkData.requires2fa) {
          setTwoFactorStep(true);
          setTwoFactorMethod(checkData.method ?? null);
          if (checkData.method === "email") {
            const sendRes = await fetch("/api/auth/2fa/send-email-otp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            const sendData = (await sendRes.json()) as { error?: string };
            if (!sendRes.ok) {
              setError(sendData.error ?? "Could not send email code.");
              setTwoFactorStep(false);
            }
          }
          return;
        }
      }

      const res = await signIn("email", {
        email,
        password,
        otpCode: twoFactorStep ? otpCode : "",
        redirect: false,
      });
      if (res?.error) {
        if (res.error === "2FA_REQUIRED") {
          setTwoFactorStep(true);
          setError("Enter your two-factor code.");
          return;
        }
        setError(res.error === "CredentialsSignin" ? "Invalid email, password, or code." : res.error);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const resendEmailCode = async () => {
    setError("");
    setLoading(true);
    try {
      const sendRes = await fetch("/api/auth/2fa/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const sendData = (await sendRes.json()) as { error?: string };
      if (!sendRes.ok) setError(sendData.error ?? "Could not resend code.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
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
          <CardTitle className="text-lg mt-2">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">
            Welcome back. Don&apos;t have an account yet?{" "}
            <Link href={callbackUrl !== "/" ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"} className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
              Sign up free
            </Link>{" "}
            — no credit card required.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
              {error}
            </div>
          )}

          {googleEnabled && (
            <Button type="button" variant="outline" className="w-full" disabled={googleLoading} onClick={handleGoogleSignIn}>
              <span className="inline-flex items-center gap-2.5 font-medium">
                <GoogleLogo />
                {googleLoading ? "Connecting Gmail..." : "Sign in with Gmail"}
              </span>
            </Button>
          )}

          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              required
            />
            <PasswordInput
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              required
              disabled={twoFactorStep}
            />
            {twoFactorStep && (
              <>
                <p className="text-xs text-muted-foreground">
                  {twoFactorMethod === "email"
                    ? "Enter the 6-digit code we emailed you."
                    : "Enter the 6-digit code from your authenticator app (or a backup code)."}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\s/g, ""))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono tracking-widest"
                  required
                />
                {twoFactorMethod === "email" && (
                  <button
                    type="button"
                    onClick={() => void resendEmailCode()}
                    className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                    disabled={loading}
                  >
                    Resend email code
                  </button>
                )}
              </>
            )}
            <p className="text-xs text-right -mt-1">
              <Link href="/forgot-password" className="text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100 underline">
                Forgot password?
              </Link>
            </p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : twoFactorStep ? "Verify & sign in" : "Sign in"}
            </Button>
            {twoFactorStep && (
              <button
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100"
                onClick={() => {
                  setTwoFactorStep(false);
                  setTwoFactorMethod(null);
                  setOtpCode("");
                  setError("");
                }}
              >
                Back
              </button>
            )}
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center">
              <Button variant="ghost" size="sm" className="bg-white dark:bg-zinc-900 text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100" asChild>
                <Link href={callbackUrl !== "/" ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"}>
                  Don&apos;t have an account? Sign up free
                </Link>
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

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-3 sm:px-4 py-6">
        <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader className="text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              <Zap className="h-6 w-6 text-amber-500" />
              NovaStaris
            </Link>
            <CardTitle className="text-lg mt-2">Sign in</CardTitle>
            <p className="text-sm text-muted-foreground">Loading…</p>
          </CardHeader>
        </Card>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
