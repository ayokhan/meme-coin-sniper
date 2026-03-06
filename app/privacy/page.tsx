import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — NovaStaris",
  description: "Privacy Policy for NovaStaris.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: February 2025</p>
          </CardHeader>
          <CardContent className="prose prose-zinc dark:prose-invert max-w-none text-sm space-y-4">
            <p>
              We collect information you provide (e.g. email, name, wallet addresses when you connect) to operate your account, send service-related emails, and—if you opt in—our newsletter/digest.
            </p>
            <p>
              We use industry-standard practices to protect your data. We do not sell your personal information to third parties. We may share data with service providers (e.g. hosting, email) only as needed to run the service.
            </p>
            <p>
              You can opt out of the newsletter at any time. For account data, contact us to request access or deletion where applicable by law.
            </p>
            <p>
              We may update this policy; we will post changes on this page. Continued use after updates constitutes acceptance.
            </p>
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline hover:no-underline">Back to app</Link>
          {" · "}
          <Link href="/terms" className="underline hover:no-underline">Terms of Service</Link>
        </p>
      </div>
    </div>
  );
}
