"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import BannersAdminPanel from "@/components/admin/BannersAdminPanel";
import { Megaphone } from "lucide-react";

export default function AdminBannersPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto border-zinc-200 dark:border-zinc-800">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in to manage banners."}
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
        <CardContent className="py-10 text-center text-muted-foreground">
          Owner access only.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl">
      <AdminPageHeader
        title="Banners"
        description="Turn site banners on or off, send email announcements, and edit copy without a deploy."
      />

      {successMessage && (
        <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p>
      )}
      {error && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <BannersAdminPanel
        onNotice={(msg) => {
          setError("");
          setSuccessMessage(msg);
          setTimeout(() => setSuccessMessage(""), 4000);
        }}
        onError={(msg) => {
          setSuccessMessage("");
          setError(msg);
        }}
      />

      <p className="mt-6 text-xs text-muted-foreground inline-flex items-center gap-1.5">
        <Megaphone className="h-3.5 w-3.5" />
        Promo and Meme Agent banners were moved here from Feature flags.
      </p>
    </div>
  );
}
