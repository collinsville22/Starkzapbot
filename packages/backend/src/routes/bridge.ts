import { Hono } from "hono";
import { ExternalChain, Amount } from "starkzap";
import { getSdk, getWalletForUser } from "../services/starkzap.js";
import { getAllTokens } from "../services/tokens.js";
import { logTransaction, type DbUser } from "../services/db.js";

const bridge = new Hono();

bridge.get("/tokens", async (c) => {
  const chain = c.req.query("chain");
  try {
    const externalChain = chain === "ethereum"
      ? ExternalChain.ETHEREUM
      : chain === "solana"
        ? ExternalChain.SOLANA
        : undefined;

    const bridgeTokens = await getSdk().getBridgingTokens(externalChain);
    const presets = getAllTokens();

    return c.json({
      tokens: bridgeTokens.map((t) => {
        const preset = presets[t.symbol];
        return {
          symbol: t.symbol,
          name: t.name,
          decimals: t.decimals,
          chain: t.chain,
          protocol: t.protocol,
          address: t.address,
          starknetAddress: t.starknetAddress,
          logoUrl: preset?.logoUrl || null,
        };
      }),
    });
  } catch (err: any) {
    return c.json({ error: "bridge_error", message: err.message }, 500);
  }
});

bridge.post("/estimate", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, chain, amount } = await c.req.json();

  try {
    const sdk = getSdk();
    const externalChain = chain === "ethereum" ? ExternalChain.ETHEREUM : ExternalChain.SOLANA;
    const bridgeTokens = await sdk.getBridgingTokens(externalChain);
    const bridgeToken = bridgeTokens.find((t) => t.symbol === tokenSymbol);

    if (!bridgeToken) {
      return c.json({ error: "token_not_found", message: `${tokenSymbol} not bridgeable from ${chain}` }, 400);
    }

    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);

    return c.json({
      token: { symbol: bridgeToken.symbol, name: bridgeToken.name, decimals: bridgeToken.decimals },
      protocol: bridgeToken.protocol,
      chain: bridgeToken.chain,
      starknetAddress: bridgeToken.starknetAddress,
      destinationAddress: wallet.address,
    });
  } catch (err: any) {
    return c.json({ error: "estimate_error", message: err.message }, 500);
  }
});

export default bridge;
