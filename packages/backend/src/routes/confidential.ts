import { Hono } from "hono";
import { TongoConfidential, Amount } from "starkzap";
import { getWalletForUser } from "../services/starkzap.js";
import { resolveToken, toStarkzapToken } from "../services/tokens.js";
import { logTransaction, updateTransactionStatus, type DbUser } from "../services/db.js";

const confidential = new Hono();

const TONGO_CONTRACTS: Record<string, string> = {
  STRK: "0x3a542d7eb73b3e33a2c54e9827ec17a6365e289ec35ccc94dde97950d9db498",
  ETH: "0x276e11a5428f6de18a38b7abc1d60abc75ce20aa3a925e20a393fcec9104f89",
  WBTC: "0x6d82c8c467eac77f880a1d5a090e0e0094a557bf67d74b98ba1881200750e27",
  "USDC.e": "0x72098b84989a45cc00697431dfba300f1f5d144ae916e98287418af4e548d96",
  USDC: "0x026f79017c3c382148832c6ae50c22502e66f7a2f81ccbdb9e1377af31859d3a",
  USDT: "0x659c62ba8bc3ac92ace36ba190b350451d0c767aa973dd63b042b59cc065da0",
  DAI: "0x511741b1ad1777b4ad59fbff49d64b8eb188e2aeb4fc72438278a589d8a10d8",
};

confidential.get("/info", async (c) => {
  return c.json({
    protocol: "Tongo",
    status: "live",
    description: "Privacy-preserving token transfers using zero-knowledge proofs on Starknet",
    features: [
      "Fund: deposit tokens into confidential account",
      "Transfer: send tokens privately (ZK proofs, no visible amounts)",
      "Withdraw: convert confidential balance back to public tokens",
      "Ragequit: emergency full withdrawal",
      "Rollover: activate pending balance",
    ],
    supportedTokens: Object.keys(TONGO_CONTRACTS),
    contracts: TONGO_CONTRACTS,
  });
});

function createTongoProvider(wallet: any, tokenSymbol: string) {
  const contractAddress = TONGO_CONTRACTS[tokenSymbol];
  if (!contractAddress) throw new Error(`Tongo not available for ${tokenSymbol}. Supported: ${Object.keys(TONGO_CONTRACTS).join(", ")}`);

  const provider = wallet.getProvider();
  return new TongoConfidential({
    privateKey: wallet.getAccount().signer.pk,
    contractAddress: contractAddress as any,
    provider,
  });
}

confidential.get("/my-id", async (c) => {
  const user = c.get("user") as DbUser;
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tongo = createTongoProvider(wallet, "STRK");
    return c.json({
      recipientId: { x: tongo.recipientId.x.toString(), y: tongo.recipientId.y.toString() },
      tongoAddress: tongo.address,
      walletAddress: wallet.address,
    });
  } catch (err: any) {
    return c.json({ error: "id_error", message: err.message }, 500);
  }
});

confidential.post("/resolve", async (c) => {
  const { walletAddress } = await c.req.json();
  if (!walletAddress) return c.json({ error: "address_required" }, 400);
  try {
    const { db } = await import("../services/db.js");
    const targetUser = db.prepare("SELECT * FROM users WHERE wallet_address = ?").get(walletAddress) as any;
    if (!targetUser) return c.json({ error: "user_not_found", message: "This address is not a StarkZap user" }, 404);

    const targetWallet = await getWalletForUser(targetUser.telegram_id, targetUser.encrypted_private_key);
    const tongo = createTongoProvider(targetWallet, "STRK");
    return c.json({
      recipientId: { x: tongo.recipientId.x.toString(), y: tongo.recipientId.y.toString() },
      tongoAddress: tongo.address,
    });
  } catch (err: any) {
    return c.json({ error: "resolve_error", message: err.message }, 500);
  }
});

confidential.post("/balance", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol } = await c.req.json();
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tongo = createTongoProvider(wallet, tokenSymbol);
    const state = await tongo.getState();
    return c.json({
      balance: state.balance.toString(),
      pending: state.pending.toString(),
      nonce: state.nonce.toString(),
      address: tongo.address,
      recipientId: tongo.recipientId,
    });
  } catch (err: any) {
    return c.json({ error: "balance_error", message: err.message }, 500);
  }
});

confidential.post("/fund", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, amount } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tongo = createTongoProvider(wallet, tokenSymbol);
    const fundAmount = Amount.parse(amount, token.decimals, token.symbol);

    const tx = await wallet.tx()
      .confidentialFund(tongo, { amount: fundAmount, sender: wallet.address })
      .send();

    const txHash = tx.hash || (tx as any).transactionHash;
    logTransaction(user.id, "confidential", JSON.stringify({ action: "fund", tokenSymbol, amount }), txHash);
    tx.wait().then(() => updateTransactionStatus(txHash, "confirmed")).catch(() => updateTransactionStatus(txHash, "failed"));
    return c.json({ txHash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "fund_error", message: err.message }, 500);
  }
});

confidential.post("/transfer", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, amount, recipientAddress, recipientX, recipientY } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token" }, 400);

  let toKey: { x: string; y: string };

  if (recipientAddress) {
    try {
      const { db } = await import("../services/db.js");
      const targetUser = db.prepare("SELECT * FROM users WHERE wallet_address = ?").get(recipientAddress) as any;
      if (!targetUser) return c.json({ error: "user_not_found", message: "Recipient is not a StarkZap user. For external recipients, use X/Y coordinates." }, 404);
      const targetWallet = await getWalletForUser(targetUser.telegram_id, targetUser.encrypted_private_key);
      const targetTongo = createTongoProvider(targetWallet, "STRK");
      toKey = { x: targetTongo.recipientId.x.toString(), y: targetTongo.recipientId.y.toString() };
    } catch (err: any) {
      return c.json({ error: "resolve_error", message: err.message }, 500);
    }
  } else if (recipientX && recipientY) {
    toKey = { x: recipientX, y: recipientY };
  } else {
    return c.json({ error: "recipient_required", message: "Provide recipientAddress or recipientX+recipientY" }, 400);
  }

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tongo = createTongoProvider(wallet, tokenSymbol);
    const transferAmount = Amount.parse(amount, token.decimals, token.symbol);

    const tx = await wallet.tx()
      .confidentialTransfer(tongo, {
        amount: transferAmount,
        to: toKey as any,
        sender: wallet.address,
      })
      .send();

    const txHash = tx.hash || (tx as any).transactionHash;
    logTransaction(user.id, "confidential", JSON.stringify({ action: "transfer", tokenSymbol, amount }), txHash);
    tx.wait().then(() => updateTransactionStatus(txHash, "confirmed")).catch(() => updateTransactionStatus(txHash, "failed"));
    return c.json({ txHash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "transfer_error", message: err.message }, 500);
  }
});

confidential.post("/withdraw", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, amount, toAddress } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tongo = createTongoProvider(wallet, tokenSymbol);
    const withdrawAmount = Amount.parse(amount, token.decimals, token.symbol);

    const tx = await wallet.tx()
      .confidentialWithdraw(tongo, {
        amount: withdrawAmount,
        to: (toAddress || wallet.address) as any,
        sender: wallet.address,
      })
      .send();

    const txHash = tx.hash || (tx as any).transactionHash;
    logTransaction(user.id, "confidential", JSON.stringify({ action: "withdraw", tokenSymbol, amount }), txHash);
    tx.wait().then(() => updateTransactionStatus(txHash, "confirmed")).catch(() => updateTransactionStatus(txHash, "failed"));
    return c.json({ txHash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "withdraw_error", message: err.message }, 500);
  }
});

export default confidential;
