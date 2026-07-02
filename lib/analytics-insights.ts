/** Shared helpers for owner App Insights (aggregates + city drill-down). */

export function buildCityLabel(city: string | null, country: string | null): string | null {
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return `Unknown, ${country}`;
  return null;
}

/** Parse UI label like "Baabda, LB" or "Unknown, US". */
export function parseCityLabel(label: string): { city: string | null; country: string } {
  const parts = label.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const country = parts[parts.length - 1]!;
    const cityPart = parts.slice(0, -1).join(', ');
    const city = cityPart === 'Unknown' ? null : cityPart;
    return { city, country };
  }
  return { city: label === 'Unknown' ? null : label, country: 'Unknown' };
}

export function buildCityWhere(city: string | null, country: string) {
  const countryFilter =
    country === 'Unknown'
      ? { OR: [{ country: null }, { country: 'Unknown' }] }
      : { country: { equals: country, mode: 'insensitive' as const } };

  if (!city) {
    return {
      AND: [countryFilter, { OR: [{ city: null }, { city: '' }] }],
    };
  }
  return {
    AND: [countryFilter, { city: { equals: city, mode: 'insensitive' as const } }],
  };
}

const TAB_LABELS: Record<string, string> = {
  new: 'Go Hunting',
  trending: 'Trending',
  surge: 'Surge',
  transactions: 'Transactions',
  'ai-analysis': 'NovaStaris AI Agent',
  futures: 'Crypto Futures',
  'nova-futures-narratives': 'Nova Futures Narratives',
  'nova-eagle': 'Nova Eagle',
  'crypto-buddie': 'Crypto Buddie',
  'meme-intelligence': 'Meme Intelligence',
  'trending-perps': 'Trending perps',
  'perp-radar': 'Perp Radar',
  narratives: 'Narratives',
  'trading-bot': 'NovaStaris AI Trading Bots',
  'polymarket-bot': 'Nova Polymarket',
  'prop-firm-bot': 'Nova Prop Firm Challenge',
  'nova-ultimate': 'Nova Ultimate',
  ct: 'CT Scan',
  wallets: 'Wallet Tracker',
  'coach-calls': 'Coach Calls + Telegram Signals',
  'nova-forecast': 'Nova Forecast',
  'nova-forex': 'Nova Forex',
  'nova-plus': 'Nova Plus',
  'nova-investment': 'Nova Investment',
  'nova-connect': 'Nova Connect',
  bsc: 'BSC',
  watchlist: 'Watchlist',
  'chris-clayton': 'Online Boss',
};

const SUB_LABELS: Record<string, Record<string, string>> = {
  goHunting: {
    new_pairs: 'New pairs',
    final_stretch: 'Final stretch',
    migrated: 'Migrated',
  },
  bsc: {
    new_pairs: 'New pairs',
    final_stretch: 'Final stretch',
    migrated: 'Migrated',
  },
  wallet: {
    meme: 'Meme wallets',
    leverage: 'Leverage wallets',
    'meme-leaderboard': 'Meme leaderboard',
    'deep-meme-agent': 'Deep meme agent',
    'nova-perp-wallet-analyst': 'Nova perp wallet analyst',
  },
  futures: {
    ai: 'AI',
    workflow: 'Workflow',
    altcoins: 'Altcoins',
    'hot-perps': 'Hot perps',
    'liquidation-map': 'Liquidation map',
  },
  forecast: {
    agent: 'Agent',
    'nova-smart': 'Nova Smart',
    'nova-q': 'Nova Q',
    'nova-q-fib': 'Nova Q Fib',
    'nova-extra': 'Nova Extra',
    'nova-pattern': 'Nova Pattern',
    'nova-radar': 'Nova Radar',
    'nova-scalp': 'Nova Scalp',
  },
  boss: {
    chart: 'Chart',
    demandFib: 'Demand Fib',
  },
};

/** Human-readable label for analytics paths (e.g. /?tab=perp-radar → Perp Radar). */
export function formatAnalyticsPathLabel(path: string): string {
  const p = path || '/';
  if (p === '/' || p === '') return 'Home (default tab)';
  try {
    const url = new URL(p, 'https://novastaris.ai');
    const tab = url.searchParams.get('tab');
    if (!tab && url.pathname !== '/') return url.pathname;
    const parts: string[] = [];
    if (tab) parts.push(TAB_LABELS[tab] ?? tab);
    else if (url.pathname === '/') parts.push('Home');
    else parts.push(url.pathname);

    for (const key of ['goHunting', 'bsc', 'wallet', 'futures', 'forecast', 'boss'] as const) {
      const val = url.searchParams.get(key);
      if (val) {
        const subMap = SUB_LABELS[key];
        parts.push(subMap?.[val] ?? val);
      }
    }
    return parts.join(' → ');
  } catch {
    return p;
  }
}

export function insightsDateFilterFromUrl(url: URL): { createdAt?: { gte: Date; lt?: Date } } {
  const dateParam = url.searchParams.get('date');
  const allParam = url.searchParams.get('all');
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const since = new Date(dateParam + 'T00:00:00.000Z');
    const end = new Date(since);
    end.setUTCDate(end.getUTCDate() + 1);
    return { createdAt: { gte: since, lt: end } };
  }
  if (allParam === '1' || allParam === 'true') return {};
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10) || 30));
  const since = new Date();
  since.setDate(since.getDate() - days);
  return { createdAt: { gte: since } };
}
