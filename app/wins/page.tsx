"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Share2, Zap } from "lucide-react";

export default function WinsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 px-4 py-10">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">
            <Zap className="h-5 w-5 text-amber-500" />
            NovaStaris
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Back to app
          </Link>
        </div>

        <div className="space-y-4 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Shared wins
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Trade with NovaStaris
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Multi-market tools for meme coins, crypto futures, and forex — built for traders who want clearer structure
            and faster decisions.
          </p>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 text-left space-y-2">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 inline-flex items-center gap-2">
              <Share2 className="h-4 w-4 text-amber-500" />
              How wins get here
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Inside the app, open a closed trade or PNL card and tap <strong>Share</strong> / Telegram / Instagram.
              Those shares link to this page so new traders can join NovaStaris.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
            <Button asChild>
              <Link href="/register">Create account</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/signin?callbackUrl=/">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
