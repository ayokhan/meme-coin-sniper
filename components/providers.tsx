"use client";

import { Suspense } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import NeedHelpWidget from "@/components/NeedHelpWidget";
import AdminLiveTransferNotifier from "@/components/AdminLiveTransferNotifier";
import { WelcomeVoice } from "@/components/WelcomeVoice";
import AnalyticsPing from "@/components/AnalyticsPing";
import CapacitorAuthBridge from "@/components/CapacitorAuthBridge";
import NovaScalpPlanWatcher from "@/components/NovaScalpPlanWatcher";
import NovaScalpWatchBanner from "@/components/NovaScalpWatchBanner";
import NovaScalpActiveTradeBar from "@/components/NovaScalpActiveTradeBar";
import ReferralCapture from "@/components/ReferralCapture";
import ReferralClaimOnAuth from "@/components/ReferralClaimOnAuth";
import { DashboardScreenProvider } from "@/components/DashboardScreenContext";
import { I18nProvider } from "@/components/I18nProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <I18nProvider>
      <SessionProvider>
        <DashboardScreenProvider>
          <CapacitorAuthBridge />
          <AnalyticsPing />
          <WelcomeVoice />
          <Suspense fallback={null}>
            <ReferralCapture />
          </Suspense>
          <ReferralClaimOnAuth />
          {children}
          <AdminLiveTransferNotifier />
          <NeedHelpWidget />
          <NovaScalpPlanWatcher />
          <NovaScalpActiveTradeBar />
          <NovaScalpWatchBanner />
        </DashboardScreenProvider>
      </SessionProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
