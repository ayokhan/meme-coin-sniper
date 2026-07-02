"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import CustomerExpandedPanel from "@/components/admin/CustomerExpandedPanel";

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

function customerHasOnDemand(c: Customer, includePropFirm: boolean) {
  return (
    c.tradingBotOnDemand ||
    c.polymarketBotOnDemand ||
    (includePropFirm && c.propFirmBotOnDemand) ||
    c.novaUltimateOnDemand ||
    c.ctScanOnDemand ||
    c.memeCoinsTraderOnDemand
  );
}

export default function AdminCustomersPage() {
  const { data: session, status } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [onDemandOnly, setOnDemandOnly] = useState(false);
  const [showLegacyOnDemand, setShowLegacyOnDemand] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
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
  const customersTableScrollRef = useRef<HTMLDivElement>(null);
  const TABLE_COL_COUNT = 5;

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
    const vipActive = customers.filter((c) => c.isActive && (c.subscriptionTier === "vip" || c.subscriptionTier === "pro")).length;
    return { total, active, vipActive };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (activeOnly && !c.isActive) return false;
      if (onDemandOnly && !customerHasOnDemand(c, showLegacyOnDemand)) return false;
      if (!q) return true;
      return (
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.country ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, search, activeOnly, onDemandOnly, showLegacyOnDemand]);

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
        setSuccessMessage(value ? "Nova Prop Firm Challenge enabled." : "Nova Prop Firm Challenge disabled.");
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

  const handleSetSubscription = async (id: string, action: "vip" | "clear", oneDay?: boolean) => {
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
                  ? { action: "set", months: 0 }
                  : { action: "set" }
              ),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        if (action === "clear") {
          setSuccessMessage("Subscription cleared.");
        } else if (oneDay) {
          setSuccessMessage("Granted 1 day VIP.");
        } else {
          setSuccessMessage("Set to VIP.");
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
      <Card className="w-full max-w-4xl border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-8 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to view customers."}
          {!session && (
            <p className="mt-2">
              <Link href="/signin" className="underline">Sign in</Link>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const onDemandLabels = (c: Customer) => {
    const chips: { label: string; className: string }[] = [];
    if (c.tradingBotOnDemand) chips.push({ label: "Bot", className: "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200" });
    if (c.polymarketBotOnDemand) chips.push({ label: "Polymarket", className: "bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-200" });
    if (showLegacyOnDemand && c.propFirmBotOnDemand) chips.push({ label: "Prop firm", className: "bg-orange-100 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200" });
    if (c.novaUltimateOnDemand) chips.push({ label: "Ultimate", className: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-200" });
    if (c.ctScanOnDemand) chips.push({ label: "CT Scan", className: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200" });
    if (c.memeCoinsTraderOnDemand) chips.push({ label: "Meme wallets", className: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200" });
    return chips;
  };

  return (
    <div className="max-w-[1400px]">
      <AdminPageHeader
        title="Customers"
        description="Registered users, subscriptions, and on-demand VIP access. Owner only (OWNER_EMAIL)."
      />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardContent className="pt-6">
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
                {activeOnly ? "Active only ✓" : "Active only"}
              </button>
              <button
                type="button"
                onClick={() => setOnDemandOnly((v) => !v)}
                className={`text-xs font-medium px-3 py-2 rounded border ${
                  onDemandOnly
                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {onDemandOnly ? "On-demand ✓" : "On-demand enabled"}
              </button>
              <button
                type="button"
                onClick={() => setShowLegacyOnDemand((v) => !v)}
                className={`text-xs font-medium px-3 py-2 rounded border ${
                  showLegacyOnDemand
                    ? "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                }`}
                title="Show Nova Prop Firm Challenge toggles (legacy)"
              >
                {showLegacyOnDemand ? "Legacy: Prop firm shown" : "Show legacy prop firm"}
              </button>
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredCustomers.length} of {customers.length}
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
                aria-label="Customers table. Expand a row for on-demand toggles and account actions."
              >
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-zinc-100/95 dark:bg-zinc-900/95 backdrop-blur">
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left">
                      <th className="pb-2 pr-3 font-semibold w-8" aria-label="Expand" />
                      <th className="pb-2 pr-4 font-semibold min-w-[12rem]">Customer</th>
                      <th className="pb-2 pr-4 font-semibold min-w-[9rem]">Subscription</th>
                      <th className="pb-2 pr-4 font-semibold min-w-[10rem]">On-demand</th>
                      <th className="pb-2 font-semibold min-w-[8rem]">Quick actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => {
                      const expanded = expandedCustomerId === c.id;
                      const chips = onDemandLabels(c);
                      const communityOn =
                        c.novaConnectEnabled || c.novaConnectAllowedByAdmin || c.coachUser || c.novaConnectCommunityRep;
                      return (
                        <Fragment key={c.id}>
                          <tr className="border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                            <td className="py-2 pr-2 align-top">
                              <button
                                type="button"
                                onClick={() => setExpandedCustomerId(expanded ? null : c.id)}
                                className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                                aria-expanded={expanded}
                                aria-label={expanded ? "Collapse details" : "Expand details"}
                              >
                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            </td>
                            <td className="py-2 pr-4 align-top">
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.name ?? "—"}</p>
                              <p className="text-xs text-muted-foreground break-all">{c.email ?? "—"}</p>
                              {(c.phone || c.country) && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {[c.phone, c.country].filter(Boolean).join(" · ")}
                                </p>
                              )}
                            </td>
                            <td className="py-2 pr-4 align-top">
                              {c.subscriptionTier ? (
                                <span
                                  className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${
                                    c.subscriptionTier === "vip"
                                      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200"
                                      : "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-900 dark:text-cyan-200"
                                  }`}
                                >
                                  {c.subscriptionTier.toUpperCase()}
                                  {c.subscriptionPlan ? ` · ${c.subscriptionPlan}` : ""}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-500">No plan</span>
                              )}
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {c.subscriptionExpiresAt
                                  ? `Expires ${new Date(c.subscriptionExpiresAt).toLocaleDateString()}`
                                  : "No expiry"}
                              </p>
                              <p className="text-[11px] mt-0.5">
                                {c.isActive ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active</span>
                                ) : (
                                  <span className="text-zinc-500">Expired / none</span>
                                )}
                              </p>
                            </td>
                            <td className="py-2 pr-4 align-top">
                              {chips.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {chips.map((chip) => (
                                    <span key={chip.label} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${chip.className}`}>
                                      {chip.label}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-500">None</span>
                              )}
                              {communityOn && (
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1">Community access</p>
                              )}
                            </td>
                            <td className="py-2 align-top">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleSetSubscription(c.id, "vip")}
                                  disabled={updatingId === c.id}
                                  className="text-[11px] px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 disabled:opacity-50"
                                >
                                  VIP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedCustomerId(expanded ? null : c.id)}
                                  className="text-[11px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                                >
                                  {expanded ? "Less" : "Manage"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={TABLE_COL_COUNT} className="p-0">
                                <CustomerExpandedPanel
                                  c={c}
                                  showLegacyOnDemand={showLegacyOnDemand}
                                  formatExpiryLabel={formatExpiryLabel}
                                  ctDuration={ctOnDemandDurationById[c.id] ?? "subscription"}
                                  onCtDurationChange={(v) => setCtOnDemandDurationById((prev) => ({ ...prev, [c.id]: v }))}
                                  memeDuration={memeOnDemandDurationById[c.id] ?? "subscription"}
                                  onMemeDurationChange={(v) => setMemeOnDemandDurationById((prev) => ({ ...prev, [c.id]: v }))}
                                  busy={{
                                    tradingBot: togglingOnDemandId === c.id,
                                    polymarket: togglingPolymarketOnDemandId === c.id,
                                    propFirm: togglingPropFirmOnDemandId === c.id,
                                    ultimate: togglingNovaUltimateOnDemandId === c.id,
                                    ctScan: togglingCtScanOnDemandId === c.id,
                                    memeTrader: togglingMemeCoinsTraderOnDemandId === c.id,
                                    newsletter: togglingNewsletterId === c.id,
                                    novaConnect: togglingNovaConnectId === c.id,
                                    allowConnect: togglingAllowedByAdminId === c.id,
                                    coach: togglingCoachUserId === c.id,
                                    communityRep: togglingCommunityRepId === c.id,
                                    rules: acceptingRulesId === c.id,
                                    subscription: updatingId === c.id,
                                    resetPassword: resettingPasswordId === c.id,
                                    delete: deletingId === c.id,
                                  }}
                                  onTradingBot={(v) => handleTradingBotOnDemand(c.id, v)}
                                  onPolymarket={(v) => handlePolymarketBotOnDemand(c.id, v)}
                                  onPropFirm={(v) => handlePropFirmBotOnDemand(c.id, v)}
                                  onUltimate={(v) => handleNovaUltimateOnDemand(c.id, v)}
                                  onCtScan={(v) => handleCtScanOnDemand(c.id, v, c.subscriptionExpiresAt)}
                                  onMemeTrader={(v) => handleMemeCoinsTraderOnDemand(c.id, v, c.subscriptionExpiresAt)}
                                  onNewsletter={(v) => handleNewsletterToggle(c.id, v)}
                                  onNovaConnect={(v) => handleNovaConnectToggle(c.id, v)}
                                  onAllowConnect={(v) => handleAllowNovaConnectToggle(c.id, v)}
                                  onCoach={(v) => handleCoachUserToggle(c.id, v)}
                                  onCommunityRep={(v) => handleCommunityRepToggle(c.id, v)}
                                  onAcceptRules={() => handleAcceptRules(c.id, true)}
                                  onSetVip={() => handleSetSubscription(c.id, "vip")}
                                  onGrant1DayVip={() => handleSetSubscription(c.id, "vip", true)}
                                  onClearSubscription={() => handleSetSubscription(c.id, "clear")}
                                  onResetPassword={() => handleResetPassword(c.id, c.email)}
                                  onDelete={() => handleDelete(c.id)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {filteredCustomers.length === 0 && !error && <p className="py-6 px-4 text-muted-foreground">No matching customers.</p>}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
