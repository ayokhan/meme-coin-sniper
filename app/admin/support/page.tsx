"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useMemo } from "react";
import { canViewAdminSupportSession } from "@/lib/admin-access";
import DelegatedAdminQuickNav from "@/components/admin/DelegatedAdminQuickNav";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Trash2 } from "lucide-react";

const TICKET_STATUSES = [
  { value: "new", label: "New" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved / Completed" },
] as const;

type Ticket = {
  id: string;
  supportNumber: string;
  title: string;
  message: string;
  name: string;
  email: string;
  source: string;
  status: string;
  createdAt: string;
};

export default function AdminSupportPage() {
  const { data: session, status } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError("");
    fetch("/api/admin/support")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setTickets(data.tickets ?? []);
          setCanDelete(!!data.canDelete);
        } else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [status]);

  const filteredTickets = useMemo(() => {
    if (!dateFrom && !dateTo) return tickets;
    return tickets.filter((t) => {
      const ticketTime = new Date(t.createdAt).getTime();
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (ticketTime < from.getTime()) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (ticketTime > to.getTime()) return false;
      }
      return true;
    });
  }, [tickets, dateFrom, dateTo]);

  const updateStatus = async (ticketId: string, newStatus: string) => {
    setUpdatingId(ticketId);
    setError("");
    try {
      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
        );
      } else {
        setError(data.error ?? "Failed to update");
      }
    } catch {
      setError("Failed to update");
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteTicket = async (ticketId: string) => {
    setDeletingId(ticketId);
    setConfirmDeleteId(null);
    setError("");
    try {
      const res = await fetch("/api/admin/support", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      const data = await res.json();
      if (data.success) {
        setTickets((prev) => prev.filter((t) => t.id !== ticketId));
        setSuccessMessage("Ticket deleted.");
        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        setError(data.error ?? "Failed to delete");
      }
    } catch {
      setError("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to view support tickets."}
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

  if (!canViewAdminSupportSession(session)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center text-muted-foreground">
            Not authorized to view support tickets.
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
        <DelegatedAdminQuickNav />
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Nova Admin — Support tickets</CardTitle>
            <p className="text-sm text-muted-foreground">
              All messages sent via the support form and from chat when you were offline.
            </p>
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
            {!loading && tickets.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Filter by date:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
                <span className="text-sm text-zinc-500">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-zinc-900 dark:text-zinc-100"
                />
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                    Clear
                  </Button>
                )}
                <span className="text-xs text-zinc-500">
                  Showing {filteredTickets.length} of {tickets.length}
                </span>
              </div>
            )}
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-4">
                {filteredTickets.length === 0 && !error && (
                  <p className="py-6 text-muted-foreground">
                    {tickets.length === 0 ? "No support tickets yet." : "No tickets match the date filter."}
                  </p>
                )}
                {filteredTickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900/50"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                        {t.supportNumber}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                      {t.source === "chat" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                          From chat
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status:</span>
                        <select
                          value={t.status ?? "new"}
                          onChange={(e) => updateStatus(t.id, e.target.value)}
                          disabled={updatingId === t.id}
                          className="text-xs rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                        >
                          {TICKET_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {updatingId === t.id && (
                          <span className="text-xs text-zinc-400">Updating…</span>
                        )}
                        {canDelete && (
                          confirmDeleteId === t.id ? (
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-600 dark:text-zinc-400">Delete from DB?</span>
                              <Button size="sm" variant="destructive" className="h-6 text-xs" onClick={() => deleteTicket(t.id)} disabled={deletingId === t.id}>
                                {deletingId === t.id ? "Deleting…" : "Yes, delete"}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setConfirmDeleteId(null)} disabled={deletingId === t.id}>
                                Cancel
                              </Button>
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              onClick={() => setConfirmDeleteId(t.id)}
                              title="Delete ticket (removes from database)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )
                        )}
                      </span>
                    </div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">{t.title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap mb-2">
                      {t.message}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {t.name} — {t.email}
                    </p>
                  </div>
                ))}
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
