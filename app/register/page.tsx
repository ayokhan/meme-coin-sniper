"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

declare global {
  interface Window {
    phantom?: { solana?: { connect: () => Promise<{ publicKey: { toBase58: () => string } }>; request: (args: { method: string; params: { message: string; display: string } }) => Promise<{ signature: string }> } };
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
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

  const handleGoogle = () => {
    setError("");
    signIn("google", { callbackUrl });
  };

  const handleWallet = async () => {
    setError("");
    setWalletLoading(true);
    try {
      const phantom = typeof window !== "undefined" ? window.phantom?.solana : null;
      if (!phantom) {
        setError("Install Phantom wallet extension to sign in with wallet.");
        setWalletLoading(false);
        return;
      }
      const { publicKey } = await phantom.connect();
      const walletAddress = publicKey.toBase58();

      const nonceRes = await fetch(`/api/auth/nonce?wallet=${encodeURIComponent(walletAddress)}`);
      const nonceData = await nonceRes.json();
      if (!nonceData.success || !nonceData.message) {
        setError("Could not get login message.");
        setWalletLoading(false);
        return;
      }

      const sig = await phantom.request({
        method: "signMessage",
        params: { message: nonceData.message, display: "utf8" },
      });
      const rawSig = sig.signature as string | Uint8Array | number[];
      const signature =
        typeof rawSig === "string"
          ? rawSig
          : bs58Encode(rawSig instanceof Uint8Array ? rawSig : new Uint8Array(rawSig));

      const res = await signIn("wallet", {
        walletAddress,
        message: nonceData.message,
        signature,
        redirect: false,
      });
      if (res?.error) {
        setError("Wallet sign-in failed.");
        setWalletLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet sign-in failed.");
    } finally {
      setWalletLoading(false);
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
          <CardTitle className="text-lg mt-2">Sign in or register</CardTitle>
          <p className="text-sm text-muted-foreground">Free: 5 New pairs + 5 Trending. Subscribe for full access.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3">
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
              minLength={8}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in with email"}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            No account? Use the same form — we’ll create one on first sign-in.
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
              <span className="bg-white dark:bg-zinc-900 px-2">Or continue with</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
              Google
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={handleWallet} disabled={walletLoading}>
              {walletLoading ? "Connecting…" : "Phantom / Solana wallet"}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            <Link href="/" className="underline hover:no-underline">Back to app</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function bs58Encode(buf: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join(""));
  let s = "";
  while (num > 0n) {
    const r = Number(num % 58n);
    num = num / 58n;
    s = alphabet[r] + s;
  }
  for (const b of buf) {
    if (b === 0) s = alphabet[0] + s;
    else break;
  }
  return s;
}
