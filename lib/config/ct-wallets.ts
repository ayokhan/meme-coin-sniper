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
];
