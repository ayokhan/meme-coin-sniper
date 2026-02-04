export type TrackedWallet = {
  address: string;
  label?: string;
};

// Wallet Tracker: whales, top gainers, smart money. When 3+ of these wallets buy the same token → alert.
export const TRACKED_WALLETS: TrackedWallet[] = [
  // { address: "…", label: "Whale 1" },
];
