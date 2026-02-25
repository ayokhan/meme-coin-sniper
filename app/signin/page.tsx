"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("email", { email, password, redirect: false });
      if (res?.error) {
        setError(res.error === "CredentialsSignin" ? "Invalid email or password." : res.error);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
      <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <CardHeader className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            <Zap className="h-6 w-6 text-amber-500" />
            NovaStaris
          </Link>
          <CardTitle className="text-lg mt-2">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your email and password to access your account.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
              {error}
            </div>
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
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              required
            />
            <p className="text-xs text-right -mt-1">
              <Link href="/forgot-password" className="text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100 underline">
                Forgot password?
              </Link>
            </p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center">
              <Button variant="ghost" size="sm" className="bg-white dark:bg-zinc-900 text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100" asChild>
                <Link href={callbackUrl !== "/" ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register"}>
                  Don&apos;t have an account? Register
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
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
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
