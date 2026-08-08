"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminCallsPanel from "@/components/admin/AdminCallsPanel";

export default function AdminCallsPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to manage calls."}
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

  if (!isOwner) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">Owner access only.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Calls"
        description="Discovery completions log + paid Strategy call ($200/hr) settings and payments."
      />
      {notice && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 dark:text-red-300 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
          {error}
        </p>
      )}
      <AdminCallsPanel
        onNotice={(msg) => {
          setNotice(msg);
          setError("");
        }}
        onError={(msg) => {
          setError(msg);
          setNotice("");
        }}
      />
    </div>
  );
}
