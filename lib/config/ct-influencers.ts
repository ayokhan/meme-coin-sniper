export const TIER_1_INFLUENCERS = ['blknoiz06', 'CryptoGodJohn', 'AltcoinGordon', 'TheCryptoDog', 'WazzCrypto', 'CryptoBullet1', 'MilkRoadDaily', 'DegenSpartanAI', 'Flip__JPEG', 'ansemweb3'];
export const TIER_2_INFLUENCERS = ['CryptoCobain', 'CryptoCapo_', 'TheFlowHorse', 'Oxngmi', 'JustinBennettFX', 'CryptoWzrd', 'CryptoMessiah', 'AltcoinPsycho', 'CryptoKaleo', 'IncomeSharks', 'ShardiB2', 'solanasaylor', 'solanacorn', 'degentradingLSD', 'TraderXO'];
export const TIER_3_ECOSYSTEM = ['solanafndn', 'heliuslabs', 'phantom', 'JupiterExchange', 'ALX', 'rajgokal', 'aeyakovenko', 'mertimus'];
export const TIER_4_CULTURE = ['Zeneca', 'FarokkhSarmad', 'CryptoFinally', 'TraderSZ', 'CryptoBirb', 'gainzy222', 'JoeConsorti', 'MustStopMurad'];
export const TIER_5_WHALES = ['GCRClassic', 'ByzGeneral', 'ThinkingUSD', 'Route2FI', 'CryptoCred'];

// Founders / exchange leads (e.g. Changpeng Zhao)
export const TIER_FOUNDERS = ['cz_binance'];

// Extra Solana / meme-heavy accounts — more CT = more token mentions (no duplicates of tiers above)
export const TIER_MEME_SOLANA = [
  'el_crypto_prof', 'DocumentingBTC', 'CryptoJelleNL', 'AltcoinSherpa', 'woonomic',
  'CanteringClark', 'CryptoDonAlt', 'HsakaTrades', 'Pentosh1', 'TheCryptoLark',
  'CryptoBanter', 'CryptoChase', 'CryptoGainz', 'Blknoiz', 'CryptoDormant',
  'Crypto_Maximalist', 'CryptoWendyO', 'solanabch', 'blockchainbacker',
];

export const ALL_CT_INFLUENCERS = [
  ...TIER_1_INFLUENCERS,
  ...TIER_2_INFLUENCERS,
  ...TIER_3_ECOSYSTEM,
  ...TIER_4_CULTURE,
  ...TIER_5_WHALES,
  ...TIER_FOUNDERS,
  ...TIER_MEME_SOLANA,
];

export const MONITORED_CT_LIMIT = 35; // How many handles we send to Apify per run (more = more coverage)

export function getAccountWeight(username: string): number {
  if (TIER_1_INFLUENCERS.includes(username)) return 3.0;
  if (TIER_2_INFLUENCERS.includes(username)) return 2.0;
  if (TIER_3_ECOSYSTEM.includes(username)) return 2.5;
  if (TIER_4_CULTURE.includes(username)) return 1.5;
  if (TIER_5_WHALES.includes(username)) return 2.5;
  if (TIER_FOUNDERS.includes(username)) return 3.0;
  if (TIER_MEME_SOLANA.includes(username)) return 1.8;
  return 1.0;
}
