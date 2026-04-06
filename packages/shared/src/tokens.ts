import type { Token } from "./types.js";

export const PRIORITY_TOKENS = [
  "ETH", "STRK", "USDC", "USDT", "WBTC", "DAI", "wstETH",
  "USDC.e", "tBTC", "LBTC", "EKUBO", "LORDS", "NSTR", "SOL",
  "xSTRK", "sSTRK", "BROTHER", "UNI", "AAVE", "ARB",
];

export const FALLBACK_MAINNET_TOKENS: Record<string, Token> = {
  ETH: { name: "Ether", symbol: "ETH", decimals: 18, address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" },
  STRK: { name: "Starknet Token", symbol: "STRK", decimals: 18, address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" },
  USDC: { name: "USD Coin", symbol: "USDC", decimals: 6, address: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8" },
  USDT: { name: "Tether USD", symbol: "USDT", decimals: 6, address: "0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8" },
  WBTC: { name: "Wrapped Bitcoin", symbol: "WBTC", decimals: 8, address: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac" },
};
