"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminEmptyState from "@/components/admin/AdminEmptyState";
import { adminNavByGroup, ADMIN_NAV_GROUPS } from "@/lib/admin-nav-config";
import { delegatedAdminOnly, getDelegatedAdminNavHrefs } from "@/lib/admin-access";
import { Headphones, MessageCircle } from "lucide-react";

type Ticket = {
  id: string;
  supportNumber: string;
  title: string;
  status: string;
  createdAt: string;
};

const RECENT_TICKETS = 8;

type ApiTestResult = {
  ok: boolean;
  message: string;
  extra?: string;
};

export default function AdminHubPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [apiTestRunning, setApiTestRunning] = useState<string | null>(null);
  const [dexTest, setDexTest] = useState<ApiTestResult | null>(null);
  const [moralisTest, setMoralisTest] = useState<ApiTestResult | null>(null);
  const [twitterTest, setTwitterTest] = useState<ApiTestResult | null>(null);
  const grouped = adminNavByGroup();

  useEffect(() => {
    if (status !== "authenticated" || !session) return;
    if (delegatedAdminOnly(session)) {
      const hrefs = getDelegatedAdminNavHrefs(session);
      if (hrefs?.[0]) router.replace(hrefs[0]);
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setTicketsLoading(true);
    fetch("/api/admin/support")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.tickets)) {
          const sorted = [...data.tickets].sort(
            (a: Ticket, b: Ticket) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setRecentTickets(sorted.slice(0, RECENT_TICKETS));
        }
      })
      .catch(() => {})
      .finally(() => setTicketsLoading(false));
  }, [status]);

  const runApiTest = async (id: "dex" | "moralis" | "twitter") => {
    const setResult = id === "dex" ? setDexTest : id === "moralis" ? setMoralisTest : setTwitterTest;
    const url =
      id === "dex" ? "/api/test-dexscreener" : id === "moralis" ? "/api/test-moralis" : "/api/test-twitter";
    setApiTestRunning(id);
    setResult(null);
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      const ok = Boolean(data.success);
      const message =
        data.message ||
        (ok
          ? id === "dex"
            ? "DexScreener OK"
            : id === "moralis"
              ? "Moralis OK"
              : "Twitter scan OK"
          : "Test failed");
      let extra: string | undefined;
      if (id === "dex" && ok) {
        extra = `Go Hunting (new pairs): ${data.newPairsCount ?? "—"}, Trending: ${data.trendingCount ?? "—"}${
          data.sample?.symbol ? ` · Sample: ${data.sample.symbol} (${data.sample.dexId})` : ""
        }`;
      }
      if (id === "moralis" && data.count !== undefined) {
        extra = `New tokens: ${data.count}`;
      }
      setResult({ ok, message, extra });
    } catch {
      setResult({ ok: false, message: "Request failed" });
    } finally {
      setApiTestRunning(null);
    }
  };

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to view Nova Admin."}
          {!session && (
            <p className="mt-2">
              <Link href="/signin" className="underline text-cyan-600">
                Sign in
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl">
      <AdminPageHeader
        title="Hub"
        description="Shortcuts to analytics, customers, trackers, feature flags, and support tools. Use the sidebar on desktop or the menu on mobile."
      />

      {isOwner && (
        <Card className="border-zinc-200 dark:border-zinc-800 mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">API tests</CardTitle>
            <p className="text-sm text-muted-foreground">
              Owner-only checks for DexScreener, Moralis, and Twitter scan configuration.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={apiTestRunning !== null}
                onClick={() => void runApiTest("dex")}
              >
                {apiTestRunning === "dex" ? "Testing…" : "Test DexScreener"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={apiTestRunning !== null}
                onClick={() => void runApiTest("moralis")}
              >
                {apiTestRunning === "moralis" ? "Testing…" : "Test Moralis"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={apiTestRunning !== null}
                onClick={() => void runApiTest("twitter")}
              >
                {apiTestRunning === "twitter" ? "Testing…" : "Test Twitter Scan"}
              </Button>
            </div>
            {[
              dexTest && { label: "DexScreener", result: dexTest },
              moralisTest && { label: "Moralis (Pump.fun)", result: moralisTest },
              twitterTest && { label: "Twitter scan", result: twitterTest },
            ]
              .filter((row): row is { label: string; result: ApiTestResult } => Boolean(row))
              .map((row) => (
                <div
                  key={row.label}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    row.result.ok
                      ? "border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                      : "border-red-200/80 dark:border-red-800/80 bg-red-50/90 dark:bg-red-950/40 text-red-800 dark:text-red-200"
                  }`}
                >
                  <strong>{row.label}:</strong> {row.result.message}
                  {row.result.extra ? <span className="ml-2">— {row.result.extra}</span> : null}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        {ADMIN_NAV_GROUPS.filter((g) => g.id !== "overview").map((g) => {
          const items = grouped[g.id];
          if (!items.length) return null;
          return (
            <Card key={g.id} className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{g.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                    >
                      <Icon className="h-4 w-4 text-cyan-500 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Recent support tickets</CardTitle>
          <Link href="/admin/support" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <p className="text-sm text-muted-foreground">Loading tickets…</p>
          ) : recentTickets.length === 0 ? (
            <AdminEmptyState
              icon={Headphones}
              title="No support tickets yet"
              description="When users submit tickets from the app, they will appear here and on the Support page."
              actionLabel="Open support"
              actionHref="/admin/support"
            />
          ) : (
            <ul className="space-y-2">
              {recentTickets.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {t.supportNumber} — {t.title}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <Link
              href="/admin/chat"
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              Open live chat
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
