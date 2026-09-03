import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CreditCard,
  EyeOff,
  Flag,
  Gift,
  GraduationCap,
  Headphones,
  KeyRound,
  Languages,
  LayoutTemplate,
  Lightbulb,
  Mail,
  Megaphone,
  MessageCircle,
  ShoppingBag,
  Users,
  Wallet,
  Zap,
  Building2,
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
  {
    href: "/admin/system-errors",
    label: "System errors",
    description: "Cron, Stripe, API, and email failures",
    icon: AlertTriangle,
    group: "overview",
    ownerOnly: true,
  },
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
    href: "/admin/calls",
    label: "Calls",
    description: "Discovery completions + paid Strategy call",
    icon: CalendarDays,
    group: "users",
    ownerOnly: true,
  },
  {
    href: "/admin/blofin-users",
    label: "Blofin / bot users",
    description: "Users with Blofin API keys for Nova bots",
    icon: KeyRound,
    group: "users",
    ownerOnly: true,
  },
  {
    href: "/admin/coinbase-users",
    label: "Coinbase / bot users",
    description: "Users with Coinbase CDP API keys for Nova bots",
    icon: KeyRound,
    group: "users",
    ownerOnly: true,
  },
  {
    href: "/admin/forex-bot-users",
    label: "Forex bot users",
    description: "Users with MT4/MT5 logins for Nova Forex bots (Vantage/TIOmarkets)",
    icon: KeyRound,
    group: "users",
    ownerOnly: true,
  },
  { href: "/admin/affiliates", label: "Affiliate program", icon: Gift, group: "users" },
  {
    href: "/admin/forex-partner-rebates",
    label: "Partner rebates",
    description: "User enrollments + IB commission shares you pay ($2/lot USDC)",
    icon: Gift,
    group: "users",
    ownerOnly: true,
  },
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
  { href: "/admin/smart-money", label: "Smart Money Alerts", icon: Wallet, group: "trackers" },
  { href: "/admin/leverage-wallet-tracker", label: "Leverage wallets", icon: Wallet, group: "trackers" },
  { href: "/admin/polymarket-tracker", label: "Polymarket", icon: Wallet, group: "trackers" },
  {
    href: "/admin/feature-flags",
    label: "Feature flags",
    icon: Flag,
    group: "product",
  },
  {
    href: "/admin/tab-visibility",
    label: "Product visibility",
    description: "Tab On/Off, owner-only locks, and NEW badges",
    icon: EyeOff,
    group: "product",
    ownerOnly: true,
  },
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
  {
    href: "/admin/landing",
    label: "Landing",
    description: "Desk landing copy, cards, Instagram, footer",
    icon: LayoutTemplate,
    group: "product",
    ownerOnly: true,
  },
  {
    href: "/admin/case-studies",
    label: "Case studies",
    description: "Edit /case-studies stories, hero, and CTAs",
    icon: BookOpen,
    group: "product",
    ownerOnly: true,
  },
  {
    href: "/admin/realtor-os",
    label: "Realtor OS",
    description: "Test email / phone / calendar for realtor AI ops",
    icon: Building2,
    group: "product",
    ownerOnly: true,
  },
  {
    href: "/admin/emails",
    label: "Emails",
    description: "Rich or plain templates; copy for WhatsApp",
    icon: Mail,
    group: "product",
    ownerOnly: true,
  },
  {
    href: "/admin/nova-store",
    label: "Nova Store",
    description: "Merch products, prices, sizes, orders",
    icon: ShoppingBag,
    group: "product",
    ownerOnly: true,
  },
  {
    href: "/admin/vip-trial",
    label: "VIP trial",
    description: "Trial days, signups, reminder emails, cancel surveys",
    icon: Gift,
    group: "product",
    ownerOnly: true,
  },
  {
    href: "/admin/demo-sessions",
    label: "Demo sessions",
    description: "Free Zoom/Meet registration forms & emails",
    icon: CalendarDays,
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
