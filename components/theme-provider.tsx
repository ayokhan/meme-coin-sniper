"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

function MoneyThemeSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const html = document.documentElement;
    if (resolvedTheme === "money") {
      html.classList.add("dark");
    } else if (resolvedTheme === "light") {
      html.classList.remove("dark");
    }
    // when dark or system(dark), next-themes already sets "dark"
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props} themes={["light", "dark", "system", "money"]}>
      <MoneyThemeSync />
      {children}
    </NextThemesProvider>
  );
}
