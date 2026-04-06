import { Hono } from "hono";
import { Amount } from "starkzap";
import { getWalletForUser } from "../services/starkzap.js";
import { resolveToken, toStarkzapToken } from "../services/tokens.js";
import { logTransaction, updateTransactionStatus, type DbUser } from "../services/db.js";

const transfer = new Hono();

transfer.post("/send", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, amount, recipient } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);
  if (!recipient) return c.json({ error: "invalid_recipient", message: "Recipient required" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.transfer(toStarkzapToken(token), [{ to: recipient as any, amount: Amount.parse(amount, token.decimals, token.symbol) }]);
    const txHash = tx.hash || (tx as any).transactionHash;
    logTransaction(user.id, "transfer", JSON.stringify({ tokenSymbol, amount, recipient }), txHash);
    tx.wait().then(() => updateTransactionStatus(txHash, "confirmed")).catch(() => updateTransactionStatus(txHash, "failed"));
    return c.json({ txHash, explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "transfer_error", message: err.message }, 500);
  }
});

// --- Advanced transfer endpoint (mounted at /api/advanced/batch-transfer via advancedTransferRoutes) ---

const advancedTransferRoutes = new Hono();

advancedTransferRoutes.post("/batch-transfer", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, transfers } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const szToken = toStarkzapToken(token);
    const szTransfers = transfers.map((t: any) => ({
      to: t.to as any,
      amount: Amount.parse(t.amount, token.decimals, token.symbol),
    }));
    const tx = await wallet.transfer(szToken, szTransfers);
    logTransaction(user.id, "transfer", JSON.stringify({ tokenSymbol, recipients: transfers.length }), tx.hash);
    tx.wait().then(() => updateTransactionStatus(tx.hash, "confirmed")).catch(() => updateTransactionStatus(tx.hash, "failed"));
    return c.json({ txHash: tx.hash, explorerUrl: tx.explorerUrl, status: "pending", recipients: transfers.length });
  } catch (err: any) {
    return c.json({ error: "batch_transfer_error", message: err.message }, 500);
  }
});

export { advancedTransferRoutes };
export default transfer;
