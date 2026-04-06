import { Hono } from "hono";
import { Amount } from "starkzap";
import { getWalletForUser } from "../services/starkzap.js";
import { resolveToken, toStarkzapToken } from "../services/tokens.js";
import { logTransaction, updateTransactionStatus, type DbUser } from "../services/db.js";

const swap = new Hono();

swap.post("/quote", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenIn: tokenInSymbol, tokenOut: tokenOutSymbol, amountIn, slippageBps } = await c.req.json();

  const tokenIn = resolveToken(tokenInSymbol);
  const tokenOut = resolveToken(tokenOutSymbol);
  if (!tokenIn || !tokenOut) return c.json({ error: "invalid_token", message: "Unknown token symbol" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const amount = Amount.parse(amountIn, tokenIn.decimals, tokenIn.symbol);

    const quote = await wallet.getQuote({
      tokenIn: toStarkzapToken(tokenIn),
      tokenOut: toStarkzapToken(tokenOut),
      amountIn: amount,
      slippageBps: BigInt(slippageBps ?? 100),
    });

    return c.json({
      amountIn,
      amountOut: Amount.fromRaw(quote.amountOutBase, tokenOut.decimals, tokenOut.symbol).toUnit(),
      priceImpactBps: quote.priceImpactBps?.toString() ?? null,
      provider: quote.provider ?? "default",
      tokenIn,
      tokenOut,
    });
  } catch (err: any) {
    return c.json({ error: "quote_error", message: err.message }, 500);
  }
});

swap.post("/execute", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenIn: tokenInSymbol, tokenOut: tokenOutSymbol, amountIn, slippageBps } = await c.req.json();

  const tokenIn = resolveToken(tokenInSymbol);
  const tokenOut = resolveToken(tokenOutSymbol);
  if (!tokenIn || !tokenOut) return c.json({ error: "invalid_token", message: "Unknown token symbol" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const amount = Amount.parse(amountIn, tokenIn.decimals, tokenIn.symbol);

    const tx = await wallet.swap({
      tokenIn: toStarkzapToken(tokenIn),
      tokenOut: toStarkzapToken(tokenOut),
      amountIn: amount,
      slippageBps: BigInt(slippageBps ?? 100),
    });

    const txHash = tx.hash || (tx as any).transactionHash;
    const explorerUrl = tx.explorerUrl || null;

    logTransaction(user.id, "swap", JSON.stringify({ tokenIn: tokenInSymbol, tokenOut: tokenOutSymbol, amountIn }), txHash);
    tx.wait().then(() => updateTransactionStatus(txHash, "confirmed")).catch(() => updateTransactionStatus(txHash, "failed"));

    return c.json({ txHash, explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "swap_error", message: err.message }, 500);
  }
});

// --- Advanced swap endpoints (mounted at /api/advanced/* via advancedSwapRoutes) ---

const advancedSwapRoutes = new Hono();

advancedSwapRoutes.post("/estimate-fee", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenInSymbol, tokenOutSymbol, amount, slippageBps } = await c.req.json();
  const tokenIn = resolveToken(tokenInSymbol);
  const tokenOut = resolveToken(tokenOutSymbol);
  if (!tokenIn || !tokenOut) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const prepared = await wallet.prepareSwap({
      tokenIn: toStarkzapToken(tokenIn), tokenOut: toStarkzapToken(tokenOut),
      amountIn: Amount.parse(amount, tokenIn.decimals, tokenIn.symbol),
      slippageBps: slippageBps ? BigInt(slippageBps) : undefined,
    });
    const fee = await wallet.estimateFee(prepared.calls);
    return c.json({
      overallFee: fee.overall_fee?.toString(),
      gasPrice: fee.gas_price?.toString(),
      gasConsumed: fee.gas_consumed?.toString(),
    });
  } catch (err: any) {
    return c.json({ error: "fee_error", message: err.message }, 500);
  }
});

advancedSwapRoutes.post("/preflight", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenInSymbol, tokenOutSymbol, amount } = await c.req.json();
  const tokenIn = resolveToken(tokenInSymbol);
  const tokenOut = resolveToken(tokenOutSymbol);
  if (!tokenIn || !tokenOut) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const prepared = await wallet.prepareSwap({
      tokenIn: toStarkzapToken(tokenIn), tokenOut: toStarkzapToken(tokenOut),
      amountIn: Amount.parse(amount, tokenIn.decimals, tokenIn.symbol),
    });
    const result = await wallet.preflight({ calls: prepared.calls });
    return c.json(result);
  } catch (err: any) {
    return c.json({ ok: false, reason: err.message });
  }
});

advancedSwapRoutes.post("/swap", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenInSymbol, tokenOutSymbol, amount, slippageBps, provider } = await c.req.json();
  const tokenIn = resolveToken(tokenInSymbol);
  const tokenOut = resolveToken(tokenOutSymbol);
  if (!tokenIn || !tokenOut) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.swap({
      tokenIn: toStarkzapToken(tokenIn), tokenOut: toStarkzapToken(tokenOut),
      amountIn: Amount.parse(amount, tokenIn.decimals, tokenIn.symbol),
      slippageBps: slippageBps ? BigInt(slippageBps) : undefined,
      provider: provider || undefined,
    });
    logTransaction(user.id, "swap", JSON.stringify({ tokenInSymbol, tokenOutSymbol, amount, slippageBps }), tx.hash);
    tx.wait().then(() => updateTransactionStatus(tx.hash, "confirmed")).catch(() => updateTransactionStatus(tx.hash, "failed"));
    return c.json({ txHash: tx.hash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "swap_error", message: err.message }, 500);
  }
});

advancedSwapRoutes.post("/quote", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenInSymbol, tokenOutSymbol, amount, slippageBps, provider } = await c.req.json();
  const tokenIn = resolveToken(tokenInSymbol);
  const tokenOut = resolveToken(tokenOutSymbol);
  if (!tokenIn || !tokenOut) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const quote = await wallet.getQuote({
      tokenIn: toStarkzapToken(tokenIn), tokenOut: toStarkzapToken(tokenOut),
      amountIn: Amount.parse(amount, tokenIn.decimals, tokenIn.symbol),
      slippageBps: slippageBps ? BigInt(slippageBps) : undefined,
      provider: provider || undefined,
    });
    return c.json({
      amountIn: quote.amountInBase.toString(), amountOut: quote.amountOutBase.toString(),
      provider: quote.provider, priceImpactBps: quote.priceImpactBps?.toString() || null,
    });
  } catch (err: any) {
    return c.json({ error: "quote_error", message: err.message }, 500);
  }
});

advancedSwapRoutes.get("/swap-providers", async (c) => {
  const user = c.get("user") as DbUser;
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const providers = wallet.listSwapProviders();
    const def = wallet.getDefaultSwapProvider();
    return c.json({ providers, default: def?.id || providers[0] });
  } catch (err: any) {
    return c.json({ providers: ["avnu"], default: "avnu" });
  }
});

export { advancedSwapRoutes };
export default swap;
