"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/PasswordInput";

type TwoFactorStatus = {
  globalEnabled: boolean;
  enabled: boolean;
  method: "totp" | "email" | null;
  hasBackupCodes: boolean;
  email: string | null;
};

export default function TwoFactorSettings({ hasPassword }: { hasPassword: boolean }) {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/two-factor");
      const data = (await res.json()) as { success?: boolean; status?: TwoFactorStatus };
      if (res.ok && data.success) setStatus(data.status ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startTotp = async () => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup-totp" }),
      });
      const data = (await res.json()) as { success?: boolean; qrDataUrl?: string; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Setup failed.");
        return;
      }
      setQrDataUrl(data.qrDataUrl ?? null);
    } finally {
      setBusy(false);
    }
  };

  const confirmTotp = async () => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm-totp", code: totpCode }),
      });
      const data = (await res.json()) as { success?: boolean; backupCodes?: string[]; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Invalid code.");
        return;
      }
      setBackupCodes(data.backupCodes ?? []);
      setQrDataUrl(null);
      setTotpCode("");
      setSuccess("Google Authenticator enabled.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const enableEmail = async () => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable-email" }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Could not enable email 2FA.");
        return;
      }
      setSuccess("Email verification enabled for sign-in.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError("");
    setSuccess("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", password: disablePassword }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setError(data.error ?? "Could not disable 2FA.");
        return;
      }
      setDisablePassword("");
      setBackupCodes(null);
      setSuccess("Two-factor authentication disabled.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!hasPassword) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Set a password on your account first to enable optional 2FA for email sign-in.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="two-factor" className="border-zinc-200 dark:border-zinc-800 scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-lg">Two-factor authentication</CardTitle>
        <p className="text-sm text-muted-foreground">
          Optional extra security for email/password sign-in. Google sign-in uses Google&apos;s own security.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {!status?.globalEnabled && (
              <p className="text-sm text-amber-800 dark:text-amber-200 rounded-md border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2">
                Two-factor authentication is turned off site-wide by the owner (Admin → Feature flags → Two-factor authentication). Sign-in will not ask for a code until it is turned back on.
              </p>
            )}
            {status?.globalEnabled && status?.enabled ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                Enabled — {status.method === "email" ? "email code at sign-in" : "authenticator app"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not enabled.</p>
            )}

            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            {success && <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

            {backupCodes && backupCodes.length > 0 && (
              <div className="rounded-md border border-amber-300/60 dark:border-amber-700/50 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-100">Save these backup codes</p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1">Each code works once if you lose your authenticator.</p>
                <p className="mt-2 font-mono text-xs leading-relaxed break-all">{backupCodes.join(" · ")}</p>
              </div>
            )}

            {status?.globalEnabled && !status?.enabled && !qrDataUrl && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => void startTotp()}>
                  Enable Google Authenticator
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void enableEmail()}>
                  Enable email code
                </Button>
              </div>
            )}

            {qrDataUrl && (
              <div className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-sm">Scan with Google Authenticator, Authy, or 1Password, then enter the 6-digit code.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Authenticator QR code" className="mx-auto h-40 w-40 rounded-md bg-white p-2" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ""))}
                  className="w-full max-w-xs rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono"
                />
                <Button type="button" size="sm" disabled={busy || !totpCode} onClick={() => void confirmTotp()}>
                  Confirm authenticator
                </Button>
              </div>
            )}

            {status?.globalEnabled && status?.enabled && (
              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                <p className="text-xs text-muted-foreground">Enter your password to turn off 2FA.</p>
                <PasswordInput
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Current password"
                  className="w-full max-w-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                />
                <Button type="button" size="sm" variant="outline" disabled={busy || !disablePassword} onClick={() => void disable()}>
                  Disable 2FA
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
