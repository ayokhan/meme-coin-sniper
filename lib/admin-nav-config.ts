import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  CreditCard,
  Flag,
  Gift,
  GraduationCap,
  Headphones,
  KeyRound,
  Languages,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

export type AdminNavGroup = "overview" | "analytics" | "users" | "trackers" | "product";

export type AdminNavItem = {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  group: AdminNavGroup;
  /** Hidden from nav unless session user is owner. */
  ownerOnly?: boolean;
};

export const ADMIN_NAV_GROUPS: { id: AdminNavGroup; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "users", label: "Users & support" },
  { id: "trackers", label: "Trackers" },
  { id: "product", label: "Product" },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Hub", description: "Admin home", icon: Zap, group: "overview" },
  { href: "/admin/insights", label: "App insights", icon: BarChart3, group: "analytics" },
  { href: "/admin/metrics", label: "Usage metrics", icon: BarChart3, group: "analytics" },
  {
    href: "/admin/stripe-test",
    label: "Stripe billing tests",
    description: "Receipt & subscription test charges",
    icon: CreditCard,
    group: "analytics",
    ownerOnly: true,
  },
  { href: "/admin/customers", label: "Customers", icon: Users, group: "users" },
  {
    href: "/admin/blofin-users",
    label: "Blofin / bot users",
    description: "Users with Blofin API keys for Nova bots",
    icon: KeyRound,
    group: "users",
    ownerOnly: true,
  },
  {
    href: "/admin/forex-bot-users",
    label: "Forex bot users",
    description: "Users with MT4/MT5 logins for Nova Forex bots",
    icon: KeyRound,
    group: "users",
    ownerOnly: true,
  },
  {
    href: "/admin/forex-bot-users",
    label: "Forex bot users",
    description: "Users with Vantage/TIOmarkets MT4/MT5 connections for Nova Forex Bot/Scalper",
    icon: KeyRound,
    group: "users",
    ownerOnly: true,
  },
  { href: "/admin/affiliates", label: "Affiliate program", icon: Gift, group: "users" },
  { href: "/admin/support", label: "Support", icon: Headphones, group: "users" },
  { href: "/admin/chat", label: "Live chat", icon: MessageCircle, group: "users" },
  { href: "/admin/ai-feedback", label: "AI feedback", icon: Lightbulb, group: "users" },
  {
    href: "/admin/trading-university",
    label: "Trading University",
    description: "Enrollments, graduates, exam keys",
    icon: GraduationCap,
    group: "users",
    ownerOnly: true,
  },
  { href: "/admin/wallet-tracker", label: "Wallet Tracker", icon: Wallet, group: "trackers" },
  { href: "/admin/leverage-wallet-tracker", label: "Leverage wallets", icon: Wallet, group: "trackers" },
  { href: "/admin/polymarket-tracker", label: "Polymarket", icon: Wallet, group: "trackers" },
  { href: "/admin/feature-flags", label: "Feature flags", icon: Flag, group: "product" },
  {
    href: "/admin/languages",
    label: "Languages",
    description: "Enable or disable site languages",
    icon: Languages,
    group: "product",
    ownerOnly: true,
  },
  {
    href: "/admin/banners",
    label: "Banners",
    description: "Promo and Meme Agent banners",
    icon: Megaphone,
    group: "product",
    ownerOnly: true,
  },
  { href: "/admin/meme-runner", label: "Meme Runner", icon: Zap, group: "product" },
  { href: "/admin/nova-scalper", label: "NovaScalper", icon: Activity, group: "product" },
];

export function adminNavByGroup(): Record<AdminNavGroup, AdminNavItem[]> {
  const out = {} as Record<AdminNavGroup, AdminNavItem[]>;
  for (const g of ADMIN_NAV_GROUPS) out[g.id] = [];
  for (const item of ADMIN_NAV_ITEMS) {
    out[item.group].push(item);
  }
  return out;
}
