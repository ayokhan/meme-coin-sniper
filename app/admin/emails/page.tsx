"use client";

import { Suspense, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminEmailsPanel from "@/components/admin/AdminEmailsPanel";

export default function AdminEmailsPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to manage emails."}
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
    <div className="max-w-5xl">
      <AdminPageHeader
        title="Emails"
        description="Send customer emails (rich or plain) and copy plain text for WhatsApp, Telegram, or Instagram."
      />
      {notice && <p className="mb-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <AdminEmailsPanel
          onNotice={(m) => {
            setNotice(m);
            setError("");
          }}
          onError={(m) => {
            setError(m);
            setNotice("");
          }}
        />
      </Suspense>
    </div>
  );
}
