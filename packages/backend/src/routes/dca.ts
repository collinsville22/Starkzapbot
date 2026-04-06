import { Hono } from "hono";
import { Amount, AvnuDcaProvider } from "starkzap";
import { getReadOnlyWallet } from "../services/starkzap.js";
import { resolveToken, toStarkzapToken } from "../services/tokens.js";
import { logTransaction, updateTransactionStatus, type DbUser } from "../services/db.js";

const dca = new Hono();

function ensureDcaProvider(wallet: any) {
  try { wallet.dca().getDefaultDcaProvider(); } catch {
    wallet.dca().registerProvider(new AvnuDcaProvider(), true);
  }
}

dca.get("/orders", async (c) => {
  const user = c.get("user") as DbUser;
  const status = c.req.query("status") as any;
  try {
    const wallet = await getReadOnlyWallet(user.wallet_address);
    ensureDcaProvider(wallet);
    const result = await wallet.dca().getOrders({ status: status || undefined });
    return c.json({
      orders: (result.orders || []).map((o: any) => ({
        id: o.id, providerId: o.providerId, status: o.status,
        sellTokenAddress: o.sellTokenAddress, buyTokenAddress: o.buyTokenAddress,
        sellAmountBase: o.sellAmountBase?.toString(),
        amountSoldBase: o.amountSoldBase?.toString(),
        amountBoughtBase: o.amountBoughtBase?.toString(),
        frequency: o.frequency, iterations: o.iterations,
        startDate: o.startDate?.toISOString(), endDate: o.endDate?.toISOString(),
        executedTradesCount: o.executedTradesCount,
        pendingTradesCount: o.pendingTradesCount,
        orderAddress: o.orderAddress,
        trades: (o.trades || []).slice(0, 20).map((t: any) => ({
          status: t.status, sellAmountBase: t.sellAmountBase?.toString(),
          buyAmountBase: t.buyAmountBase?.toString(),
          expectedTradeDate: t.expectedTradeDate?.toISOString(),
          txHash: t.txHash,
        })),
      })),
      total: result.orders?.length || 0,
    });
  } catch (err: any) {
    return c.json({ error: "dca_orders_error", message: err.message, orders: [] }, 500);
  }
});

dca.post("/create", async (c) => {
  const user = c.get("user") as DbUser;
  const { sellTokenSymbol, buyTokenSymbol, totalAmount, amountPerCycle, frequency } = await c.req.json();
  const sellToken = resolveToken(sellTokenSymbol);
  const buyToken = resolveToken(buyTokenSymbol);
  if (!sellToken || !buyToken) return c.json({ error: "invalid_token" }, 400);
  if (!frequency) return c.json({ error: "frequency_required" }, 400);
  try {
    const wallet = await getReadOnlyWallet(user.wallet_address);
    ensureDcaProvider(wallet);
    const tx = await wallet.dca().create({
      sellToken: toStarkzapToken(sellToken), buyToken: toStarkzapToken(buyToken),
      sellAmount: Amount.parse(totalAmount, sellToken.decimals, sellToken.symbol),
      sellAmountPerCycle: Amount.parse(amountPerCycle, sellToken.decimals, sellToken.symbol),
      frequency,
    });
    logTransaction(user.id, "dca", JSON.stringify({ sellTokenSymbol, buyTokenSymbol, totalAmount, frequency }), tx.hash);
    tx.wait().then(() => updateTransactionStatus(tx.hash, "confirmed")).catch(() => updateTransactionStatus(tx.hash, "failed"));
    return c.json({ txHash: tx.hash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "dca_create_error", message: err.message }, 500);
  }
});

dca.post("/cancel", async (c) => {
  const user = c.get("user") as DbUser;
  const { orderId, orderAddress } = await c.req.json();
  try {
    const wallet = await getReadOnlyWallet(user.wallet_address);
    ensureDcaProvider(wallet);
    const tx = await wallet.dca().cancel({ orderId, orderAddress });
    logTransaction(user.id, "dca", JSON.stringify({ action: "cancel", orderId }), tx.hash);
    tx.wait().then(() => updateTransactionStatus(tx.hash, "confirmed")).catch(() => updateTransactionStatus(tx.hash, "failed"));
    return c.json({ txHash: tx.hash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "dca_cancel_error", message: err.message }, 500);
  }
});

dca.post("/preview", async (c) => {
  const user = c.get("user") as DbUser;
  const { sellTokenSymbol, buyTokenSymbol, amountPerCycle } = await c.req.json();
  const sellToken = resolveToken(sellTokenSymbol);
  const buyToken = resolveToken(buyTokenSymbol);
  if (!sellToken || !buyToken) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getReadOnlyWallet(user.wallet_address);
    ensureDcaProvider(wallet);
    const quote = await wallet.dca().previewCycle({
      sellToken: toStarkzapToken(sellToken), buyToken: toStarkzapToken(buyToken),
      sellAmountPerCycle: Amount.parse(amountPerCycle, sellToken.decimals, sellToken.symbol),
    });
    return c.json({ amountIn: quote.amountInBase.toString(), amountOut: quote.amountOutBase.toString(), provider: quote.provider });
  } catch (err: any) {
    return c.json({ error: "preview_error", message: err.message }, 500);
  }
});

export default dca;
