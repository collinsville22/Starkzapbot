import { Hono } from "hono";
import { getTokenList, getAllTokens } from "../services/tokens.js";

const tokens = new Hono();

tokens.get("/", async (c) => {
  try {
    const list = getTokenList();
    return c.json({ tokens: list, count: list.length });
  } catch (err: any) {
    return c.json({ error: "tokens_error", message: err.message }, 500);
  }
});

tokens.get("/:symbol", async (c) => {
  const symbol = c.req.param("symbol");
  const all = getAllTokens();
  const token = all[symbol];
  if (!token) return c.json({ error: "not_found", message: `Token ${symbol} not found` }, 404);
  return c.json({ token });
});

export default tokens;
