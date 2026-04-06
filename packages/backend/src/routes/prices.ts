import { Hono } from "hono";
import { getTokenPrices } from "../services/prices.js";
import { getTokenList } from "../services/tokens.js";

const prices = new Hono();

prices.get("/", async (c) => {
  try {
    const tokens = getTokenList().map((t) => ({
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals,
    }));
    const tokenPrices = await getTokenPrices(tokens);
    return c.json({ prices: tokenPrices, count: Object.keys(tokenPrices).length });
  } catch (err: any) {
    return c.json({ error: "price_error", message: err.message }, 500);
  }
});

export default prices;
