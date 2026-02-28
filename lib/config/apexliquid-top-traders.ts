export type ApexLiquidTrader = {
  address: string;
  label?: string;
};

/** ApexLiquid top traders (Hyperliquid perps). Used to show their long/short positions. */
export const APEXLIQUID_TOP_TRADERS: ApexLiquidTrader[] = [
  { address: "0x7a8862d9cfab25a31f6754199bde7945ec23de62" },
  { address: "0xa641557ad21090503498f6cef460e897ac6aa982" },
  { address: "0xe42921388db8d4164aa819dd948578b3b7facf10" },
  { address: "0xcdc784389ce6f038a653c29b7c92248a17f5b60a" },
  { address: "0x5bcb085d7fadba61507a3aee9e832cbfa331f5dd" },
];
