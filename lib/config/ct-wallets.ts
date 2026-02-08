export type TrackedWallet = {
  address: string;
  label?: string;
};

// Wallet Tracker: whales, top gainers, smart money. When 3+ of these wallets buy the same token → alert.
export const TRACKED_WALLETS: TrackedWallet[] = [
  { address: "9FNz4MjPUmnJqTf6yEDbL1D4SsHVh7uA8zRhhR5K138r", label: "Whale 1" },
  { address: "3mqTRtejHyFRGGpjKuLw5eT9zFTyy1fhGwbQQEhL3KJ", label: "Whale 2" },
  { address: "5QLUCUFA62q1b2y8TKFf31rL4Qj8zsKTQzuQ8xbTa1o", label: "Smart 1" },
  { address: "49LsvaMuS4mbaKRDT7hWFaFzUR9DRXhegDhLCTDqkdg", label: "Smart 2" },
  { address: "4oZ6Ahtbva72CnxiVcsNBuQZ2tyGzg1QuZh7LfuqBL9v", label: "Tracker 1" },
  { address: "BTf4A2exGK9BCVDNzy65b9dUzXgMqB4weVkvTMFQsadd", label: "Tracker 2" },
  { address: "j1oAbxxiDUWvoHxEDhWE7THLjEkDQW2cSHYn2vttxTF", label: "Tracker 3" },
  { address: "AxgdxFprFTqqU2yxp6a8C2jjVR4Fk1x6jnQU2WbNMpCy", label: "Tracker 4" },
  { address: "AowTUid5daQr9EqwazF7hDm3jBTQSisv6LaHGhQL8k92", label: "Tracker 5" },
  { address: "BKYYNoYNEmDNB4kgqQ12jHHEmGpLFK9hgjsBUjt3Cu6i", label: "Tracker 6" },
  { address: "Cr1n5ZTc1W42zxHQ2LEAHUyvKPrm3ABAHKmFABMh9bKT", label: "Tracker 7" },
];
