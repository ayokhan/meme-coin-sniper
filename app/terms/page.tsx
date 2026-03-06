import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export const metadata = {
  title: "Terms of Service — NovaStaris",
  description: "Terms of Service for NovaStaris.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: February 2025</p>
          </CardHeader>
          <CardContent className="prose prose-zinc dark:prose-invert max-w-none text-sm space-y-4">
            <p>
              NovaStaris provides analytics, alerts, and tools for informational purposes only. Nothing on this site or in our communications constitutes financial, investment, legal, or tax advice.
            </p>
            <p>
              <strong>No liability.</strong> You use the service at your own risk. We are not liable for any trading decisions, losses, or outcomes resulting from your use of NovaStaris. Cryptocurrency and derivatives trading involve substantial risk of loss.
            </p>
            <p>
              <strong>No guarantee.</strong> We do not guarantee accuracy, completeness, or timeliness of data or signals. You are responsible for your own research and decisions.
            </p>
            <p>
              By using NovaStaris you agree to these terms. We may update this page from time to time; continued use after changes constitutes acceptance.
            </p>
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline hover:no-underline">Back to app</Link>
          {" · "}
          <Link href="/privacy" className="underline hover:no-underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
