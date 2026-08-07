"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import CustomerExpandedPanel from "@/components/admin/CustomerExpandedPanel";
import { canViewAdminCustomersSession } from "@/lib/admin-access";
import { ADMIN_VIP_QUICK_GRANTS, grantLabel, type AdminVipGrantId } from "@/lib/admin-vip-grant";

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
  registeredCountry?: string | null;
  registeredCity?: string | null;
  experienceTradingCrypto: string | null;
  tradingBotOnDemand: boolean;
  polymarketBotOnDemand: boolean;
  propFirmBotOnDemand: boolean;
  novaUltimateOnDemand: boolean;
  novaJobAgentOnDemand: boolean;
  ctScanOnDemand: boolean;
  ctScanOnDemandExpiresAt: string | null;
  memeCoinsTraderOnDemand: boolean;
  memeCoinsTraderOnDemandExpiresAt: string | null;
  newsletterOptIn: boolean;
  novaConnectEnabled: boolean;
  novaConnectCommunityRep: boolean;
  novaConnectAllowedByAdmin: boolean;
  coachUser: boolean;
  customersViewerAdmin: boolean;
  supportViewerAdmin: boolean;
  liveChatAgentAdmin: boolean;
  supportStaffName: string | null;
  aiAgentDailyLimitOverride: number | null;
  aiAgentWeeklyLimitOverride: number | null;
  aiAgentMonthlyLimitOverride: number | null;
  aiChartAnalysisDailyLimitOverride: number | null;
  aiChartAnalysisWeeklyLimitOverride: number | null;
  aiChartAnalysisMonthlyLimitOverride: number | null;
  novaConnectRulesAcceptedAt: string | null;
  paymentTermsAcceptedAt: string | null;
  createdAt: string;
  twoFactorMethod?: string | null;
  subscriptionTier: string | null;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  isActive: boolean;
  subscriptionAutoRenew?: boolean;
  subscriptionCancelAtPeriodEnd?: boolean;
  hasStripeSubscription?: boolean;
  stripeSubscriptionActive?: boolean;
  payments: Payment[];
  loginMultiLocation?: boolean;
  loginDistinctCountries?: number;
  usedAndroidApp?: boolean;
  recentLogins?: import("@/components/admin/CustomerExpandedPanel").AdminCustomerLoginEvent[];
};

function customerHasOnDemand(c: Customer, includePropFirm: boolean) {
  return (
    c.tradingBotOnDemand ||
    c.polymarketBotOnDemand ||
    (includePropFirm && c.propFirmBotOnDemand) ||
    c.novaUltimateOnDemand ||
    c.novaJobAgentOnDemand ||
    c.ctScanOnDemand ||
    c.memeCoinsTraderOnDemand
  );
}

function registrationLocalParts(createdAt: string): { y: number; m: number; d: number } | null {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

function matchesRegistrationFilter(createdAt: string, month: string, date: string): boolean {
  const parts = registrationLocalParts(createdAt);
  if (!parts) return false;
  if (date) {
    const [y, m, d] = date.split("-").map(Number);
    return parts.y === y && parts.m === m && parts.d === d;
  }
  if (month) {
    const [y, m] = month.split("-").map(Number);
    return parts.y === y && parts.m === m;
  }
  return true;
}

function registrationPeriodLabel(month: string, date: string): string | null {
  if (date) {
    const d = new Date(`${date}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
    }
  }
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
  }
  return null;
}

export default function AdminCustomersPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const readOnly = !isOwner;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [registrationMonth, setRegistrationMonth] = useState("");
  const [registrationDate, setRegistrationDate] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [onDemandOnly, setOnDemandOnly] = useState(false);
  const [newsletterOnly, setNewsletterOnly] = useState(false);
  const [multiLocationOnly, setMultiLocationOnly] = useState(false);
  const [androidAppOnly, setAndroidAppOnly] = useState(false);
  const [showLegacyOnDemand, setShowLegacyOnDemand] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [togglingOnDemandId, setTogglingOnDemandId] = useState<string | null>(null);
  const [togglingPolymarketOnDemandId, setTogglingPolymarketOnDemandId] = useState<string | null>(null);
  const [togglingPropFirmOnDemandId, setTogglingPropFirmOnDemandId] = useState<string | null>(null);
  const [togglingNovaUltimateOnDemandId, setTogglingNovaUltimateOnDemandId] = useState<string | null>(null);
  const [togglingNovaJobAgentOnDemandId, setTogglingNovaJobAgentOnDemandId] = useState<string | null>(null);
  const [togglingCtScanOnDemandId, setTogglingCtScanOnDemandId] = useState<string | null>(null);
  const [togglingMemeCoinsTraderOnDemandId, setTogglingMemeCoinsTraderOnDemandId] = useState<string | null>(null);
  const [ctOnDemandDurationById, setCtOnDemandDurationById] = useState<Record<string, string>>({});
  const [memeOnDemandDurationById, setMemeOnDemandDurationById] = useState<Record<string, string>>({});
  const [togglingNewsletterId, setTogglingNewsletterId] = useState<string | null>(null);
  const [togglingNovaConnectId, setTogglingNovaConnectId] = useState<string | null>(null);
  const [togglingCommunityRepId, setTogglingCommunityRepId] = useState<string | null>(null);
  const [togglingAllowedByAdminId, setTogglingAllowedByAdminId] = useState<string | null>(null);
  const [togglingCoachUserId, setTogglingCoachUserId] = useState<string | null>(null);
  const [togglingCustomersViewerAdminId, setTogglingCustomersViewerAdminId] = useState<string | null>(null);
  const [togglingSupportViewerAdminId, setTogglingSupportViewerAdminId] = useState<string | null>(null);
  const [togglingLiveChatAgentAdminId, setTogglingLiveChatAgentAdminId] = useState<string | null>(null);
  const [savingSupportStaffNameId, setSavingSupportStaffNameId] = useState<string | null>(null);
  const [savingAiAgentLimitsId, setSavingAiAgentLimitsId] = useState<string | null>(null);
  const [acceptingRulesId, setAcceptingRulesId] = useState<string | null>(null);
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [disabling2faId, setDisabling2faId] = useState<string | null>(null);
  const customersTableScrollRef = useRef<HTMLDivElement>(null);
  const TABLE_COL_COUNT = isOwner ? 6 : 5;

  const formatRegistrationDate = (createdAt: string) => {
    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

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
    const newsletter = customers.filter((c) => c.newsletterOptIn && c.email).length;
    const multiLocation = customers.filter((c) => c.loginMultiLocation).length;
    const androidApp = customers.filter((c) => c.usedAndroidApp).length;
    return { total, active, vipActive, newsletter, multiLocation, androidApp };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (activeOnly && !c.isActive) return false;
      if (onDemandOnly && !customerHasOnDemand(c, showLegacyOnDemand)) return false;
      if (newsletterOnly && (!c.newsletterOptIn || !c.email)) return false;
      if (multiLocationOnly && !c.loginMultiLocation) return false;
      if (androidAppOnly && !c.usedAndroidApp) return false;
      if (!matchesRegistrationFilter(c.createdAt, registrationMonth, registrationDate)) return false;
      if (!q) return true;
      if (readOnly) return (c.name ?? "").toLowerCase().includes(q);
      return (
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.country ?? "").toLowerCase().includes(q)
      );
    });
    // Owner: flagged multi-location accounts float to the top so they're obvious.
    if (isOwner) {
      list.sort((a, b) => Number(!!b.loginMultiLocation) - Number(!!a.loginMultiLocation));
    }
    return list;
  }, [
    customers,
    search,
    registrationMonth,
    registrationDate,
    activeOnly,
    onDemandOnly,
    newsletterOnly,
    multiLocationOnly,
    androidAppOnly,
    showLegacyOnDemand,
    readOnly,
    isOwner,
  ]);

  const multiLocationCustomers = useMemo(
    () => customers.filter((c) => c.loginMultiLocation),
    [customers]
  );

  const registrationPeriodActive = !!(registrationMonth || registrationDate);

  const registrationCohort = useMemo(() => {
    if (!registrationPeriodActive) return null;
    return customers.filter((c) => matchesRegistrationFilter(c.createdAt, registrationMonth, registrationDate));
  }, [customers, registrationMonth, registrationDate, registrationPeriodActive]);

  const registrationAnalysis = useMemo(() => {
    if (!registrationCohort) return null;
    const registrations = registrationCohort.length;
    const activeSubscriptions = registrationCohort.filter((c) => c.isActive).length;
    const activeVip = registrationCohort.filter(
      (c) => c.isActive && (c.subscriptionTier === "vip" || c.subscriptionTier === "pro")
    ).length;
    const noActivePlan = registrations - activeSubscriptions;
    const withOnDemand = registrationCohort.filter((c) => customerHasOnDemand(c, showLegacyOnDemand)).length;
    const conversionPct = registrations > 0 ? Math.round((activeSubscriptions / registrations) * 100) : 0;
    const vipConversionPct = registrations > 0 ? Math.round((activeVip / registrations) * 100) : 0;
    return {
      registrations,
      activeSubscriptions,
      activeVip,
      noActivePlan,
      withOnDemand,
      conversionPct,
      vipConversionPct,
      label: registrationPeriodLabel(registrationMonth, registrationDate),
    };
  }, [registrationCohort, registrationMonth, registrationDate, showLegacyOnDemand]);

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

  const handleNovaJobAgentOnDemand = async (id: string, value: boolean) => {
    setTogglingNovaJobAgentOnDemandId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaJobAgentOnDemand: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Nova Jobs Agent enabled." : "Nova Jobs Agent disabled.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update");
    } catch {
      setError("Failed to update");
    } finally {
      setTogglingNovaJobAgentOnDemandId(null);
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

  const handleCustomersViewerAdminToggle = async (id: string, value: boolean) => {
    setTogglingCustomersViewerAdminId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customersViewerAdmin: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Customers viewer admin enabled (read-only)." : "Customers viewer admin removed.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update customers viewer admin");
    } catch {
      setError("Failed to update customers viewer admin");
    } finally {
      setTogglingCustomersViewerAdminId(null);
    }
  };

  const handleSupportViewerAdminToggle = async (id: string, value: boolean) => {
    setTogglingSupportViewerAdminId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportViewerAdmin: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Support tickets admin enabled." : "Support tickets admin removed.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update support admin");
    } catch {
      setError("Failed to update support admin");
    } finally {
      setTogglingSupportViewerAdminId(null);
    }
  };

  const handleLiveChatAgentAdminToggle = async (id: string, value: boolean) => {
    setTogglingLiveChatAgentAdminId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveChatAgentAdmin: value }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(value ? "Live chat agent enabled." : "Live chat agent removed.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update live chat agent");
    } catch {
      setError("Failed to update live chat agent");
    } finally {
      setTogglingLiveChatAgentAdminId(null);
    }
  };

  const handleSupportStaffNameSave = async (id: string, value: string) => {
    setSavingSupportStaffNameId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportStaffName: value || null }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage("Support staff name saved.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to save support staff name");
    } catch {
      setError("Failed to save support staff name");
    } finally {
      setSavingSupportStaffNameId(null);
    }
  };

  const handleAiAgentLimitsSave = async (
    id: string,
    patch: import("@/components/admin/CustomerExpandedPanel").AiAgentLimitsPatch
  ) => {
    setSavingAiAgentLimitsId(id);
    setError("");
    try {
      const body: Record<string, number | null> = {};
      if (patch.memeDaily !== undefined) body.aiAgentDailyLimitOverride = patch.memeDaily;
      if (patch.memeWeekly !== undefined) body.aiAgentWeeklyLimitOverride = patch.memeWeekly;
      if (patch.memeMonthly !== undefined) body.aiAgentMonthlyLimitOverride = patch.memeMonthly;
      if (patch.chartDaily !== undefined) body.aiChartAnalysisDailyLimitOverride = patch.chartDaily;
      if (patch.chartWeekly !== undefined) body.aiChartAnalysisWeeklyLimitOverride = patch.chartWeekly;
      if (patch.chartMonthly !== undefined) body.aiChartAnalysisMonthlyLimitOverride = patch.chartMonthly;
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage("AI Agent limits updated.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else setError(data.error ?? "Failed to update AI Agent limits");
    } catch {
      setError("Failed to update AI Agent limits");
    } finally {
      setSavingAiAgentLimitsId(null);
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

  const handleDisable2fa = async (id: string, email: string | null, method: string | null | undefined) => {
    const label = email ?? id;
    const methodLabel = method === "email" ? "email codes" : method === "totp" ? "authenticator app" : "2FA";
    if (
      !window.confirm(
        `Disable ${methodLabel} for ${label}?\n\nThey will be able to sign in with password only. Ask them to re-enable 2FA after they regain access.`
      )
    ) {
      return;
    }
    setDisabling2faId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}/disable-2fa`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage(data.message ?? "2FA disabled.");
        setTimeout(() => setSuccessMessage(""), 5000);
      } else setError(data.error ?? "Failed to disable 2FA.");
    } catch {
      setError("Failed to disable 2FA.");
    } finally {
      setDisabling2faId(null);
    }
  };

  const handleGrantVip = async (id: string, grant: AdminVipGrantId) => {
    setUpdatingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant", grant }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        const extended = data.subscription?.extendedFromExisting ? " (extended)" : "";
        setSuccessMessage(`Granted ${data.grantLabel ?? grantLabel(grant)} VIP${extended}.`);
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

  const handleClearSubscription = async (id: string) => {
    setUpdatingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        setSuccessMessage("VIP cancelled — access revoked immediately.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        setError(data.error ?? "Failed to cancel subscription");
      }
    } catch {
      setError("Failed to cancel subscription");
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

  if (!canViewAdminCustomersSession(session)) {
    return (
      <Card className="w-full max-w-4xl border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-8 text-center text-muted-foreground">
          Not authorized to view customers.
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
    if (c.novaJobAgentOnDemand) chips.push({ label: "Jobs Agent", className: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200" });
    if (c.ctScanOnDemand) chips.push({ label: "CT Scan", className: "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-800 dark:text-cyan-200" });
    if (c.memeCoinsTraderOnDemand) chips.push({ label: "Meme wallets", className: "bg-amber-100 dark:bg-amber-900/40 text-slate-700 dark:text-slate-200" });
    return chips;
  };

  return (
    <div className="max-w-[1400px]">
      <AdminPageHeader
        title="Customers"
        description={
          readOnly
            ? "View customer names, subscriptions, and on-demand access."
            : "Registered users, subscriptions, and on-demand VIP access."
        }
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
          {isOwner && (
            <Card
              className={
                metrics.multiLocation > 0
                  ? "border-amber-400 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-950/30"
                  : "border-zinc-200 dark:border-zinc-800"
              }
            >
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Multi-location flags</p>
                <p
                  className={`text-2xl font-semibold ${
                    metrics.multiLocation > 0
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {metrics.multiLocation}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {isOwner && metrics.multiLocation > 0 && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-amber-400/80 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-4 py-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  {metrics.multiLocation} customer{metrics.multiLocation === 1 ? "" : "s"} signed in from different
                  locations
                </p>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-0.5">
                  Possible credential sharing (or travel/VPN). Review highlighted rows — expand for recent sign-ins.
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-amber-950 dark:text-amber-100">
                  {multiLocationCustomers.slice(0, 8).map((c) => (
                    <li key={c.id} className="truncate">
                      <button
                        type="button"
                        className="underline font-medium hover:no-underline text-left"
                        onClick={() => {
                          setMultiLocationOnly(true);
                          setExpandedCustomerId(c.id);
                          setSearch("");
                        }}
                      >
                        {c.name || c.email || c.id}
                      </button>
                      {c.email && c.name ? (
                        <span className="text-amber-800/70 dark:text-amber-200/60"> · {c.email}</span>
                      ) : null}
                      {c.isActive ? (
                        <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                          VIP/active
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {multiLocationCustomers.length > 8 && (
                    <li className="text-amber-800/70 dark:text-amber-200/60">
                      +{multiLocationCustomers.length - 8} more
                    </li>
                  )}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setMultiLocationOnly(true)}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Show flagged only
                </button>
                {multiLocationOnly && (
                  <button
                    type="button"
                    onClick={() => setMultiLocationOnly(false)}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={readOnly ? "Search name" : "Search name, email, phone, country"}
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
                onClick={() => setNewsletterOnly((v) => !v)}
                className={`text-xs font-medium px-3 py-2 rounded border ${
                  newsletterOnly
                    ? "bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200 border-violet-300 dark:border-violet-700"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                }`}
                title="Show only customers opted in to newsletter / email marketing"
              >
                {newsletterOnly ? `Newsletter ✓ (${metrics.newsletter})` : `Newsletter (${metrics.newsletter})`}
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setMultiLocationOnly((v) => !v)}
                  className={`text-xs font-medium px-3 py-2 rounded border ${
                    multiLocationOnly
                      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                  }`}
                  title="Different countries within 48h, or 3+ countries in 30 days"
                >
                  {multiLocationOnly
                    ? `Multi-location ✓ (${metrics.multiLocation})`
                    : `Multi-location (${metrics.multiLocation})`}
                </button>
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setAndroidAppOnly((v) => !v)}
                  className={`text-xs font-medium px-3 py-2 rounded border ${
                    androidAppOnly
                      ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                  }`}
                  title="Signed in via Capacitor Android app or Android device in the last 30 days"
                >
                  {androidAppOnly
                    ? `Android app ✓ (${metrics.androidApp})`
                    : `Android app (${metrics.androidApp})`}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOnDemandOnly((v) => !v)}
                className={`text-xs font-medium px-3 py-2 rounded border ${
                  onDemandOnly
                    ? "bg-amber-100 dark:bg-amber-900/50 text-slate-700 dark:text-slate-200 border-amber-300 dark:border-amber-700"
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
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="whitespace-nowrap">Registered month</span>
                <input
                  type="month"
                  value={registrationMonth}
                  onChange={(e) => {
                    setRegistrationMonth(e.target.value);
                    if (e.target.value) setRegistrationDate("");
                  }}
                  disabled={!!registrationDate}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm disabled:opacity-50"
                  title="Filter by registration month"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <span className="whitespace-nowrap">Registered date</span>
                <input
                  type="date"
                  value={registrationDate}
                  onChange={(e) => {
                    setRegistrationDate(e.target.value);
                    if (e.target.value) setRegistrationMonth("");
                  }}
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm"
                  title="Filter by exact registration date"
                />
              </label>
              {(registrationMonth || registrationDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setRegistrationMonth("");
                    setRegistrationDate("");
                  }}
                  className="text-xs font-medium px-3 py-2 rounded border bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700"
                >
                  Clear date filter
                </button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredCustomers.length} of {customers.length}
                {registrationAnalysis && (
                  <span className="hidden sm:inline">
                    {" "}
                    · {registrationAnalysis.registrations} registered in period
                  </span>
                )}
              </span>
            </div>
            {registrationAnalysis && (
              <div className="mb-4 rounded-lg border border-cyan-200 dark:border-cyan-800/80 bg-cyan-50/60 dark:bg-cyan-950/25 px-4 py-4">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Registration &amp; subscription analysis
                  {registrationAnalysis.label ? (
                    <span className="font-normal text-zinc-600 dark:text-zinc-400"> — {registrationAnalysis.label}</span>
                  ) : null}
                </p>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Registrations</p>
                    <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{registrationAnalysis.registrations}</p>
                  </div>
                  <div className="rounded-md border border-emerald-200/80 dark:border-emerald-800/50 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Active subscriptions</p>
                    <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">{registrationAnalysis.activeSubscriptions}</p>
                    <p className="text-[10px] text-muted-foreground">{registrationAnalysis.conversionPct}% of cohort</p>
                  </div>
                  <div className="rounded-md border border-amber-200/80 dark:border-amber-800/50 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Active VIP</p>
                    <p className="text-xl font-semibold text-amber-600 dark:text-amber-400">{registrationAnalysis.activeVip}</p>
                    <p className="text-[10px] text-muted-foreground">{registrationAnalysis.vipConversionPct}% of cohort</p>
                  </div>
                  <div className="rounded-md border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">No active plan</p>
                    <p className="text-xl font-semibold text-zinc-700 dark:text-zinc-300">{registrationAnalysis.noActivePlan}</p>
                  </div>
                  <div className="rounded-md border border-violet-200/80 dark:border-violet-800/50 bg-white/80 dark:bg-zinc-900/60 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">On-demand access</p>
                    <p className="text-xl font-semibold text-violet-600 dark:text-violet-400">{registrationAnalysis.withOnDemand}</p>
                  </div>
                  <div className="rounded-md border border-cyan-200/80 dark:border-cyan-800/50 bg-white/80 dark:bg-zinc-900/60 px-3 py-2 col-span-2 sm:col-span-1">
                    <p className="text-[11px] text-muted-foreground">Subscription rate</p>
                    <p className="text-xl font-semibold text-cyan-700 dark:text-cyan-300">{registrationAnalysis.conversionPct}%</p>
                    <p className="text-[10px] text-muted-foreground">active / registered</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
                  {registrationAnalysis.activeSubscriptions} of {registrationAnalysis.registrations} customers who registered in this period currently have an active subscription
                  {registrationAnalysis.activeVip > 0
                    ? ` (${registrationAnalysis.activeVip} VIP).`
                    : "."}
                  {filteredCustomers.length !== registrationAnalysis.registrations && (
                    <span>
                      {" "}
                      Table shows {filteredCustomers.length} row{filteredCustomers.length === 1 ? "" : "s"} after other filters.
                    </span>
                  )}
                </p>
              </div>
            )}
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
                      <th className="pb-2 pr-4 font-semibold min-w-[7rem]">Registered</th>
                      <th className="pb-2 pr-4 font-semibold min-w-[9rem]">Subscription</th>
                      <th className="pb-2 pr-4 font-semibold min-w-[10rem]">On-demand</th>
                      {isOwner && <th className="pb-2 font-semibold min-w-[8rem]">Quick actions</th>}
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
                          <tr
                            className={
                              c.loginMultiLocation
                                ? "border-b border-amber-200 dark:border-amber-800/60 bg-amber-50/90 dark:bg-amber-950/35 hover:bg-amber-100/90 dark:hover:bg-amber-950/50"
                                : "border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
                            }
                          >
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
                              {!readOnly && (
                                <>
                                  <p className="text-xs text-muted-foreground break-all">{c.email ?? "—"}</p>
                                  {(c.phone || c.country) && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {[c.phone, c.country].filter(Boolean).join(" · ")}
                                    </p>
                                  )}
                                  {c.usedAndroidApp && (
                                    <p className="mt-1">
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                                        Android app
                                      </span>
                                    </p>
                                  )}
                                  {c.loginMultiLocation && (
                                    <p className="mt-1">
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100">
                                        Multi-location · {c.loginDistinctCountries} countries
                                      </span>
                                    </p>
                                  )}
                                </>
                              )}
                            </td>
                            <td className="py-2 pr-4 align-top text-xs text-muted-foreground whitespace-nowrap">
                              {formatRegistrationDate(c.createdAt)}
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
                              {communityOn && isOwner && (
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1">Community access</p>
                              )}
                            </td>
                            {isOwner && (
                            <td className="py-2 align-top">
                              <div className="flex flex-wrap gap-1">
                                {ADMIN_VIP_QUICK_GRANTS.map((grantId) => {
                                  const label =
                                    grantId === "3day"
                                      ? "+3d VIP"
                                      : grantId === "1week"
                                        ? "+1 wk Free VIP"
                                        : "+1 mo VIP";
                                  return (
                                    <button
                                      key={grantId}
                                      type="button"
                                      onClick={() => handleGrantVip(c.id, grantId)}
                                      disabled={updatingId === c.id}
                                      title={`Grant ${grantLabel(grantId)} VIP (extends from now or current expiry)`}
                                      className={`text-[11px] px-2 py-1 rounded disabled:opacity-50 ${
                                        grantId === "1month"
                                          ? "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-900 dark:text-cyan-100"
                                          : grantId === "1week"
                                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100"
                                            : "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100"
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => setExpandedCustomerId(expanded ? null : c.id)}
                                  className="text-[11px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
                                >
                                  {expanded ? "Less" : "Manage"}
                                </button>
                              </div>
                            </td>
                            )}
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={TABLE_COL_COUNT} className="p-0">
                                <CustomerExpandedPanel
                                  c={c}
                                  readOnly={readOnly}
                                  isOwner={isOwner}
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
                                    jobsAgent: togglingNovaJobAgentOnDemandId === c.id,
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
                                    disable2fa: disabling2faId === c.id,
                                    delete: deletingId === c.id,
                                    customersViewerAdmin: togglingCustomersViewerAdminId === c.id,
                                    supportViewerAdmin: togglingSupportViewerAdminId === c.id,
                                    liveChatAgentAdmin: togglingLiveChatAgentAdminId === c.id,
                                    savingSupportStaffName: savingSupportStaffNameId === c.id,
                                    savingAiAgentLimits: savingAiAgentLimitsId === c.id,
                                  }}
                                  onTradingBot={(v) => handleTradingBotOnDemand(c.id, v)}
                                  onPolymarket={(v) => handlePolymarketBotOnDemand(c.id, v)}
                                  onPropFirm={(v) => handlePropFirmBotOnDemand(c.id, v)}
                                  onUltimate={(v) => handleNovaUltimateOnDemand(c.id, v)}
                                  onJobsAgent={(v) => handleNovaJobAgentOnDemand(c.id, v)}
                                  onCtScan={(v) => handleCtScanOnDemand(c.id, v, c.subscriptionExpiresAt)}
                                  onMemeTrader={(v) => handleMemeCoinsTraderOnDemand(c.id, v, c.subscriptionExpiresAt)}
                                  onNewsletter={(v) => handleNewsletterToggle(c.id, v)}
                                  onNovaConnect={(v) => handleNovaConnectToggle(c.id, v)}
                                  onAllowConnect={(v) => handleAllowNovaConnectToggle(c.id, v)}
                                  onCoach={(v) => handleCoachUserToggle(c.id, v)}
                                  onCommunityRep={(v) => handleCommunityRepToggle(c.id, v)}
                                  onAcceptRules={() => handleAcceptRules(c.id, true)}
                                  onGrantVip={(grant) => handleGrantVip(c.id, grant)}
                                  onClearSubscription={() => handleClearSubscription(c.id)}
                                  onResetPassword={() => handleResetPassword(c.id, c.email)}
                                  onDisable2fa={() => handleDisable2fa(c.id, c.email, c.twoFactorMethod)}
                                  onDelete={() => handleDelete(c.id)}
                                  onCustomersViewerAdmin={(v) => handleCustomersViewerAdminToggle(c.id, v)}
                                  onSupportViewerAdmin={(v) => handleSupportViewerAdminToggle(c.id, v)}
                                  onLiveChatAgentAdmin={(v) => handleLiveChatAgentAdminToggle(c.id, v)}
                                  onSupportStaffNameSave={(v) => handleSupportStaffNameSave(c.id, v)}
                                  onAiAgentLimitsSave={(patch) => handleAiAgentLimitsSave(c.id, patch)}
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
