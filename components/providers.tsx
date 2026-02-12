"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import NeedHelpWidget from "@/components/NeedHelpWidget";
import { WelcomeVoice } from "@/components/WelcomeVoice";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SessionProvider>
        <WelcomeVoice />
        {children}
        <NeedHelpWidget />
      </SessionProvider>
    </ThemeProvider>
  );
}
