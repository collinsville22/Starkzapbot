export const STARKNET_NETWORKS = {
  mainnet: {
    name: "mainnet",
    rpcUrl: "https://starknet-mainnet.public.blastapi.io",
    explorerUrl: "https://starkscan.co",
  },
  sepolia: {
    name: "sepolia",
    rpcUrl: "https://starknet-sepolia.public.blastapi.io",
    explorerUrl: "https://sepolia.starkscan.co",
  },
} as const;

export type NetworkName = keyof typeof STARKNET_NETWORKS;

export const DCA_FREQUENCIES = [
  { label: "12 hours", value: "PT12H" },
  { label: "Daily", value: "P1D" },
  { label: "Weekly", value: "P1W" },
  { label: "Monthly", value: "P1M" },
] as const;

export const DEFAULT_SLIPPAGE_BPS = 100;

export const BRIDGE_CHAINS = ["ethereum", "solana"] as const;
