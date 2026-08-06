import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Download, QrCode, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SiteInstagramFooter from "@/components/SiteInstagramFooter";

const SITE_URL = "https://www.novastaris.ai";

export const metadata: Metadata = {
  title: "NovaStaris QR Code",
  description: "Scan or download the NovaStaris QR code to open novastaris.ai on any phone.",
};

export default function QrPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-lg px-4 py-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-semibold">
            <Zap className="h-5 w-5 text-cyan-500" />
            NovaStaris
          </Link>
          <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10 sm:py-14">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 mb-4">
            <QrCode className="h-6 w-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">NovaStaris QR Code</h1>
          <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Scan with your phone camera to open{" "}
            <a href={SITE_URL} className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
              {SITE_URL.replace("https://", "")}
            </a>
            . Download the image for flyers, business cards, slides, or social posts.
          </p>
        </div>

        <Card className="rounded-2xl border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 shadow-lg">
          <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-6">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white p-4 shadow-sm">
              <Image
                src="/novastaris-qr.png"
                alt="QR code linking to novastaris.ai"
                width={320}
                height={320}
                className="h-auto w-[min(100%,320px)]"
                priority
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1">
                <a href="/novastaris-qr.png" download="novastaris-qr.png">
                  <Download className="h-4 w-4 mr-2" />
                  Download PNG
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a href={SITE_URL} target="_blank" rel="noopener noreferrer">
                  Open site
                </a>
              </Button>
            </div>

            <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
              Encoded URL: <span className="font-mono">{SITE_URL}</span>
            </p>
            <div className="flex justify-center w-full">
              <SiteInstagramFooter className="border-0 pt-2 pb-0 mt-0" />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
