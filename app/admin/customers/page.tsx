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
  createdAt: string;
  subscriptionPlan: string | null;
  subscriptionExpiresAt: string | null;
  isActive: boolean;
};

export default function AdminCustomersPage() {
  const { data: session, status } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    try {
      const res = await fetch(`/api/admin/customers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) loadCustomers();
      else setError(data.error ?? "Delete failed");
    } catch {
      setError("Delete failed");
    } finally {
      setDeletingId(null);
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
                <Link href="/register" className="underline">Sign in</Link>
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
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Admin — Customers</CardTitle>
            <p className="text-sm text-muted-foreground">Registered users and subscription status. Only visible to owners (OWNER_EMAIL).</p>
          </CardHeader>
          <CardContent>
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
                        <td className="py-2 pr-4">{c.subscriptionPlan ?? "—"}</td>
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
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id}
                            className="text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                          >
                            {deletingId === c.id ? "Deleting…" : "Delete"}
                          </button>
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
