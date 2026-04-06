import { Hono } from "hono";
import { getReadOnlyWallet } from "../services/starkzap.js";
import { getTokenList, toStarkzapToken } from "../services/tokens.js";
import { getTokenPrices } from "../services/prices.js";
import type { DbUser } from "../services/db.js";

const portfolio = new Hono();

portfolio.get("/", async (c) => {
  const user = c.get("user") as DbUser;

  try {
    const wallet = await getReadOnlyWallet(user.wallet_address);

    const tokenList = getTokenList();

    const [balances, prices] = await Promise.all([
      Promise.all(
        tokenList.map(async (tokenDef) => {
          try {
            const balance = await wallet.balanceOf(toStarkzapToken(tokenDef));
            return {
              token: tokenDef,
              balance: balance.toUnit(),
              balanceRaw: balance.toBase().toString(),
            };
          } catch {
            return { token: tokenDef, balance: "0", balanceRaw: "0" };
          }
        })
      ),
      getTokenPrices(tokenList.map((t) => ({ symbol: t.symbol, address: t.address, decimals: t.decimals }))),
    ]);

    let totalUsd = 0;
    const balancesWithUsd = balances.map((b) => {
      const price = prices[b.token.symbol] || 0;
      const bal = parseFloat(b.balance) || 0;
      const usdValue = bal * price;
      totalUsd += usdValue;
      return { ...b, price, usdValue: Math.round(usdValue * 100) / 100 };
    });

    return c.json({
      walletAddress: user.wallet_address,
      balances: balancesWithUsd,
      totalUsd: Math.round(totalUsd * 100) / 100,
      prices,
    });
  } catch (err: any) {
    return c.json({ error: "portfolio_error", message: err.message }, 500);
  }
});

export default portfolio;
