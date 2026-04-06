import { Hono } from "hono";
import { Amount } from "starkzap";
import { getWalletForUser, getSdk } from "../services/starkzap.js";
import { resolveToken, toStarkzapToken } from "../services/tokens.js";
import { logTransaction, updateTransactionStatus, type DbUser } from "../services/db.js";
import { log } from "../utils/logger.js";

const staking = new Hono();

const STAKING_CONTRACT = "0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7";

let validatorCache: any[] | null = null;
let validatorCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

staking.get("/validators", async (c) => {
  const now = Date.now();
  if (validatorCache && now - validatorCacheTime < CACHE_TTL) {
    return c.json({ validators: validatorCache, cached: true });
  }

  try {
    const sdk = getSdk();

    const result = await sdk.callContract({
      contractAddress: STAKING_CONTRACT,
      entrypoint: "get_stakers",
      calldata: [],
    });

    const rawResult = result as any;
    const data = rawResult.result || rawResult;

    if (!Array.isArray(data) || data.length === 0) {
      return c.json({ validators: [], count: 0 });
    }

    const numStakers = parseInt(data[0], 16) || parseInt(data[0]);
    const stakerAddresses: string[] = [];
    for (let i = 1; i <= numStakers && i < data.length; i++) {
      stakerAddresses.push(data[i]);
    }

    const validators = await Promise.all(
      stakerAddresses.slice(0, 50).map(async (stakerAddr) => {
        try {
          const pools = await sdk.getStakerPools(stakerAddr as any);
          return {
            stakerAddress: stakerAddr,
            pools: pools.map((p) => ({
              address: (p.poolContract || p.address) as string,
              token: { name: p.token.name, symbol: p.token.symbol },
              amount: p.amount.toFormatted(),
            })),
          };
        } catch {
          return {
            stakerAddress: stakerAddr,
            pools: [],
          };
        }
      })
    );

    const activeValidators = validators.filter((v) => v.pools.length > 0);

    validatorCache = activeValidators;
    validatorCacheTime = now;

    log.info("staking", `Found ${activeValidators.length} active validators on-chain`);
    return c.json({ validators: activeValidators, count: activeValidators.length });
  } catch (err: any) {
    log.error("staking", `get_stakers failed: ${err.message}`);
    return c.json({ validators: [], count: 0, error: err.message });
  }
});

staking.get("/tokens", async (c) => {
  try {
    const tokens = await getSdk().stakingTokens();
    return c.json({ tokens: tokens.map((t) => ({ name: t.name, symbol: t.symbol, address: t.address, decimals: t.decimals })) });
  } catch (err: any) {
    return c.json({ error: "staking_error", message: err.message }, 500);
  }
});

staking.get("/pools/:stakerAddress", async (c) => {
  const stakerAddress = c.req.param("stakerAddress");
  try {
    const pools = await getSdk().getStakerPools(stakerAddress as any);
    return c.json({
      pools: pools.map((p) => ({
        address: (p.poolContract || p.address) as string,
        token: { name: p.token.name, symbol: p.token.symbol },
        amount: p.amount.toFormatted(),
      })),
    });
  } catch (err: any) {
    return c.json({ error: "pools_error", message: err.message }, 500);
  }
});

staking.get("/position/:poolAddress", async (c) => {
  const user = c.get("user") as DbUser;
  const poolAddress = c.req.param("poolAddress");
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const position = await wallet.getPoolPosition(poolAddress as any);
    if (!position) return c.json({ position: null });
    const commission = await wallet.getPoolCommission(poolAddress as any);
    return c.json({
      position: {
        staked: position.staked.toFormatted(),
        rewards: position.rewards.toFormatted(),
        commission,
        unpoolTime: position.unpoolTime?.toISOString() ?? null,
      },
    });
  } catch (err: any) {
    return c.json({ error: "staking_error", message: err.message }, 500);
  }
});

staking.post("/stake", async (c) => {
  const user = c.get("user") as DbUser;
  const { poolAddress, amount, tokenSymbol } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.stake(poolAddress as any, Amount.parse(amount, token.decimals, token.symbol));
    logTransaction(user.id, "stake", JSON.stringify({ poolAddress, amount, tokenSymbol }), (tx.hash || tx.transactionHash));
    tx.wait().then(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "confirmed")).catch(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "failed"));
    return c.json({ txHash: (tx.hash || tx.transactionHash), explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "stake_error", message: err.message }, 500);
  }
});

staking.post("/claim", async (c) => {
  const user = c.get("user") as DbUser;
  const { poolAddress } = await c.req.json();
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.claimPoolRewards(poolAddress as any);
    logTransaction(user.id, "stake", JSON.stringify({ action: "claim", poolAddress }), (tx.hash || tx.transactionHash));
    tx.wait().then(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "confirmed")).catch(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "failed"));
    return c.json({ txHash: (tx.hash || tx.transactionHash), explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "claim_error", message: err.message }, 500);
  }
});

staking.post("/exit-intent", async (c) => {
  const user = c.get("user") as DbUser;
  const { poolAddress, amount, tokenSymbol } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.exitPoolIntent(poolAddress as any, Amount.parse(amount, token.decimals, token.symbol));
    logTransaction(user.id, "stake", JSON.stringify({ action: "exit_intent", poolAddress, amount }), (tx.hash || tx.transactionHash));
    tx.wait().then(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "confirmed")).catch(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "failed"));
    return c.json({ txHash: (tx.hash || tx.transactionHash), explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "exit_error", message: err.message }, 500);
  }
});

// --- Staking management endpoints (previously in staking-manage.ts) ---

const stakingManage = new Hono();

stakingManage.post("/position", async (c) => {
  const user = c.get("user") as DbUser;
  const { poolAddress } = await c.req.json();
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const isMember = await wallet.isPoolMember(poolAddress as any);
    if (!isMember) return c.json({ position: null, isMember: false });

    const position = await wallet.getPoolPosition(poolAddress as any);
    if (!position) return c.json({ position: null, isMember: true });

    return c.json({
      isMember: true,
      position: {
        staked: position.staked.toFormatted(true),
        stakedRaw: position.staked.toUnit(),
        rewards: position.rewards.toFormatted(true),
        rewardsRaw: position.rewards.toUnit(),
        total: position.total.toFormatted(true),
        unpooling: position.unpooling.toFormatted(true),
        unpoolTime: position.unpoolTime?.toISOString() || null,
        commissionPercent: position.commissionPercent,
        rewardAddress: position.rewardAddress,
      },
    });
  } catch (err: any) {
    return c.json({ error: "position_error", message: err.message }, 500);
  }
});

stakingManage.post("/claim-rewards", async (c) => {
  const user = c.get("user") as DbUser;
  const { poolAddress } = await c.req.json();
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.claimPoolRewards(poolAddress as any);
    logTransaction(user.id, "stake", JSON.stringify({ action: "claim_rewards", poolAddress }), tx.hash);
    tx.wait().then(() => updateTransactionStatus(tx.hash, "confirmed")).catch(() => updateTransactionStatus(tx.hash, "failed"));
    return c.json({ txHash: tx.hash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "claim_error", message: err.message }, 500);
  }
});

stakingManage.post("/exit-intent", async (c) => {
  const user = c.get("user") as DbUser;
  const { poolAddress, amount, tokenSymbol } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const exitAmount = Amount.parse(amount, token.decimals, token.symbol);
    const tx = await wallet.exitPoolIntent(poolAddress as any, exitAmount);
    logTransaction(user.id, "stake", JSON.stringify({ action: "exit_intent", poolAddress, amount }), tx.hash);
    tx.wait().then(() => updateTransactionStatus(tx.hash, "confirmed")).catch(() => updateTransactionStatus(tx.hash, "failed"));
    return c.json({ txHash: tx.hash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "exit_intent_error", message: err.message }, 500);
  }
});

stakingManage.post("/exit", async (c) => {
  const user = c.get("user") as DbUser;
  const { poolAddress } = await c.req.json();
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.exitPool(poolAddress as any);
    logTransaction(user.id, "stake", JSON.stringify({ action: "exit_pool", poolAddress }), tx.hash);
    tx.wait().then(() => updateTransactionStatus(tx.hash, "confirmed")).catch(() => updateTransactionStatus(tx.hash, "failed"));
    return c.json({ txHash: tx.hash, explorerUrl: tx.explorerUrl, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "exit_error", message: err.message }, 500);
  }
});

export { stakingManage };
export default staking;
