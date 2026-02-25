"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

type Profile = {
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  experienceTradingCrypto: string | null;
};

export default function AccountPage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [experienceTradingCrypto, setExperienceTradingCrypto] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch("/api/account/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setName(data.name ?? "");
          setPhone(data.phone ?? "");
          setCountry(data.country ?? "");
          setExperienceTradingCrypto(data.experienceTradingCrypto ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess(false);
    setProfileSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          country: country.trim() || undefined,
          experienceTradingCrypto: experienceTradingCrypto.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error ?? "Update failed.");
        return;
      }
      setProfileSuccess(true);
    } catch {
      setProfileError("Something went wrong.");
    } finally {
      setProfileSaving(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error ?? "Failed to change password.");
        return;
      }
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("Something went wrong.");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader className="text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              <Zap className="h-6 w-6 text-amber-500" />
              NovaStaris
            </Link>
            <CardTitle className="text-lg mt-2">Account</CardTitle>
            <p className="text-sm text-muted-foreground">Loading…</p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader className="text-center">
            <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              <Zap className="h-6 w-6 text-amber-500" />
              NovaStaris
            </Link>
            <CardTitle className="text-lg mt-2">Account</CardTitle>
            <p className="text-sm text-muted-foreground">Sign in to manage your account.</p>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/signin?callbackUrl=${encodeURIComponent("/account")}`}>Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasEmailPassword = !!profile?.email;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            <Zap className="h-6 w-6 text-amber-500" />
            NovaStaris
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Back to app</Link>
          </Button>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg">Profile</CardTitle>
            <p className="text-sm text-muted-foreground">Update your name and optional details.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileError && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-2">
                Profile updated.
              </div>
            )}
            <form onSubmit={onSaveProfile} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Email</label>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{profile?.email ?? "—"}</p>
              </div>
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
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
                <option value="">Trading experience (optional)</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
              <Button type="submit" disabled={profileSaving}>
                {profileSaving ? "Saving…" : "Save profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {hasEmailPassword && (
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg">Change password</CardTitle>
              <p className="text-sm text-muted-foreground">Enter your current password and choose a new one.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordError && (
                <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-2">
                  Password updated.
                </div>
              )}
              <form onSubmit={onChangePassword} className="space-y-3">
                <input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                  required
                />
                <input
                  type="password"
                  placeholder="New password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                  required
                  minLength={8}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                  required
                  minLength={8}
                />
                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? "Updating…" : "Change password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {!hasEmailPassword && (
          <p className="text-sm text-muted-foreground">You signed in with a wallet. Password change is only for email accounts.</p>
        )}
      </div>
    </div>
  );
}
