/** English (source of truth for message keys). */
export const en = {
  brand: {
    tagline: "Your Advanced AI Lightning Crypto Sniper, Futures and Prediction Market Intelligence",
    taglineShort: "AI Crypto Sniper for Meme Coins, Futures & Prediction Markets.",
  },
  nav: {
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    language: "Language",
    qr: "QR code",
    about: "About",
    chat: "Chat",
    support: "Support",
    status: "Status",
    signUp: "Sign up free",
    signIn: "Sign in",
    upgradeVip: "Upgrade to VIP",
    coach: "Coach",
    vip: "VIP",
    logOut: "Log out",
    refresh: "Refresh",
    scan: "Scan",
    account: "Account",
    profileBilling: "Profile & billing",
    affiliate: "Affiliate program",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    admin: "Admin",
    novaAdmin: "Nova Admin",
    liveOnline: "Live: online",
    liveNotMarked: "Live: not marked",
  },
  workspace: {
    title: "Multi-Market AI Trading Workspace",
    blurb:
      "NovaStaris unifies meme discovery, futures decision support, wallet intelligence, prediction market insights, and VIP agent workflows in one trading workspace.",
    howItWorks: "See how it works",
  },
  focus: {
    label: "Focus",
    all: "All",
    core: "Core",
    markets: "Markets",
    vip: "VIP",
    bots: "Bots",
    path: "Path",
  },
  more: "More",
  common: {
    new: "NEW",
  },
  tabs: {
    new: "Go Hunting",
    trending: "Trending",
    surge: "Surge",
    transactions: "Transactions",
    "ai-analysis": "NovaStaris AI Agent",
    futures: "Crypto Futures",
    "nova-futures-narratives": "Nova Futures Narratives",
    "nova-eagle": "Nova Eagle",
    "crypto-buddie": "Crypto Buddie",
    "meme-intelligence": "Nova Meme Intelligence",
    "trending-perps": "Trending perps",
    "perp-radar": "Perp Radar",
    narratives: "Narratives",
    "trading-bot": "NovaStaris AI Trading Bots",
    "polymarket-bot": "Nova Polymarket",
    "prop-firm-bot": "Nova Prop Firm Challenge",
    "nova-forex-bot": "Nova Forex Bots",
    "nova-ultimate": "Nova Ultimate",
    ct: "CT Scan",
    wallets: "Wallet Tracker",
    "coach-calls": "Coach Calls + Telegram Signals",
    "nova-forecast": "NovaForecast Agent",
    "nova-forex": "Nova Forex Agent",
    "nova-plus": "Nova+",
    "nova-investment": "Nova Investment Agent",
    "nova-connect": "Community",
    "trading-university": "NovaStaris Trading University",
    bsc: "BSC",
    watchlist: "Watchlist",
    "chris-clayton": "Online Boss Strategy",
  },
  lock: {
    signInAi: "Sign in to use NovaStaris AI Agent",
    createAccount: "Create a free account to preview",
    onDemand: "On-demand access required",
    vipRequired: "VIP required",
    subscribe: "Subscribe for access",
  },
} as const;

export type MessageDict = {
  brand: Record<keyof typeof en.brand, string>;
  nav: Record<keyof typeof en.nav, string>;
  workspace: Record<keyof typeof en.workspace, string>;
  focus: Record<keyof typeof en.focus, string>;
  more: string;
  common: Record<keyof typeof en.common, string>;
  tabs: Record<keyof typeof en.tabs, string>;
  lock: Record<keyof typeof en.lock, string>;
};
