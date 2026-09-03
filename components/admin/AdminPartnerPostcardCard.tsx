"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { openTelegramShare, sharePnlWithFallback } from "@/lib/pnl-share";

export type AdminPartnerPostcardVariant = "classic" | "premium";

type Props = {
  id: string;
  title: string;
  description: string;
  accent: "blue" | "cyan" | "amber" | "emerald";
  previewSrc: string;
  previewAlt: string;
  filePrefix: string;
  emailPresetHref: string;
  joinUrl: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  drawPostcard: (variant: AdminPartnerPostcardVariant) => Promise<Blob>;
  downloadPostcard: (variant: AdminPartnerPostcardVariant) => Promise<void>;
  buildCaption: () => string;
  onNotice?: (msg: string) => void;
  onError?: (msg: string) => void;
};

const ACCENT: Record<
  Props["accent"],
  { card: string; border: string; label: string; divider: string; previewBorder: string }
> = {
  blue: {
    card: "border-blue-200/80 dark:border-blue-800/50",
    border: "border-blue-200/70 dark:border-blue-800/40",
    label: "text-blue-800 dark:text-blue-200",
    divider: "border-blue-200/60 dark:border-blue-800/40",
    previewBorder: "border-blue-200/70 dark:border-blue-800/40",
  },
  cyan: {
    card: "border-teal-200/80 dark:border-teal-800/50",
    border: "border-teal-200/70 dark:border-teal-800/40",
    label: "text-teal-800 dark:text-teal-200",
    divider: "border-teal-200/60 dark:border-teal-800/40",
    previewBorder: "border-teal-200/70 dark:border-teal-800/40",
  },
  amber: {
    card: "border-amber-200/80 dark:border-amber-800/50",
    border: "border-amber-200/70 dark:border-amber-800/40",
    label: "text-amber-800 dark:text-amber-200",
    divider: "border-amber-200/60 dark:border-amber-800/40",
    previewBorder: "border-amber-200/70 dark:border-amber-800/40",
  },
  emerald: {
    card: "border-emerald-200/80 dark:border-emerald-800/50",
    border: "border-emerald-200/70 dark:border-emerald-800/40",
    label: "text-emerald-800 dark:text-emerald-200",
    divider: "border-emerald-200/60 dark:border-emerald-800/40",
    previewBorder: "border-emerald-200/70 dark:border-emerald-800/40",
  },
};

export function AdminPartnerPostcardCard({
  id,
  title,
  description,
  accent,
  previewSrc,
  previewAlt,
  filePrefix,
  emailPresetHref,
  joinUrl,
  busy,
  setBusy,
  drawPostcard,
  downloadPostcard,
  buildCaption,
  onNotice,
  onError,
}: Props) {
  const styles = ACCENT[accent];
  const date = () => new Date().toISOString().slice(0, 10);

  return (
    <Card id={id} className={`${styles.card} scroll-mt-24`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-lg border ${styles.previewBorder} overflow-hidden bg-zinc-950 max-w-sm`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt={previewAlt} className="w-full h-auto" />
        </div>
        <div className="space-y-2">
          <p className={`text-xs font-semibold ${styles.label}`}>Premium (recommended)</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const blob = await drawPostcard("premium");
                  await sharePnlWithFallback(
                    blob,
                    `${filePrefix}_Premium_${date()}.png`,
                    buildCaption()
                  );
                  onNotice?.(`${title.split("—")[0]?.trim() ?? "Partner"} premium postcard shared or downloaded.`);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Preparing…" : "Share premium"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadPostcard("premium");
                  onNotice?.("Premium postcard downloaded.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Download premium
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Classic (generated)</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const blob = await drawPostcard("classic");
                  await sharePnlWithFallback(
                    blob,
                    `${filePrefix}_Classic_${date()}.jpg`,
                    buildCaption()
                  );
                  onNotice?.("Classic postcard shared or downloaded.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Share classic
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await downloadPostcard("classic");
                  onNotice?.("Classic postcard downloaded.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Download classic
            </Button>
          </div>
        </div>
        <div className={`pt-2 border-t ${styles.divider} space-y-2`}>
          <p className="text-xs text-muted-foreground">
            Caption for WhatsApp / Telegram / IG (partner link included). On mobile, Share premium opens the system
            share sheet. On desktop, download then upload.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(buildCaption());
                  onNotice?.("Caption copied — paste into WhatsApp / IG.");
                } catch {
                  onError?.("Could not copy caption.");
                }
              }}
            >
              Copy caption (WA / IG)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                openTelegramShare(buildCaption(), joinUrl);
                onNotice?.("Telegram share opened.");
              }}
            >
              Open Telegram share
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={emailPresetHref}>Load email preset</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
