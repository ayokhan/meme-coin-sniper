"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

type Payment = {
  date: string;
  amountUsd: number;
  tier: string | null;
  plan: string;
  method: "card" | "usdc" | "other";
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  experienceTradingCrypto: string | null;
  tradingBotOnDemand: boolean;
  polymarketBotOnDemand: boolean;
  propFirmBotOnDemand: boolean;
  novaUltimateOnDemand: boolean;
  ctScanOnDemand: boolean;
  ctScanOnDemandExpiresAt: string | null;
  memeCoinsTraderOnDemand: boolean;
  memeCoinsTraderOnDemandExpiresAt: string | null;
  newsletterOptIn: boolean;
  novaConnectEnabled: boolean;
  novaConnectCommunityRep: boolean;
  novaConnectAllowedByAdmin: boolean;
  coachUser: boolean;
  novaConnectRulesAcceptedAt: string | null;
  paymentTermsAcceptedAt: string | null;
  createdAt: string;
  subscriptionTier: string | null;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  isActive: boolean;
  payments: Payment[];
};

export default function AdminCustomersPage() {
  const { data: session, status } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [togglingOnDemandId, setTogglingOnDemandId] = useState<string | null>(null);
  const [togglingPolymarketOnDemandId, setTogglingPolymarketOnDemandId] = useState<string | null>(null);
  const [togglingPropFirmOnDemandId, setTogglingPropFirmOnDemandId] = useState<string | null>(null);
  const [togglingNovaUltimateOnDemandId, setTogglingNovaUltimateOnDemandId] = useState<string | null>(null);
  const [togglingCtScanOnDemandId, setTogglingCtScanOnDemandId] = useState<string | null>(null);
  const [togglingMemeCoinsTraderOnDemandId, setTogglingMemeCoinsTraderOnDemandId] = useState<string | null>(null);
  const [ctOnDemandDurationById, setCtOnDemandDurationById] = useState<Record<string, string>>({});
  const [memeOnDemandDurationById, setMemeOnDemandDurationById] = useState<Record<string, string>>({});
  const [togglingNewsletterId, setTogglingNewsletterId] = useState<string | null>(null);
  const [togglingNovaConnectId, setTogglingNovaConnectId] = useState<string | null>(null);
  const [togglingCommunityRepId, setTogglingCommunityRepId] = useState<string | null>(null);
  const [togglingAllowedByAdminId, setTogglingAllowedByAdminId] = useState<string | null>(null);
  const [togglingCoachUserId, setTogglingCoachUserId] = useState<string | null>(null);
  const [acceptingRulesId, setAcceptingRulesId] = useState<string | null>(null);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [paymentsExpandedId, setPaymentsExpandedId] = useState<string | null>(null);
  const customersTableScrollRef = useRef<HTMLDivElement>(null);
  const TABLE_COL_COUNT = 23;

  const formatExpiryLabel = (expiresAt: string | null, subscriptionExpiresAt: string | null) => {
    if (!expiresAt) return "No custom expiry set";
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime())) return "Invalid expiry";
    const expiryText = expiry.toLocaleString();

    if (subscriptionExpiresAt) {
      const sub = new Date(subscriptionExpiresAt);
      if (!Number.isNaN(sub.getTime())) {
        // Treat near-identical timestamps as "subscription end"
        if (Math.abs(expiry.getTime() - sub.getTime()) < 60 * 1000) {
          return `Expires: ${expiryText} (subscription end)`;
        }
      }
    }
    return `Expires: ${expiryText}`;
  };

  const loadCustomers = () => {
    fetch("/api/admin/customers")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCustomers(data.customers ?? []);
        else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError("");
    loadCustomers();
  }, [status]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName.toLowerCase();
      const isTypingElement =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable;

      const scrollEl = customersTableScrollRef.current;
      const insideTableScroll = !!(scrollEl && scrollEl.contains(target));

      /** Arrow keys pan the wide customers table when focus is inside it (not in search/select/input). */
      if (insideTableScroll && !isTypingElement) {
        const step = e.shiftKey ? 120 : 48;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          scrollEl.scrollBy({ left: -step, behavior: "smooth" });
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          scrollEl.scrollBy({ left: step, behavior: "smooth" });
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          scrollEl.scrollBy({ top: -step, behavior: "smooth" });
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          scrollEl.scrollBy({ top: step, behavior: "smooth" });
          return;
        }
        if (e.key === "PageUp") {
          e.preventDefault();
          scrollEl.scrollBy({ top: -Math.round(scrollEl.clientHeight * 0.85), behavior: "smooth" });
          return;
        }
        if (e.key === "PageDown") {
          e.preventDefault();
          scrollEl.scrollBy({ top: Math.round(scrollEl.clientHeight * 0.85), behavior: "smooth" });
          return;
        }
        if (e.key === "Home") {
          e.preventDefault();
          scrollEl.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (e.key === "End") {
          e.preventDefault();
          scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
          return;
        }
      }

      if (isTypingElement) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        window.scrollBy({ top: 80, behavior: "smooth" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        window.scrollBy({ top: -80, behavior: "smooth" });
      } else if (e.key === "PageDown") {
        e.preventDefault();
        window.scrollBy({ top: Math.round(window.innerHeight * 0.9), behavior: "smooth" });
      } else if (e.key === "PageUp") {
        e.preventDefault();
        window.scrollBy({ top: -Math.round(window.innerHeight * 0.9), behavior: "smooth" });
      } else if (e.key === "Home") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (e.key === "End") {
        e.preventDefault();
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const metrics = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.isActive).length;
    const vipActive = customers.filter((c) => c.isActive && c.subscriptionTier === "vip").length;
    const proActive = customers.filter((c) => c.isActive && c.subscriptionTier === "pro").length;
    return { total, active, vipActive, proActive };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (activeOnly && !c.isActive) return false;
      if (!q) return true;
      return (
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.country ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, search, activeOnly]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage("Customer removed.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Delete failed");
    } catch {
      setError("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTradingBotOnDemand = async (id: string, value: boolean) => {
    setTogglingOnDemandId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingBotOnDemand: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Trading Bot (on demand) enabled." : "Trading Bot (on demand) disabled.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingOnDemandId(null);
    }
  };

  const handlePolymarketBotOnDemand = async (id: string, value: boolean) => {
    setTogglingPolymarketOnDemandId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ polymarketBotOnDemand: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Nova Polymarket Bot enabled." : "Nova Polymarket Bot disabled.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingPolymarketOnDemandId(null);
    }
  };

  const handlePropFirmBotOnDemand = async (id: string, value: boolean) => {
    setTogglingPropFirmOnDemandId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propFirmBotOnDemand: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Nova Prop Firm Bot enabled." : "Nova Prop Firm Bot disabled.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingPropFirmOnDemandId(null);
    }
  };

  const handleNovaUltimateOnDemand = async (id: string, value: boolean) => {
    setTogglingNovaUltimateOnDemandId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaUltimateOnDemand: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Nova Ultimate enabled." : "Nova Ultimate disabled.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingNovaUltimateOnDemandId(null);
    }
  };

  const handleCtScanOnDemand = async (id: string, value: boolean, subscriptionExpiresAt: string | null) => {
    setTogglingCtScanOnDemandId(id);
    setError("");
    try {
      const now = new Date();
      let ctScanOnDemandExpiresAt: Date | null = null;
      if (value) {
        const duration = ctOnDemandDurationById[id] ?? "subscription";
        if (duration === "1day") ctScanOnDemandExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        else if (duration === "5days") ctScanOnDemandExpiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        else if (duration === "subscription") ctScanOnDemandExpiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
      }
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ctScanOnDemand: value, ctScanOnDemandExpiresAt: value ? ctScanOnDemandExpiresAt : null }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "CT Scan (on demand) enabled." : "CT Scan (on demand) disabled.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingCtScanOnDemandId(null);
    }
  };

  const handleMemeCoinsTraderOnDemand = async (id: string, value: boolean, subscriptionExpiresAt: string | null) => {
    setTogglingMemeCoinsTraderOnDemandId(id);
    setError("");
    try {
      const now = new Date();
      let memeCoinsTraderOnDemandExpiresAt: Date | null = null;
      if (value) {
        const duration = memeOnDemandDurationById[id] ?? "subscription";
        if (duration === "1day") memeCoinsTraderOnDemandExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        else if (duration === "5days") memeCoinsTraderOnDemandExpiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        else if (duration === "subscription") memeCoinsTraderOnDemandExpiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
      }
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memeCoinsTraderOnDemand: value, memeCoinsTraderOnDemandExpiresAt: value ? memeCoinsTraderOnDemandExpiresAt : null }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Meme Coins Traders (on demand) enabled." : "Meme Coins Traders (on demand) disabled.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingMemeCoinsTraderOnDemandId(null);
    }
  };

  const handleNewsletterToggle = async (id: string, value: boolean) => {
    setTogglingNewsletterId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterOptIn: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Email digest enabled for customer." : "Email digest disabled for customer.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingNewsletterId(null);
    }
  };

  const handleNovaConnectToggle = async (id: string, value: boolean) => {
    setTogglingNovaConnectId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaConnectEnabled: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "NovaConnect enabled for customer." : "NovaConnect disabled for customer.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update NovaConnect");
    } catch {
      setError("Failed to update NovaConnect");
    } finally {
      setTogglingNovaConnectId(null);
    }
  };

  const handleCommunityRepToggle = async (id: string, value: boolean) => {
    setTogglingCommunityRepId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaConnectCommunityRep: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Community rep enabled." : "Community rep disabled.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingCommunityRepId(null);
    }
  };

  const handleAllowNovaConnectToggle = async (id: string, value: boolean) => {
    setTogglingAllowedByAdminId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaConnectAllowedByAdmin: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "User can use NovaConnect (online list & DMs)." : "NovaConnect access removed.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingAllowedByAdminId(null);
    }
  };

  const handleCoachUserToggle = async (id: string, value: boolean) => {
    setTogglingCoachUserId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachUser: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Coach user enabled: VIP access + coach call publishing." : "Coach user removed.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update coach user");
    } catch {
      setError("Failed to update coach user");
    } finally {
      setTogglingCoachUserId(null);
    }
  };

  const handleAcceptRules = async (id: string, value: boolean) => {
    setAcceptingRulesId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rulesAccepted: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Rules accepted for customer (NovaConnect ready)." : "Rules acceptance cleared.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setAcceptingRulesId(null);
    }
  };

  const handleResetPassword = async (id: string, email: string | null) => {
    if (!email) {
      setError("Password reset is only for accounts with email (wallet-only accounts cannot use email sign-in).");
      return;
    }
    const newPassword = window.prompt(`Set new password for ${email} (min 8 characters):`);
    if (newPassword == null) return;
    if (newPassword.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setResettingPasswordId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPassword.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Password updated. Customer can sign in with the new password.");
        setTimeout(() => setSuccessMessage(""), 5000);
      } else setError(data.error ?? "Failed to reset password.");
    } catch {
      setError("Failed to reset password.");
    } finally {
      setResettingPasswordId(null);
    }
  };

  const handleSetSubscription = async (id: string, action: "pro" | "vip" | "clear", oneDay?: boolean) => {
    setUpdatingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "clear"
            ? JSON.stringify({ action: "clear" })
            : JSON.stringify(
                oneDay
                  ? { action: "set", tier: action, planId: action === "vip" ? "1day" : "1month", months: 0 }
                  : { action: "set", tier: action }
              ),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        if (action === "clear") {
          setSuccessMessage("Subscription cleared.");
        } else if (oneDay) {
          setSuccessMessage(`Granted 1 day ${action === "vip" ? "VIP" : "Pro"}.`);
        } else if (action === "vip") {
          setSuccessMessage("Set to VIP.");
        } else {
          setSuccessMessage("Set to Pro.");
        }
        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        setError(data.error ?? "Failed to update subscription");
      }
    } catch {
      setError("Failed to update subscription");
    } finally {
      setUpdatingId(null);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to view customers."}
            {!session && (
              <p className="mt-2">
                <Link href="/signin" className="underline">Sign in</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-[1400px] mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <div className="flex flex-wrap gap-4 mb-4">
          <Link href="/admin" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Nova Admin hub
          </Link>
          <Link href="/admin/insights" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            App Insights
          </Link>
          <Link href="/admin/wallet-tracker" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Wallet Tracker settings
          </Link>
          <Link href="/admin/ai-feedback" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            AI Feedback
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Total customers</p>
              <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{metrics.total}</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Active subscriptions</p>
              <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{metrics.active}</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Active VIP</p>
              <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">{metrics.vipActive}</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardContent className="py-3">
              <p className="text-xs text-muted-foreground">Active Pro</p>
              <p className="text-2xl font-semibold text-cyan-600 dark:text-cyan-400">{metrics.proActive}</p>
            </CardContent>
          </Card>
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Nova Admin — Customers</CardTitle>
            <p className="text-sm text-muted-foreground">Registered users and subscription status. Only visible to owners (OWNER_EMAIL).</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone, country"
                className="w-full sm:w-80 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setActiveOnly((v) => !v)}
                className={`text-xs font-medium px-3 py-2 rounded border ${
                  activeOnly
                    ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {activeOnly ? "Showing active only" : "Show active only"}
              </button>
              <span className="text-xs text-muted-foreground">
                Showing {filteredCustomers.length} of {customers.length}
              </span>
            </div>
            {successMessage && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2 mb-4">
                {successMessage}
              </div>
            )}
            {error && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2 mb-4">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <div
                ref={customersTableScrollRef}
                className="overflow-auto max-h-[72vh] scroll-smooth rounded-md border border-zinc-200 dark:border-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-100 dark:focus-visible:ring-offset-zinc-950"
                tabIndex={0}
                role="region"
                aria-label="Customers table: when focus is inside this area (click a row or tab here), arrow keys scroll the table; Shift for larger steps. Page Up and Page Down move by one viewport."
              >
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="sticky top-0 z-10 bg-zinc-100/95 dark:bg-zinc-900/95 backdrop-blur">
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
                      <th className="pb-2 pr-4 font-semibold">Name</th>
                      <th className="pb-2 pr-4 font-semibold">Email</th>
                      <th className="pb-2 pr-4 font-semibold">Phone</th>
                      <th className="pb-2 pr-4 font-semibold">Country</th>
                      <th className="pb-2 pr-4 font-semibold">Experience</th>
                      <th className="pb-2 pr-4 font-semibold">Plan</th>
                      <th className="pb-2 pr-4 font-semibold">Expires</th>
                      <th className="pb-2 pr-4 font-semibold">Status</th>
                      <th className="pb-2 pr-4 font-semibold">Trading Bot (On demand)</th>
                      <th className="pb-2 pr-4 font-semibold">Nova Polymarket Bot (On demand)</th>
                      <th className="pb-2 pr-4 font-semibold">Nova Prop Firm Bot (On demand)</th>
                      <th className="pb-2 pr-4 font-semibold">Nova Ultimate (On demand)</th>
                      <th className="pb-2 pr-4 font-semibold">CT Scan (On demand)</th>
                      <th className="pb-2 pr-4 font-semibold">Meme Coins Trader (On demand)</th>
                      <th className="pb-2 pr-4 font-semibold">Email digest</th>
                      <th className="pb-2 pr-4 font-semibold">NovaConnect</th>
                      <th className="pb-2 pr-4 font-semibold">Allow NovaConnect</th>
                      <th className="pb-2 pr-4 font-semibold">Coach user</th>
                      <th className="pb-2 pr-4 font-semibold">Rules accepted</th>
                      <th className="pb-2 pr-4 font-semibold">Payment terms</th>
                      <th className="pb-2 pr-4 font-semibold">Payments</th>
                      <th className="pb-2 pr-4 font-semibold">Community rep</th>
                      <th className="pb-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => (
                      <Fragment key={c.id}>
                      <tr className="border-b border-zinc-100 dark:border-zinc-800/60">
                        <td className="py-2 pr-4">{c.name ?? "—"}</td>
                        <td className="py-2 pr-4">{c.email ?? "—"}</td>
                        <td className="py-2 pr-4">{c.phone ?? "—"}</td>
                        <td className="py-2 pr-4">{c.country ?? "—"}</td>
                        <td className="py-2 pr-4">{c.experienceTradingCrypto ?? "—"}</td>
                        <td className="py-2 pr-4">{c.subscriptionTier ? `${c.subscriptionTier} · ${c.subscriptionPlan ?? ""}` : c.subscriptionPlan ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {c.subscriptionExpiresAt
                            ? new Date(c.subscriptionExpiresAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          {c.isActive ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                          ) : (
                            <span className="text-zinc-500">Expired / None</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => handleTradingBotOnDemand(c.id, !c.tradingBotOnDemand)}
                            disabled={togglingOnDemandId === c.id}
                            className={`text-xs font-medium px-2 py-1 rounded ${c.tradingBotOnDemand ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                          >
                            {togglingOnDemandId === c.id ? "…" : c.tradingBotOnDemand ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => handlePolymarketBotOnDemand(c.id, !c.polymarketBotOnDemand)}
                            disabled={togglingPolymarketOnDemandId === c.id}
                            className={`text-xs font-medium px-2 py-1 rounded ${c.polymarketBotOnDemand ? "bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                          >
                            {togglingPolymarketOnDemandId === c.id ? "…" : c.polymarketBotOnDemand ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => handlePropFirmBotOnDemand(c.id, !c.propFirmBotOnDemand)}
                            disabled={togglingPropFirmOnDemandId === c.id}
                            className={`text-xs font-medium px-2 py-1 rounded ${c.propFirmBotOnDemand ? "bg-orange-100 dark:bg-orange-900/50 text-orange-900 dark:text-orange-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                            title="VIP: Nova Prop Firm Bot"
                          >
                            {togglingPropFirmOnDemandId === c.id ? "…" : c.propFirmBotOnDemand ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => handleNovaUltimateOnDemand(c.id, !c.novaUltimateOnDemand)}
                            disabled={togglingNovaUltimateOnDemandId === c.id}
                            className={`text-xs font-medium px-2 py-1 rounded ${c.novaUltimateOnDemand ? "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-900 dark:text-cyan-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                            title="VIP: Nova Ultimate (NovaMeme Sniper + Phantom Terminal)"
                          >
                            {togglingNovaUltimateOnDemandId === c.id ? "…" : c.novaUltimateOnDemand ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-col gap-1">
                            <select
                              value={ctOnDemandDurationById[c.id] ?? "subscription"}
                              onChange={(e) => setCtOnDemandDurationById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              disabled={togglingCtScanOnDemandId === c.id}
                              className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                              title="Default expiry when enabling CT Scan on-demand"
                            >
                              <option value="subscription">End of subscription</option>
                              <option value="1day">1 day</option>
                              <option value="5days">5 days</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleCtScanOnDemand(c.id, !c.ctScanOnDemand, c.subscriptionExpiresAt)}
                              disabled={togglingCtScanOnDemandId === c.id}
                              className={`text-xs font-medium px-2 py-1 rounded ${c.ctScanOnDemand ? "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                              title="Allow VIP access to CT Scan on request"
                            >
                              {togglingCtScanOnDemandId === c.id ? "…" : c.ctScanOnDemand ? "On" : "Off"}
                            </button>
                            {c.ctScanOnDemand && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatExpiryLabel(c.ctScanOnDemandExpiresAt, c.subscriptionExpiresAt)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-col gap-1">
                            <select
                              value={memeOnDemandDurationById[c.id] ?? "subscription"}
                              onChange={(e) => setMemeOnDemandDurationById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              disabled={togglingMemeCoinsTraderOnDemandId === c.id}
                              className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                              title="Default expiry when enabling Meme Coins Traders on-demand"
                            >
                              <option value="subscription">End of subscription</option>
                              <option value="1day">1 day</option>
                              <option value="5days">5 days</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleMemeCoinsTraderOnDemand(c.id, !c.memeCoinsTraderOnDemand, c.subscriptionExpiresAt)}
                              disabled={togglingMemeCoinsTraderOnDemandId === c.id}
                              className={`text-xs font-medium px-2 py-1 rounded ${c.memeCoinsTraderOnDemand ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                              title="Allow VIP access to Meme Coins Traders on request"
                            >
                              {togglingMemeCoinsTraderOnDemandId === c.id ? "…" : c.memeCoinsTraderOnDemand ? "On" : "Off"}
                            </button>
                            {c.memeCoinsTraderOnDemand && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatExpiryLabel(c.memeCoinsTraderOnDemandExpiresAt, c.subscriptionExpiresAt)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          {c.email ? (
                            <button
                              type="button"
                              onClick={() => handleNewsletterToggle(c.id, !c.newsletterOptIn)}
                              disabled={togglingNewsletterId === c.id}
                              className={`text-xs font-medium px-2 py-1 rounded ${c.newsletterOptIn ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                              title="Newsletter / digest email"
                            >
                              {togglingNewsletterId === c.id ? "…" : c.newsletterOptIn ? "On" : "Off"}
                            </button>
                          ) : (
                            <span className="text-zinc-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => handleNovaConnectToggle(c.id, !c.novaConnectEnabled)}
                            disabled={togglingNovaConnectId === c.id}
                            className={`text-xs font-medium px-2 py-1 rounded ${c.novaConnectEnabled ? "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                            title="Enable or disable NovaConnect for this user"
                          >
                            {togglingNovaConnectId === c.id ? "…" : c.novaConnectEnabled ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => handleAllowNovaConnectToggle(c.id, !c.novaConnectAllowedByAdmin)}
                            disabled={togglingAllowedByAdminId === c.id}
                            className={`text-xs font-medium px-2 py-1 rounded ${c.novaConnectAllowedByAdmin ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                            title="Allow online list & DMs even if not Pro/VIP"
                          >
                            {togglingAllowedByAdminId === c.id ? "…" : c.novaConnectAllowedByAdmin ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => handleCoachUserToggle(c.id, !c.coachUser)}
                            disabled={togglingCoachUserId === c.id}
                            className={`text-xs font-medium px-2 py-1 rounded ${c.coachUser ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                            title="Coach user gets VIP access and can publish Coach Calls (no admin access)"
                          >
                            {togglingCoachUserId === c.id ? "…" : c.coachUser ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-col gap-0.5">
                            {c.novaConnectRulesAcceptedAt ? (
                              <span className="text-xs text-emerald-700 dark:text-emerald-300">
                                Yes · {new Date(c.novaConnectRulesAcceptedAt).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-500">No</span>
                            )}
                            {!c.novaConnectRulesAcceptedAt && (
                              <button
                                type="button"
                                onClick={() => handleAcceptRules(c.id, true)}
                                disabled={acceptingRulesId === c.id}
                                className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-50 text-left"
                                title="Mark as accepted so user can use NovaConnect without accepting in app"
                              >
                                {acceptingRulesId === c.id ? "…" : "Accept for user"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          {c.paymentTermsAcceptedAt ? (
                            <span className="text-xs text-emerald-700 dark:text-emerald-300">
                              Yes · {new Date(c.paymentTermsAcceptedAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500">No</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-col gap-0.5">
                            {Array.isArray(c.payments) && c.payments.length > 0 ? (
                              <>
                                <span className="text-xs text-zinc-700 dark:text-zinc-300">
                                  {c.payments.length} payment{c.payments.length !== 1 ? "s" : ""} · ${c.payments.reduce((s, p) => s + p.amountUsd, 0)} total
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPaymentsExpandedId(paymentsExpandedId === c.id ? null : c.id)}
                                  className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline text-left"
                                >
                                  {paymentsExpandedId === c.id ? "Hide" : "View"}
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-zinc-500">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => handleCommunityRepToggle(c.id, !c.novaConnectCommunityRep)}
                            disabled={togglingCommunityRepId === c.id}
                            className={`text-xs font-medium px-2 py-1 rounded ${c.novaConnectCommunityRep ? "bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                            title="Can delete community posts"
                          >
                            {togglingCommunityRepId === c.id ? "…" : c.novaConnectCommunityRep ? "On" : "Off"}
                          </button>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onClick={() => handleSetSubscription(c.id, "pro")}
                              disabled={updatingId === c.id}
                              className="text-xs text-cyan-700 dark:text-cyan-300 hover:underline disabled:opacity-50 text-left"
                            >
                              {updatingId === c.id ? "Updating…" : "Set Pro"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetSubscription(c.id, "vip")}
                              disabled={updatingId === c.id}
                              className="text-xs text-amber-700 dark:text-amber-300 hover:underline disabled:opacity-50 text-left"
                            >
                              {updatingId === c.id ? "Updating…" : "Set VIP"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetSubscription(c.id, "pro", true)}
                              disabled={updatingId === c.id}
                              className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-50 text-left"
                              title="Grant 1 day Pro access"
                            >
                              {updatingId === c.id ? "…" : "Grant 1 day Pro"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetSubscription(c.id, "vip", true)}
                              disabled={updatingId === c.id}
                              className="text-xs text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 text-left"
                              title="Grant 1 day VIP access"
                            >
                              {updatingId === c.id ? "…" : "Grant 1 day VIP"}
                            </button>
                            {c.isActive && (
                              <button
                                type="button"
                                onClick={() => handleSetSubscription(c.id, "clear")}
                                disabled={updatingId === c.id}
                                className="text-xs text-zinc-600 dark:text-zinc-400 hover:underline disabled:opacity-50 text-left"
                              >
                                {updatingId === c.id ? "Updating…" : "Clear subscription"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleResetPassword(c.id, c.email)}
                              disabled={resettingPasswordId === c.id}
                              className="text-xs text-zinc-700 dark:text-zinc-300 hover:underline disabled:opacity-50 text-left"
                              title={c.email ? "Set a new password for this customer" : "Only for email accounts"}
                            >
                              {resettingPasswordId === c.id ? "Resetting…" : "Reset password"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              disabled={deletingId === c.id}
                              className="text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50 text-left"
                            >
                              {deletingId === c.id ? "Deleting…" : "Delete user"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {paymentsExpandedId === c.id && Array.isArray(c.payments) && c.payments.length > 0 && (
                        <tr key={`${c.id}-payments`} className="bg-zinc-50 dark:bg-zinc-900/50">
                          <td colSpan={TABLE_COL_COUNT} className="py-3 px-4">
                            <div className="text-xs">
                              <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-2">Payment history</p>
                              <table className="w-full max-w-2xl border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
                                <thead>
                                  <tr className="bg-zinc-100 dark:bg-zinc-800">
                                    <th className="text-left py-1.5 px-2">Date</th>
                                    <th className="text-left py-1.5 px-2">Amount</th>
                                    <th className="text-left py-1.5 px-2">Method</th>
                                    <th className="text-left py-1.5 px-2">Tier · Plan</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.payments.map((p, i) => (
                                    <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                                      <td className="py-1.5 px-2">{new Date(p.date).toLocaleString()}</td>
                                      <td className="py-1.5 px-2">${p.amountUsd} USD</td>
                                      <td className="py-1.5 px-2">{p.method === "card" ? "Card" : p.method === "usdc" ? "USDC" : "Other"}</td>
                                      <td className="py-1.5 px-2">{(p.tier ?? "—").toUpperCase()} · {p.plan}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                {filteredCustomers.length === 0 && !error && <p className="py-6 px-4 text-muted-foreground">No matching customers.</p>}
              </div>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline">Back to app</Link>
        </p>
      </div>
    </div>
  );
}
