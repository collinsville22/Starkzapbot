import { getPresets, ChainId } from "starkzap";
import type { Token } from "@starkzap-tg/shared";
import { PRIORITY_TOKENS, FALLBACK_MAINNET_TOKENS } from "@starkzap-tg/shared";
import { log } from "../utils/logger.js";

let cachedTokens: Record<string, Token> | null = null;
let cachedTokenList: Token[] | null = null;

function getChainId(): ChainId {
  const network = process.env.STARKNET_NETWORK || "mainnet";
  return network === "mainnet" ? ChainId.MAINNET : ChainId.SEPOLIA;
}

export function getAllTokens(): Record<string, Token> {
  if (cachedTokens) return cachedTokens;

  try {
    const presets = getPresets(getChainId());
    const tokens: Record<string, Token> = {};

    for (const [, token] of Object.entries(presets)) {
      tokens[token.symbol] = {
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        address: token.address as string,
        logoUrl: token.metadata?.logoUrl?.toString(),
      };
    }

    log.info("tokens", `Loaded ${Object.keys(tokens).length} tokens from StarkZap SDK`);
    cachedTokens = tokens;
    return tokens;
  } catch (err: any) {
    log.warn("tokens", `SDK getPresets failed, using fallback: ${err.message}`);
    cachedTokens = FALLBACK_MAINNET_TOKENS;
    return FALLBACK_MAINNET_TOKENS;
  }
}

export function getTokenList(): Token[] {
  if (cachedTokenList) return cachedTokenList;

  const all = getAllTokens();
  const priority: Token[] = [];
  const rest: Token[] = [];

  for (const symbol of PRIORITY_TOKENS) {
    if (all[symbol]) priority.push(all[symbol]);
  }

  for (const [symbol, token] of Object.entries(all)) {
    if (!PRIORITY_TOKENS.includes(symbol)) {
      rest.push(token);
    }
  }

  cachedTokenList = [...priority, ...rest];
  return cachedTokenList;
}

export function resolveToken(symbol: string): Token | null {
  const all = getAllTokens();
  return all[symbol] || null;
}

export function toStarkzapToken(token: Token) {
  return { ...token, address: token.address as any };
}

export function clearTokenCache() {
  cachedTokens = null;
  cachedTokenList = null;
}
