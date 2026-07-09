"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, BarChart3, Sparkles, Bell, CreditCard, Gift, User, Receipt } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import TwoFactorSettings from "@/components/TwoFactorSettings";
import AccountBillingHistory from "@/components/AccountBillingHistory";

type Profile = {
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  experienceTradingCrypto: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
  usageThisMonth?: { aiAnalyses: number; alerts: number };
  selfDeleteEnabled?: boolean;
  billingHistoryEnabled?: boolean;
  hasPassword?: boolean;
  isProtectedOwner?: boolean;
};

export default function AccountPage() {
  const router = useRouter();
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
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [subscriptionPaid, setSubscriptionPaid] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [subscriptionAutoRenew, setSubscriptionAutoRenew] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMessage, setBillingMessage] = useState("");
  const [billingError, setBillingError] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [mainTab, setMainTab] = useState<"profile" | "billing">("profile");
  const [billingSection, setBillingSection] = useState<"vip" | "history" | "affiliate">("vip");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (hash === "billing" || hash === "billing-history") {
      setMainTab("billing");
      if (hash === "billing-history") setBillingSection("history");
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (status !== "authenticated") return;
    if (typeof window !== "undefined" && window.location.hash === "#two-factor") {
      setMainTab("profile");
      window.setTimeout(() => {
        document.getElementById("two-factor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
    (async () => {
      try {
        const [profileRes, subRes] = await Promise.all([
          fetch("/api/account/profile"),
          fetch("/api/subscription"),
        ]);
        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data);
          setName(data.name ?? "");
          setPreferredName(data.preferredName ?? "");
          setAvatarUrl(data.avatarUrl ?? "");
          setPhone(data.phone ?? "");
          setCountry(data.country ?? "");
          setExperienceTradingCrypto(data.experienceTradingCrypto ?? "");
        }
        if (subRes.ok) {
          const sub = await subRes.json();
          if (sub.success) {
            setSubscriptionPaid(!!sub.paid);
            setSubscriptionExpiresAt(sub.expiresAt ?? null);
            setSubscriptionAutoRenew(!!sub.autoRenew);
            setCancelAtPeriodEnd(!!sub.cancelAtPeriodEnd);
            setHasStripeSubscription(!!sub.hasStripeSubscription);
            setHasStripeCustomer(!!sub.hasStripeCustomer);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const openBillingPortal = async () => {
    setBillingLoading(true);
    setBillingError("");
    setBillingMessage("");
    try {
      const res = await fetch("/api/stripe/billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: `${window.location.origin}/account` }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
        return;
      }
      setBillingError(data.error ?? "Could not open billing portal.");
    } catch {
      setBillingError("Something went wrong. Try again.");
    } finally {
      setBillingLoading(false);
    }
  };

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
          // Avatar is managed by upload / Remove only (not exposed as URL in UI)
          ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
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

  const onDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: deleteConfirm,
          password: deletePassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDeleteError(data.error ?? "Failed to delete account.");
        return;
      }
      await signOut({ redirect: false });
      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("Something went wrong.");
    } finally {
      setDeleteLoading(false);
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

  const hasEmailPassword = !!profile?.hasPassword;

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

        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Profile &amp; Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account, payments, and affiliate program.</p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "profile" | "billing")} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="profile" className="gap-1.5">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6 mt-0">
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
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Profile picture</label>
                <p className="text-[11px] text-muted-foreground mb-1">
                  Upload a photo—it saves automatically and appears on NovaConnect and in the community feed.
                </p>
                {avatarUrl ? (
                  <div className="mt-1 mb-2 flex flex-wrap items-center gap-3">
                    <img
                      src={avatarUrl.includes("blob.vercel-storage.com") ? `/api/avatar?url=${encodeURIComponent(avatarUrl)}` : avatarUrl}
                      alt="Profile"
                      className="h-16 w-16 rounded-full object-cover border-2 border-zinc-200 dark:border-zinc-600"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Current picture (NovaConnect &amp; feed)</span>
                      <button
                        type="button"
                        className="text-xs text-rose-600 dark:text-rose-400 hover:underline text-left w-fit"
                        disabled={avatarUploading}
                        onClick={async () => {
                          setAvatarError("");
                          try {
                            const res = await fetch("/api/account/profile", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ avatarUrl: "" }),
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              setAvatarError(data.error ?? "Could not remove photo.");
                              return;
                            }
                            setAvatarUrl("");
                            setProfileSuccess(true);
                            setTimeout(() => setProfileSuccess(false), 4000);
                          } catch {
                            setAvatarError("Could not remove photo.");
                          }
                        }}
                      >
                        Remove profile photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mb-1">No picture yet. Upload one below.</p>
                )}
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
                          setAvatarError(data?.error ?? "Upload failed. Try again.");
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

        {hasEmailPassword && <TwoFactorSettings hasPassword={!!profile?.hasPassword} />}

        {!hasEmailPassword && (
          <p className="text-sm text-muted-foreground">You signed in with Google or a wallet. Password change is only for email/password accounts.</p>
        )}

        {profile?.selfDeleteEnabled && (
          <Card className="border-rose-200 dark:border-rose-900/60 bg-white dark:bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg text-rose-700 dark:text-rose-300">Delete account</CardTitle>
              <p className="text-sm text-muted-foreground">
                Permanently remove your NovaStaris account and associated data (profile, subscriptions, watchlists,
                tracked wallets, NovaConnect, and saved settings). This cannot be undone.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.isProtectedOwner ? (
                <p className="text-sm text-muted-foreground">
                  Owner accounts are protected and cannot be deleted here. Use Admin → Customers to remove other users,
                  or contact support if you need help with your owner account.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Support tickets sent by email may be kept for compliance. Aggregated analytics without personal
                    identifiers may be retained.
                  </p>
                  {deleteError && (
                    <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                      {deleteError}
                    </div>
                  )}
                  <form onSubmit={onDeleteAccount} className="space-y-3">
                    <label className="block text-sm">
                      <span className="text-muted-foreground">Type DELETE to confirm</span>
                      <input
                        type="text"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder="DELETE"
                        autoComplete="off"
                        className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono"
                        required
                      />
                    </label>
                    {hasEmailPassword && (
                      <PasswordInput
                        placeholder="Current password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                        required
                      />
                    )}
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={deleteLoading || deleteConfirm.trim() !== "DELETE"}
                      className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
                    >
                      {deleteLoading ? "Deleting…" : "Delete my account permanently"}
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        )}

          </TabsContent>

          <TabsContent value="billing" className="space-y-4 mt-0">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={billingSection === "vip" ? "default" : "outline"}
                onClick={() => setBillingSection("vip")}
              >
                VIP &amp; payments
              </Button>
              {profile?.billingHistoryEnabled && (
                <Button
                  type="button"
                  size="sm"
                  variant={billingSection === "history" ? "default" : "outline"}
                  onClick={() => setBillingSection("history")}
                >
                  <Receipt className="h-3.5 w-3.5 mr-1" />
                  Billing history
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant={billingSection === "affiliate" ? "default" : "outline"}
                onClick={() => setBillingSection("affiliate")}
              >
                <Gift className="h-3.5 w-3.5 mr-1" />
                Affiliate
              </Button>
            </div>

            {billingSection === "affiliate" && (
        <Card className="border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/40 to-white dark:from-amber-950/20 dark:to-zinc-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-lg">Affiliate program</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Refer friends to VIP and earn 10% commission. Payouts every Friday after verification.
            </p>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="border-amber-300/80 dark:border-amber-800">
              <Link href="/affiliate">Open affiliate dashboard</Link>
            </Button>
          </CardContent>
        </Card>
            )}

            {billingSection === "vip" && (
              <>
                {subscriptionPaid && (hasStripeSubscription || hasStripeCustomer) ? (
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-cyan-500" />
                <CardTitle className="text-lg">VIP billing</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage card auto-renewal for your NovaStaris VIP subscription.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionExpiresAt && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  VIP access valid until{" "}
                  <strong>
                    {new Date(subscriptionExpiresAt).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </strong>
                </p>
              )}
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {cancelAtPeriodEnd
                  ? "Auto-renewal is off. You will not be charged again unless you re-enable it or renew manually."
                  : subscriptionAutoRenew
                    ? "Auto-renewal is on. Your card will be charged automatically at the end of each billing period."
                    : "Card subscription on file."}
              </p>
              {billingError && (
                <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                  {billingError}
                </div>
              )}
              {billingMessage && (
                <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm px-3 py-2">
                  {billingMessage}
                </div>
              )}
              {showCancelConfirm ? (
                <div className="rounded-lg border border-violet-400/35 dark:border-violet-600/40 bg-slate-50/95 dark:bg-slate-900/70 p-4 space-y-3">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Turn off automatic renewal?</p>
                  <p className="text-sm text-muted-foreground">
                    Your VIP access continues until the date above. After that, your card will not be charged unless you renew manually.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={billingLoading}
                      className="bg-rose-600 hover:bg-rose-700"
                      onClick={async () => {
                        setBillingLoading(true);
                        setBillingError("");
                        setBillingMessage("");
                        try {
                          const res = await fetch("/api/stripe/cancel-auto-renew", { method: "POST" });
                          const data = await res.json();
                          if (data.success) {
                            setCancelAtPeriodEnd(true);
                            setShowCancelConfirm(false);
                            setBillingMessage(
                              data.message ??
                                "Auto-renewal is off. You will not be billed again at renewal — VIP access continues until your current period ends."
                            );
                          } else {
                            setBillingError(data.error ?? "Could not turn off auto-renewal.");
                          }
                        } catch {
                          setBillingError("Something went wrong. Try again.");
                        } finally {
                          setBillingLoading(false);
                        }
                      }}
                    >
                      {billingLoading ? "Updating…" : "Yes, turn off auto-renewal"}
                    </Button>
                    <Button type="button" variant="outline" disabled={billingLoading} onClick={() => setShowCancelConfirm(false)}>
                      Keep auto-renewal on
                    </Button>
                  </div>
                </div>
              ) : cancelAtPeriodEnd ? (
                <Button
                  type="button"
                  disabled={billingLoading}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={async () => {
                    setBillingLoading(true);
                    setBillingError("");
                    setBillingMessage("");
                    try {
                      const res = await fetch("/api/stripe/resume-auto-renew", { method: "POST" });
                      const data = await res.json();
                      if (data.success) {
                        setCancelAtPeriodEnd(false);
                        setSubscriptionAutoRenew(true);
                        setBillingMessage(data.message ?? "Auto-renewal is enabled again.");
                      } else {
                        setBillingError(data.error ?? "Could not enable auto-renewal.");
                      }
                    } catch {
                      setBillingError("Something went wrong. Try again.");
                    } finally {
                      setBillingLoading(false);
                    }
                  }}
                >
                  {billingLoading ? "Updating…" : "Turn auto-renewal back on"}
                </Button>
              ) : subscriptionAutoRenew ? (
                <Button type="button" variant="outline" disabled={billingLoading} onClick={() => setShowCancelConfirm(true)}>
                  Turn off auto-renewal
                </Button>
              ) : null}
              {hasStripeCustomer && (
                <Button type="button" variant="outline" disabled={billingLoading} onClick={openBillingPortal}>
                  {billingLoading ? "Opening…" : "Update payment method"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Need to change plan or pay by USDC?{" "}
                <Link href="/subscribe" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                  Visit subscribe page
                </Link>
              </p>
            </CardContent>
          </Card>
                ) : (
                  <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <CardHeader>
                      <CardTitle className="text-lg">VIP subscription</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {subscriptionPaid
                          ? "Manage your subscription and payment methods."
                          : "Upgrade to VIP for full platform access, or subscribe to start earning with the affiliate program."}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <Button asChild>
                        <Link href="/subscribe">View plans &amp; subscribe</Link>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {billingSection === "history" && (
              <AccountBillingHistory enabled={!!profile?.billingHistoryEnabled} />
            )}
          </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}
