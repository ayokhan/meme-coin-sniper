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
    loading: "Loading…",
    refreshing: "Refreshing…",
    connecting: "Connecting…",
    disconnecting: "Disconnecting…",
    disconnect: "Disconnect",
    connect: "Connect",
    retry: "Retry",
    cancel: "Cancel",
    save: "Save",
    open: "Open",
    pending: "Pending",
    closed: "Closed",
    balance: "Balance",
    equity: "Equity",
    freeMargin: "Free margin",
    leverage: "Leverage",
    demoMode: "Demo mode",
    live: "Live",
    demo: "Demo",
    platform: "Platform",
    login: "Login (account number)",
    password: "Password",
    server: "Server",
    lots: "lots",
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
  forex: {
    title: "Forex broker connection (MT4/MT5)",
    blurb:
      "Connect your broker MT4/MT5 login so Nova Forex bots can trade on your account. Credentials are encrypted at rest. Available brokers are controlled by the site admin.",
    noBrokers:
      "No forex brokers are enabled right now. Ask the site owner to turn one on in Admin → Feature flags.",
    tradingUnavailable:
      "Broker trading is temporarily unavailable on the server. You can still save your login, but bots cannot trade until support restores it.",
    reconnectTitle: "Saved, but not linked to your broker yet",
    reconnectBody:
      "We need the exact server name from your MT4/MT5 terminal. Fix the server below and retry — leave password blank to reuse your saved password.",
    passwordOptional: "Password (optional — reuse saved)",
    passwordReusePlaceholder: "Leave blank to reuse saved",
    rememberLogin: "Remember login and password on this device",
    rememberHint:
      "Stored only in this browser. Uncheck to clear. Prefer a dedicated trading password if the device is shared.",
    serverTip:
      "Tip: In MT5 open your account in Navigator — the server name must match character-for-character.",
    connectBroker: "Connect {broker}",
    retryBroker: "Retry {broker}",
    disconnectClear: "Disconnect / clear",
    connectedLine: "{broker} connected — {login} on {server} ({platform})",
    loadingBalance: "Loading balance (waiting for broker link)…",
    balanceUnavailable: "Balance unavailable right now. Tap Refresh balance — the first connect often needs 20–30 seconds.",
    refreshBalance: "Refresh balance",
    accountTitle: "{broker} account",
    accountBlurb:
      "Live account view — balance, leverage (from your MT4/MT5 account), open positions, pending orders, and closed records. Share PNL cards work the same way as on Blofin.",
    leverageReadonly: "Set in MT5 (or your broker portal) — NovaStaris cannot change it",
    leverageNote:
      "Leverage: change it in MetaTrader (account settings / broker website), then tap Refresh here. We only display what your MT account reports.",
    openCount: "Open ({count})",
    pendingCount: "Pending ({count})",
    closedCount: "Closed ({count})",
    noPositions: "No open positions.",
    noOrders: "No pending (limit/stop) orders.",
    noClosed: "No closed trades in this period.",
    loadFailed: "Failed to load broker connections.",
    connectFailed: "Connect failed.",
    disconnectFailed: "Disconnect failed.",
    serverRequired: "Server is required. Use the exact name from your MT4/MT5 terminal.",
    credentialsRequired: "Login, password, and server are required.",
    loginRequired: "Login is required.",
    provisionWarning: "Saved, but could not link the broker yet. Fix the server name and retry.",
    connectedSuccess: "{broker} connected.",
    disconnectedSuccess: "{broker} disconnected.",
    disconnectConfirm: "Disconnect {broker}? Bots using this broker will stop trading.",
    metaStarting: "Broker link is still starting. Balance appears once the connection finishes — tap Refresh.",
    accountLoadFailed: "Failed to load account.",
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
  forex: Record<keyof typeof en.forex, string>;
};

export type DeepPartialMessages = {
  [K in keyof MessageDict]?: MessageDict[K] extends string
    ? string
    : Partial<MessageDict[K]>;
};
