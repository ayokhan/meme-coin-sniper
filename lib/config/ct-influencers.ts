/**
 * EXPANDED CT INFLUENCER LIST — 100+ ACCOUNTS
 * Top Solana meme coin callers and alpha accounts
 */

/** TIER 1: ELITE ALPHA CALLERS (20) — 3.0x weight */
export const TIER_1_INFLUENCERS = [
  'blknoiz06',
  'CryptoGodJohn',
  'AltcoinGordon',
  'ansemweb3',
  'trades_dev',
  'OxSunDoc',
  'CryptoKol',
  'wallstreetbets',
  'Flurpify',
  'Pauly0x',
  '0xSisyphus',
  'DefiSquared',
  'cryptofinally',
  'TheCryptoDog',
  'WazzCrypto',
  'CryptoBullet1',
  'MilkRoadDaily',
  'DegenSpartanAI',
  'Flip__JPEG',
  'gainzy222',
];

/** TIER 2: MOMENTUM & CONFIRMATION (30) — 2.0x weight */
export const TIER_2_INFLUENCERS = [
  'CryptoCobain',
  'CryptoCapo_',
  'TheFlowHorse',
  'Oxngmi',
  'JustinBennettFX',
  'CryptoWzrd',
  'CryptoMessiah',
  'AltcoinPsycho',
  'CryptoKaleo',
  'IncomeSharks',
  'ShardiB2',
  'solanasaylor',
  'solanacorn',
  'degentradingLSD',
  'TraderXO',
  'AltcoinGems',
  'AltcoinDaily',
  'CryptoWendyO',
  'TheCryptoLark',
  'Pentosh1',
  'CryptoGirlNova',
  'AltcoinBuzzio',
  'CryptoTea_',
  'TheMoonCarl',
  'CryptoRover',
  'IvanOnTech',
  'Sheldon_Sniper',
  'AltCryptoGems',
  'CryptoGodfather',
  'TheWhaleMonitor',
];

/** TIER 3: SOLANA ECOSYSTEM (15) — 2.5x weight */
export const TIER_3_ECOSYSTEM = [
  'solanafndn',
  'heliuslabs',
  'phantom',
  'JupiterExchange',
  'ALX',
  'rajgokal',
  'aeyakovenko',
  'mertimus',
  'solana',
  'SolanaFloor',
  'magic_eden',
  'ProjectSerum',
  'orca_so',
  'SolanaLegend',
  'Marinade_Finance',
];

/** TIER 4: MEME LORDS & CULTURE (20) — 1.5x weight */
export const TIER_4_CULTURE = [
  'Zeneca',
  'FarokkhSarmad',
  'CryptoFinally',
  'TraderSZ',
  'CryptoBirb',
  'JoeConsorti',
  'MustStopMurad',
  'beaniemaxi',
  'FomoSapiens',
  'TheStalwart',
  'cobie',
  'VentureCoinist',
  '0xRacerAlt',
  'ThinkingUSD',
  'Route2FI',
  'GiganticRebirth',
  'LomahCrypto',
  'BigCheds',
];

/** TIER 5: WHALES & SMART MONEY (25) — 2.5x weight */
export const TIER_5_WHALES = [
  'GCRClassic',
  'ByzGeneral',
  'CryptoCred',
  'maxkeiser',
  'scottmelker',
  'APompliano',
  'RaoulGMI',
  'VitalikButerin',
  'intocryptoverse',
  'CryptoGarga',
  'DonAlt',
  'HsakaTrades',
  'CryptoCapital',
  'RookieXBT',
  'CanteringClark',
  'SmartContracter',
  'WClementeThird',
  'ki_young_ju',
  'WhalePanda',
  'PeterLBrandt',
  'Bloqport',
  'whale_alert',
];

/** TIER 6: NEWS & AGGREGATORS (15) — 1.0x weight */
export const TIER_6_NEWS = [
  'Cointelegraph',
  'CoinDesk',
  'TheBlock__',
  'Decrypt',
  'bitcoinmagazine',
  'FXHedge',
  'unusual_whales',
  'WatcherGuru',
  'tier10k',
  'KookCapitalLLC',
  'DocumentingBTC',
  'WuBlockchain',
  'CryptoRank_io',
  'glassnode',
  'santimentfeed',
];

/** Combined list, deduped (first occurrence wins tier) */
export const ALL_CT_INFLUENCERS = [
  ...TIER_1_INFLUENCERS,
  ...TIER_2_INFLUENCERS,
  ...TIER_3_ECOSYSTEM,
  ...TIER_4_CULTURE,
  ...TIER_5_WHALES,
  ...TIER_6_NEWS,
].filter((h, i, a) => a.indexOf(h) === i);

/** How many handles we send to Apify per run (API limits) */
export const MONITORED_CT_LIMIT = 55;

export function getAccountWeight(username: string): number {
  if (TIER_1_INFLUENCERS.includes(username)) return 3.0;
  if (TIER_2_INFLUENCERS.includes(username)) return 2.0;
  if (TIER_3_ECOSYSTEM.includes(username)) return 2.5;
  if (TIER_4_CULTURE.includes(username)) return 1.5;
  if (TIER_5_WHALES.includes(username)) return 2.5;
  if (TIER_6_NEWS.includes(username)) return 1.0;
  return 1.0;
}

export function getAccountTier(username: string): string {
  if (TIER_1_INFLUENCERS.includes(username)) return 'Elite Alpha';
  if (TIER_2_INFLUENCERS.includes(username)) return 'Momentum';
  if (TIER_3_ECOSYSTEM.includes(username)) return 'Ecosystem';
  if (TIER_4_CULTURE.includes(username)) return 'Culture';
  if (TIER_5_WHALES.includes(username)) return 'Whale';
  if (TIER_6_NEWS.includes(username)) return 'News';
  return 'Unknown';
}
