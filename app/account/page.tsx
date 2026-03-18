"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, BarChart3, Sparkles, Bell } from "lucide-react";

type Profile = {
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  experienceTradingCrypto: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
  usageThisMonth?: { aiAnalyses: number; alerts: number };
};

export default function AccountPage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [name, setName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [experienceTradingCrypto, setExperienceTradingCrypto] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
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
          setPreferredName(data.preferredName ?? "");
          setAvatarUrl(data.avatarUrl ?? "");
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
          preferredName: preferredName.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
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
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-3 sm:px-4 py-6 sm:py-8">
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

        {profile?.usageThisMonth != null && (
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-500" />
                <CardTitle className="text-lg">Usage this month</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Your activity for the current billing period. Resets at the start of each month.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/40 dark:to-cyan-900/20 border border-cyan-200/60 dark:border-cyan-800/50 p-4">
                  <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 mb-1">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wide">AI analyses</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {profile.usageThisMonth.aiAnalyses}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Token analyses run this month</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20 border border-violet-200/60 dark:border-violet-800/50 p-4">
                  <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 mb-1">
                    <Bell className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-medium uppercase tracking-wide">Alerts</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {profile.usageThisMonth.alerts}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Meme coin &amp; leverage alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Preferred name</label>
                <p className="text-[11px] text-muted-foreground mb-1">How you appear on NovaConnect and in the app.</p>
                <input
                  type="text"
                  placeholder="Preferred name (optional)"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm mt-0.5"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Profile picture (avatar URL)</label>
                <p className="text-[11px] text-muted-foreground mb-1">Image URL for your profile. You can upload an image below—it saves automatically and appears in NovaConnect.</p>
                {avatarUrl ? (
                  <div className="mt-1 mb-2 flex items-center gap-3">
                    <img
                      src={avatarUrl.includes("blob.vercel-storage.com") ? `/api/avatar?url=${encodeURIComponent(avatarUrl)}` : avatarUrl}
                      alt="Profile"
                      className="h-16 w-16 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-600"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="text-xs text-muted-foreground">Current picture (also shown in NovaConnect)</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mb-1">No picture set. Upload one below or paste a URL, then Save profile.</p>
                )}
                <input
                  type="url"
                  placeholder="https://…"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm mt-0.5"
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="text-sm"
                    disabled={avatarUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAvatarError("");
                      setAvatarUploading(true);
                      try {
                        const formData = new FormData();
                        formData.set("file", file);
                        const res = await fetch("/api/upload/avatar-server", {
                          method: "POST",
                          body: formData,
                        });
                        const data = await res.json();
                        if (res.ok && data?.url) {
                          setAvatarUrl(data.url);
                          setProfileSuccess(true);
                          setTimeout(() => setProfileSuccess(false), 5000);
                        } else {
                          setAvatarError(data?.error ?? "Upload failed. Try again or paste an image URL.");
                        }
                      } catch (err) {
                        setAvatarError(err instanceof Error ? err.message : "Upload failed.");
                      } finally {
                        setAvatarUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                  {avatarUploading ? "Uploading & saving…" : "Upload image (saves automatically)"}
                </label>
                {avatarError && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{avatarError}</p>
                )}
              </div>
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
