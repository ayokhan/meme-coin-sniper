import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HelpCircle, MessageCircle } from "lucide-react";

/** Contextual help on locked / paywalled dashboard tabs. */
export default function DashboardPaywallHelp() {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      <Button variant="outline" size="sm" asChild className="border-zinc-200 dark:border-zinc-700">
        <Link href="/chat">
          <MessageCircle className="h-4 w-4 mr-1.5" aria-hidden />
          Chat with us
        </Link>
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/support">
          <HelpCircle className="h-4 w-4 mr-1.5" aria-hidden />
          Support
        </Link>
      </Button>
    </div>
  );
}
