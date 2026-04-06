import { log } from "../utils/logger.js";

const AVNU_API = "https://starknet.api.avnu.fi/swap/v2/quotes";
const USDC_ADDRESS = "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
const USDC_DECIMALS = 6;

interface PriceCache {
  prices: Record<string, number>; // symbol → USD price
  timestamp: number;
}

let cache: PriceCache | null = null;
const CACHE_TTL = 60_000; // 1 min

async function fetchPrice(tokenAddress: string, decimals: number): Promise<number> {
  try {
    const sellAmount = (BigInt(10) * BigInt(10 ** decimals)).toString(16);
    const url = `${AVNU_API}?sellTokenAddress=${tokenAddress}&buyTokenAddress=${USDC_ADDRESS}&sellAmount=0x${sellAmount}&size=1`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return 0;

    const data = await res.json();
    if (Array.isArray(data) && data[0]?.buyAmount) {
      return Number(BigInt(data[0].buyAmount)) / (10 ** USDC_DECIMALS) / 10;
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function getTokenPrices(
  tokens: Array<{ symbol: string; address: string; decimals: number }>
): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return cache.prices;
  }

  const prices: Record<string, number> = { USDC: 1, "USDC.e": 1, USDT: 1, DAI: 1, LUSD: 1 };

  const toFetch = tokens.filter(
    (t) => !prices[t.symbol] && t.address !== USDC_ADDRESS
  ).slice(0, 15);

  const results = await Promise.allSettled(
    toFetch.map(async (t) => {
      const price = await fetchPrice(t.address, t.decimals);
      return { symbol: t.symbol, price };
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value.price > 0) {
      prices[r.value.symbol] = r.value.price;
    }
  }

  cache = { prices, timestamp: now };
  log.info("prices", `Fetched ${Object.keys(prices).length} prices from AVNU`);
  return prices;
}

export function getCachedPrice(symbol: string): number {
  return cache?.prices[symbol] || 0;
}

export function clearPriceCache() {
  cache = null;
}
