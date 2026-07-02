"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export default function NovaConnectTermsPage() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            <Zap className="h-6 w-6 text-amber-500" />
            NovaStaris
          </Link>
          <Link href="/register" className="text-sm text-muted-foreground underline hover:no-underline">
            Back to registration
          </Link>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg">NovaConnect — Community rules &amp; privacy</CardTitle>
            <p className="text-sm text-muted-foreground">
              Please read these before creating an account. You will need to accept them on the registration form.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            <section id="rules">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Community rules (summary)
              </h2>
              <ul className="text-sm text-zinc-700 dark:text-zinc-300 list-disc list-inside space-y-1">
                <li>No insults, racism, hate speech, harassment, or bullying.</li>
                <li>No spam, scams, or fake PnL screenshots.</li>
                <li>No sharing private information (yours or others&apos;) without consent.</li>
                <li>Respect other traders — disagree with ideas, not people.</li>
                <li>Admins can mute, remove messages, or remove users from NovaConnect if rules are broken.</li>
                <li>NovaConnect is not financial advice. Always do your own research.</li>
              </ul>
            </section>

            <section id="privacy">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Presence &amp; privacy
              </h2>
              <div className="text-sm text-zinc-700 dark:text-zinc-300 space-y-2">
                <p>
                  Your preferred name (or the name you set) will be displayed to everyone on NovaConnect. We are not
                  liable for any issues arising from your use of the service.
                </p>
                <p>
                  Use the Account page to set your preferred name, profile picture, and status (online, away, busy,
                  offline). You can leave NovaConnect at any time without closing your NovaStaris account.
                </p>
                <p>
                  Only VIP members can see online traders and send private
                  messages.
                </p>
              </div>
            </section>

            <p className="text-xs text-muted-foreground pt-4 border-t border-zinc-200 dark:border-zinc-700">
              By creating an account you also agree to our{" "}
              <Link href="/terms" className="underline hover:no-underline">Terms of Service</Link> and{" "}
              <Link href="/privacy" className="underline hover:no-underline">Privacy Policy</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
