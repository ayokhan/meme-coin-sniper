"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  experienceTradingCrypto: string | null;
  tradingBotOnDemand: boolean;
  newsletterOptIn: boolean;
  novaConnectEnabled: boolean;
  novaConnectCommunityRep: boolean;
  novaConnectRulesAcceptedAt: string | null;
  createdAt: string;
  subscriptionTier: string | null;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  isActive: boolean;
};

export default function AdminCustomersPage() {
  const { data: session, status } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [togglingOnDemandId, setTogglingOnDemandId] = useState<string | null>(null);
  const [togglingNewsletterId, setTogglingNewsletterId] = useState<string | null>(null);
  const [togglingNovaConnectId, setTogglingNovaConnectId] = useState<string | null>(null);
  const [togglingCommunityRepId, setTogglingCommunityRepId] = useState<string | null>(null);

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

  const handleSetSubscription = async (id: string, action: "pro" | "vip" | "clear") => {
    setUpdatingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/customers/${id}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "clear"
            ? JSON.stringify({ action: "clear" })
            : JSON.stringify({ action: "set", tier: action }),
      });
      const data = await res.json();
      if (data.success) {
        loadCustomers();
        if (action === "clear") {
          setSuccessMessage("Subscription cleared.");
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
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <div className="flex gap-4 mb-4">
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
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Nova Admin — Customers</CardTitle>
            <p className="text-sm text-muted-foreground">Registered users and subscription status. Only visible to owners (OWNER_EMAIL).</p>
          </CardHeader>
          <CardContent>
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
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
                      <th className="pb-2 pr-4 font-semibold">Email digest</th>
                      <th className="pb-2 pr-4 font-semibold">NovaConnect</th>
                      <th className="pb-2 pr-4 font-semibold">Community rep</th>
                      <th className="pb-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800/60">
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
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleNovaConnectToggle(c.id, !c.novaConnectEnabled)}
                              disabled={togglingNovaConnectId === c.id}
                              className={`text-xs font-medium px-2 py-1 rounded ${c.novaConnectEnabled ? "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
                            >
                              {togglingNovaConnectId === c.id ? "…" : c.novaConnectEnabled ? "On" : "Off"}
                            </button>
                            <span className="text-[10px] text-muted-foreground">
                              {c.novaConnectEnabled
                                ? c.novaConnectRulesAcceptedAt
                                  ? `Rules accepted ${new Date(c.novaConnectRulesAcceptedAt).toLocaleDateString()}`
                                  : "Rules not accepted yet"
                                : "Disabled"}
                            </span>
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
                              onClick={() => handleDelete(c.id)}
                              disabled={deletingId === c.id}
                              className="text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50 text-left"
                            >
                              {deletingId === c.id ? "Deleting…" : "Delete user"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customers.length === 0 && !error && <p className="py-6 text-muted-foreground">No customers yet.</p>}
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
