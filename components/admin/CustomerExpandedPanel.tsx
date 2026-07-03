"use client";

import type { ReactNode } from "react";

export type AdminCustomerPayment = {
  date: string;
  amountUsd: number;
  tier: string | null;
  plan: string;
  method: "card" | "usdc" | "other";
};

export type AdminCustomerRecord = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  experienceTradingCrypto: string | null;
  tradingBotOnDemand: boolean;
  polymarketBotOnDemand: boolean;
  propFirmBotOnDemand: boolean;
  novaUltimateOnDemand: boolean;
  ctScanOnDemand: boolean;
  ctScanOnDemandExpiresAt: string | null;
  memeCoinsTraderOnDemand: boolean;
  memeCoinsTraderOnDemandExpiresAt: string | null;
  newsletterOptIn: boolean;
  novaConnectEnabled: boolean;
  novaConnectCommunityRep: boolean;
  novaConnectAllowedByAdmin: boolean;
  coachUser: boolean;
  customersViewerAdmin?: boolean;
  supportViewerAdmin?: boolean;
  liveChatAgentAdmin?: boolean;
  supportStaffName?: string | null;
  aiAgentDailyLimitOverride?: number | null;
  aiChartAnalysisDailyLimitOverride?: number | null;
  novaConnectRulesAcceptedAt: string | null;
  paymentTermsAcceptedAt: string | null;
  subscriptionExpiresAt: string | null;
  isActive: boolean;
  payments: AdminCustomerPayment[];
};

function OnOffButton({
  on,
  busy,
  onClick,
  title,
  active = "emerald",
  readOnly = false,
}: {
  on: boolean;
  busy: boolean;
  onClick: () => void;
  title?: string;
  active?: "emerald" | "amber" | "violet" | "cyan" | "orange";
  readOnly?: boolean;
}) {
  const activeClass =
    active === "amber"
      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200"
      : active === "violet"
        ? "bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-200"
        : active === "cyan"
          ? "bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-200"
          : active === "orange"
            ? "bg-orange-100 dark:bg-orange-900/50 text-orange-900 dark:text-orange-200"
            : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200";
  if (readOnly) {
    return (
      <span className={`min-w-[3rem] text-xs font-medium px-2.5 py-1 rounded ${on ? activeClass : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}>
        {on ? "On" : "Off"}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      className={`min-w-[3rem] text-xs font-medium px-2.5 py-1 rounded ${on ? activeClass : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"} disabled:opacity-50`}
    >
      {busy ? "…" : on ? "On" : "Off"}
    </button>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/40 p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
      <div className="min-w-[8rem]">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export type CustomerExpandedPanelProps = {
  c: AdminCustomerRecord;
  showLegacyOnDemand: boolean;
  readOnly?: boolean;
  isOwner?: boolean;
  formatExpiryLabel: (expiresAt: string | null, subscriptionExpiresAt: string | null) => string;
  ctDuration: string;
  onCtDurationChange: (value: string) => void;
  memeDuration: string;
  onMemeDurationChange: (value: string) => void;
  busy: {
    tradingBot: boolean;
    polymarket: boolean;
    propFirm: boolean;
    ultimate: boolean;
    ctScan: boolean;
    memeTrader: boolean;
    newsletter: boolean;
    novaConnect: boolean;
    allowConnect: boolean;
    coach: boolean;
    communityRep: boolean;
    rules: boolean;
    subscription: boolean;
    resetPassword: boolean;
    delete: boolean;
    customersViewerAdmin?: boolean;
    supportViewerAdmin?: boolean;
    liveChatAgentAdmin?: boolean;
    savingSupportStaffName?: boolean;
    savingAiAgentLimits?: boolean;
  };
  onTradingBot: (value: boolean) => void;
  onPolymarket: (value: boolean) => void;
  onPropFirm: (value: boolean) => void;
  onUltimate: (value: boolean) => void;
  onCtScan: (value: boolean) => void;
  onMemeTrader: (value: boolean) => void;
  onNewsletter: (value: boolean) => void;
  onNovaConnect: (value: boolean) => void;
  onAllowConnect: (value: boolean) => void;
  onCoach: (value: boolean) => void;
  onCommunityRep: (value: boolean) => void;
  onAcceptRules: () => void;
  onSetVip: () => void;
  onGrant1DayVip: () => void;
  onClearSubscription: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
  onCustomersViewerAdmin?: (value: boolean) => void;
  onSupportViewerAdmin?: (value: boolean) => void;
  onLiveChatAgentAdmin?: (value: boolean) => void;
  onSupportStaffNameSave?: (value: string) => void;
  onAiAgentLimitsSave?: (patch: { meme?: number | null; chart?: number | null }) => void;
};

export default function CustomerExpandedPanel({
  c,
  showLegacyOnDemand,
  readOnly = false,
  isOwner = false,
  formatExpiryLabel,
  ctDuration,
  onCtDurationChange,
  memeDuration,
  onMemeDurationChange,
  busy,
  onTradingBot,
  onPolymarket,
  onPropFirm,
  onUltimate,
  onCtScan,
  onMemeTrader,
  onNewsletter,
  onNovaConnect,
  onAllowConnect,
  onCoach,
  onCommunityRep,
  onAcceptRules,
  onSetVip,
  onGrant1DayVip,
  onClearSubscription,
  onResetPassword,
  onDelete,
  onCustomersViewerAdmin,
  onSupportViewerAdmin,
  onLiveChatAgentAdmin,
  onSupportStaffNameSave,
  onAiAgentLimitsSave,
}: CustomerExpandedPanelProps) {
  if (readOnly) {
    return (
      <div className="p-4 bg-zinc-50/80 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-700">
        <DetailSection title="On-demand access">
          <DetailRow label="Trading bot">
            <OnOffButton readOnly on={c.tradingBotOnDemand} busy={false} onClick={() => {}} active="amber" />
          </DetailRow>
          <DetailRow label="Polymarket bot">
            <OnOffButton readOnly on={c.polymarketBotOnDemand} busy={false} onClick={() => {}} active="violet" />
          </DetailRow>
          {showLegacyOnDemand && (
            <DetailRow label="Prop firm bot" hint="Legacy — hidden by default">
              <OnOffButton readOnly on={c.propFirmBotOnDemand} busy={false} onClick={() => {}} active="orange" />
            </DetailRow>
          )}
          <DetailRow label="Nova Ultimate">
            <OnOffButton readOnly on={c.novaUltimateOnDemand} busy={false} onClick={() => {}} active="cyan" />
          </DetailRow>
          <DetailRow label="CT Scan">
            <OnOffButton readOnly on={c.ctScanOnDemand} busy={false} onClick={() => {}} active="cyan" />
            {c.ctScanOnDemand && (
              <span className="text-[10px] text-muted-foreground w-full">
                {formatExpiryLabel(c.ctScanOnDemandExpiresAt, c.subscriptionExpiresAt)}
              </span>
            )}
          </DetailRow>
          <DetailRow label="Meme coins traders">
            <OnOffButton readOnly on={c.memeCoinsTraderOnDemand} busy={false} onClick={() => {}} active="amber" />
            {c.memeCoinsTraderOnDemand && (
              <span className="text-[10px] text-muted-foreground w-full">
                {formatExpiryLabel(c.memeCoinsTraderOnDemandExpiresAt, c.subscriptionExpiresAt)}
              </span>
            )}
          </DetailRow>
        </DetailSection>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 p-4 bg-zinc-50/80 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-700">
      <DetailSection title="Profile">
        <DetailRow label="Phone">{c.phone ?? "—"}</DetailRow>
        <DetailRow label="Country">{c.country ?? "—"}</DetailRow>
        <DetailRow label="Experience">{c.experienceTradingCrypto ?? "—"}</DetailRow>
        <DetailRow label="Payment terms">
          {c.paymentTermsAcceptedAt ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-300">
              Yes · {new Date(c.paymentTermsAcceptedAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-xs text-zinc-500">No</span>
          )}
        </DetailRow>
        <DetailRow label="Email digest" hint="Newsletter / perp digest">
          {c.email ? (
            <OnOffButton readOnly={readOnly} on={c.newsletterOptIn} busy={busy.newsletter} onClick={() => onNewsletter(!c.newsletterOptIn)} />
          ) : (
            <span className="text-xs text-zinc-400">Email required</span>
          )}
        </DetailRow>
        {isOwner && onCustomersViewerAdmin && (
          <DetailRow label="Customers viewer admin" hint="Read-only access to Admin → Customers">
            <OnOffButton
              readOnly={false}
              on={!!c.customersViewerAdmin}
              busy={!!busy.customersViewerAdmin}
              onClick={() => onCustomersViewerAdmin(!c.customersViewerAdmin)}
              active="cyan"
            />
          </DetailRow>
        )}
        {isOwner && onSupportViewerAdmin && (
          <DetailRow label="Support tickets admin" hint="Access Admin → Support tickets">
            <OnOffButton
              readOnly={false}
              on={!!c.supportViewerAdmin}
              busy={!!busy.supportViewerAdmin}
              onClick={() => onSupportViewerAdmin(!c.supportViewerAdmin)}
              active="cyan"
            />
          </DetailRow>
        )}
        {isOwner && onLiveChatAgentAdmin && (
          <DetailRow label="Live chat agent" hint="Access Admin → Live chat and reply to customers">
            <OnOffButton
              readOnly={false}
              on={!!c.liveChatAgentAdmin}
              busy={!!busy.liveChatAgentAdmin}
              onClick={() => onLiveChatAgentAdmin(!c.liveChatAgentAdmin)}
              active="violet"
            />
          </DetailRow>
        )}
        {isOwner && onSupportStaffNameSave && (c.liveChatAgentAdmin || c.supportViewerAdmin) && (
          <DetailRow label="Support staff name" hint="Shown to customers when replying (default: Support Agent)">
            <input
              type="text"
              defaultValue={c.supportStaffName ?? ""}
              placeholder="Support Agent"
              disabled={!!busy.savingSupportStaffName}
              className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 min-w-[10rem]"
              onBlur={(e) => {
                const next = e.target.value.trim();
                const current = (c.supportStaffName ?? "").trim();
                if (next !== current) onSupportStaffNameSave(next);
              }}
            />
          </DetailRow>
        )}
      </DetailSection>

      {isOwner && onAiAgentLimitsSave && (
        <DetailSection title="AI Agent daily limits">
          <DetailRow label="Meme Coins Agent" hint="Blank = global default. 0 = blocked for free tier.">
            <input
              type="number"
              min={0}
              max={1000}
              defaultValue={c.aiAgentDailyLimitOverride ?? ""}
              placeholder="Default"
              disabled={!!busy.savingAiAgentLimits}
              className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 w-20"
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const next = raw === "" ? null : Math.max(0, Math.min(1000, Math.round(Number(raw))));
                const current = c.aiAgentDailyLimitOverride ?? null;
                if (next !== current && (raw === "" || Number.isFinite(next))) {
                  onAiAgentLimitsSave({ meme: next });
                }
              }}
            />
          </DetailRow>
          <DetailRow label="Chart Analysis" hint="Blank = global default. 0 = blocked for free tier.">
            <input
              type="number"
              min={0}
              max={1000}
              defaultValue={c.aiChartAnalysisDailyLimitOverride ?? ""}
              placeholder="Default"
              disabled={!!busy.savingAiAgentLimits}
              className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800 w-20"
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const next = raw === "" ? null : Math.max(0, Math.min(1000, Math.round(Number(raw))));
                const current = c.aiChartAnalysisDailyLimitOverride ?? null;
                if (next !== current && (raw === "" || Number.isFinite(next))) {
                  onAiAgentLimitsSave({ chart: next });
                }
              }}
            />
          </DetailRow>
        </DetailSection>
      )}

      <DetailSection title="On-demand access">
        <DetailRow label="Trading bot">
          <OnOffButton readOnly={readOnly} on={c.tradingBotOnDemand} busy={busy.tradingBot} onClick={() => onTradingBot(!c.tradingBotOnDemand)} active="amber" />
        </DetailRow>
        <DetailRow label="Polymarket bot">
          <OnOffButton readOnly={readOnly} on={c.polymarketBotOnDemand} busy={busy.polymarket} onClick={() => onPolymarket(!c.polymarketBotOnDemand)} active="violet" />
        </DetailRow>
        {showLegacyOnDemand && (
          <DetailRow label="Prop firm bot" hint="Legacy — hidden by default">
            <OnOffButton readOnly={readOnly} on={c.propFirmBotOnDemand} busy={busy.propFirm} onClick={() => onPropFirm(!c.propFirmBotOnDemand)} active="orange" />
          </DetailRow>
        )}
        <DetailRow label="Nova Ultimate">
          <OnOffButton readOnly={readOnly} on={c.novaUltimateOnDemand} busy={busy.ultimate} onClick={() => onUltimate(!c.novaUltimateOnDemand)} active="cyan" />
        </DetailRow>
        <DetailRow label="CT Scan" hint="Expiry when enabling">
          {!readOnly && (
            <select
              value={ctDuration}
              onChange={(e) => onCtDurationChange(e.target.value)}
              disabled={busy.ctScan}
              className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800"
            >
              <option value="subscription">End of subscription</option>
              <option value="1day">1 day</option>
              <option value="5days">5 days</option>
            </select>
          )}
          <OnOffButton readOnly={readOnly} on={c.ctScanOnDemand} busy={busy.ctScan} onClick={() => onCtScan(!c.ctScanOnDemand)} active="cyan" />
          {c.ctScanOnDemand && (
            <span className="text-[10px] text-muted-foreground w-full">
              {formatExpiryLabel(c.ctScanOnDemandExpiresAt, c.subscriptionExpiresAt)}
            </span>
          )}
        </DetailRow>
        <DetailRow label="Meme coins traders">
          {!readOnly && (
            <select
              value={memeDuration}
              onChange={(e) => onMemeDurationChange(e.target.value)}
              disabled={busy.memeTrader}
              className="text-xs border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 bg-white dark:bg-zinc-800"
            >
              <option value="subscription">End of subscription</option>
              <option value="1day">1 day</option>
              <option value="5days">5 days</option>
            </select>
          )}
          <OnOffButton readOnly={readOnly} on={c.memeCoinsTraderOnDemand} busy={busy.memeTrader} onClick={() => onMemeTrader(!c.memeCoinsTraderOnDemand)} active="amber" />
          {c.memeCoinsTraderOnDemand && (
            <span className="text-[10px] text-muted-foreground w-full">
              {formatExpiryLabel(c.memeCoinsTraderOnDemandExpiresAt, c.subscriptionExpiresAt)}
            </span>
          )}
        </DetailRow>
      </DetailSection>

      <DetailSection title="Community (NovaConnect)">
        <DetailRow label="NovaConnect enabled">
          <OnOffButton readOnly={readOnly} on={c.novaConnectEnabled} busy={busy.novaConnect} onClick={() => onNovaConnect(!c.novaConnectEnabled)} active="cyan" />
        </DetailRow>
        <DetailRow label="Allow access" hint="Online list & DMs without VIP">
          <OnOffButton readOnly={readOnly} on={c.novaConnectAllowedByAdmin} busy={busy.allowConnect} onClick={() => onAllowConnect(!c.novaConnectAllowedByAdmin)} />
        </DetailRow>
        <DetailRow label="Coach user" hint="VIP + publish coach calls">
          <OnOffButton readOnly={readOnly} on={c.coachUser} busy={busy.coach} onClick={() => onCoach(!c.coachUser)} active="amber" />
        </DetailRow>
        <DetailRow label="Community rep" hint="Can delete community posts">
          <OnOffButton readOnly={readOnly} on={c.novaConnectCommunityRep} busy={busy.communityRep} onClick={() => onCommunityRep(!c.novaConnectCommunityRep)} active="violet" />
        </DetailRow>
        <DetailRow label="Rules accepted">
          {c.novaConnectRulesAcceptedAt ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-300">
              Yes · {new Date(c.novaConnectRulesAcceptedAt).toLocaleDateString()}
            </span>
          ) : (
            <>
              <span className="text-xs text-zinc-500">No</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={onAcceptRules}
                  disabled={busy.rules}
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-50"
                >
                  {busy.rules ? "…" : "Accept for user"}
                </button>
              )}
            </>
          )}
        </DetailRow>
      </DetailSection>

      {!readOnly && (
      <DetailSection title="Subscription & account">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onSetVip} disabled={busy.subscription} className="text-xs px-2.5 py-1 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 disabled:opacity-50">
            Set VIP (1 month)
          </button>
          <button type="button" onClick={onGrant1DayVip} disabled={busy.subscription} className="text-xs px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-600 disabled:opacity-50">
            1 day VIP
          </button>
          {c.isActive && (
            <button type="button" onClick={onClearSubscription} disabled={busy.subscription} className="text-xs px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-600 disabled:opacity-50">
              Clear subscription
            </button>
          )}
          <button type="button" onClick={onResetPassword} disabled={busy.resetPassword || !c.email} className="text-xs px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-600 disabled:opacity-50" title={c.email ? undefined : "Email accounts only"}>
            Reset password
          </button>
          <button type="button" onClick={onDelete} disabled={busy.delete} className="text-xs px-2.5 py-1 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 disabled:opacity-50">
            Delete user
          </button>
        </div>
      </DetailSection>
      )}

      {Array.isArray(c.payments) && c.payments.length > 0 && (
        <DetailSection title={`Payments (${c.payments.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800">
                  <th className="text-left py-1.5 px-2">Date</th>
                  <th className="text-left py-1.5 px-2">Amount</th>
                  <th className="text-left py-1.5 px-2">Method</th>
                  <th className="text-left py-1.5 px-2">Tier · Plan</th>
                </tr>
              </thead>
              <tbody>
                {c.payments.map((p, i) => (
                  <tr key={i} className="border-t border-zinc-200 dark:border-zinc-700">
                    <td className="py-1.5 px-2">{new Date(p.date).toLocaleString()}</td>
                    <td className="py-1.5 px-2">${p.amountUsd} USD</td>
                    <td className="py-1.5 px-2">{p.method === "card" ? "Card" : p.method === "usdc" ? "USDC" : "Other"}</td>
                    <td className="py-1.5 px-2">{(p.tier ?? "—").toUpperCase()} · {p.plan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailSection>
      )}
    </div>
  );
}
