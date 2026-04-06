import { Hono } from "hono";
import { Amount } from "starkzap";
import { getWalletForUser } from "../services/starkzap.js";
import { resolveToken, toStarkzapToken, getAllTokens } from "../services/tokens.js";
import { logTransaction, updateTransactionStatus, type DbUser } from "../services/db.js";

const lending = new Hono();

lending.get("/markets", async (c) => {
  const user = c.get("user") as DbUser;
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const markets = await wallet.lending().getMarkets();
    const tokenPresets = getAllTokens();

    return c.json({
      markets: markets.map((m) => {
        const preset = tokenPresets[m.asset.symbol];
        return {
          protocol: m.protocol,
          poolAddress: m.poolAddress,
          poolName: m.poolName,
          asset: {
            name: m.asset.name,
            symbol: m.asset.symbol,
            decimals: m.asset.decimals,
            logoUrl: preset?.logoUrl || null,
          },
          vTokenSymbol: m.vTokenSymbol || null,
          canBeBorrowed: m.canBeBorrowed ?? true,
          supplyApy: m.stats?.supplyApy?.toUnit() ?? null,
          borrowApr: m.stats?.borrowApr?.toUnit() ?? null,
          totalSupplied: m.stats?.totalSupplied?.toFormatted(true) ?? null,
          totalBorrowed: m.stats?.totalBorrowed?.toFormatted(true) ?? null,
          utilization: m.stats?.utilization?.toUnit() ?? null,
        };
      }),
    });
  } catch (err: any) {
    return c.json({ error: "lending_error", message: err.message }, 500);
  }
});

lending.get("/positions", async (c) => {
  const user = c.get("user") as DbUser;
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const positions = await wallet.lending().getPositions();
    const tokenPresets = getAllTokens();

    return c.json({
      positions: positions.map((p) => ({
        type: p.type,
        pool: p.pool,
        collateral: {
          token: {
            name: p.collateral.token.name,
            symbol: p.collateral.token.symbol,
            logoUrl: tokenPresets[p.collateral.token.symbol]?.logoUrl || null,
          },
          amount: p.collateral.amount.toString(),
          usdValue: p.collateralShares ? p.collateralShares.amount.toString() : null,
        },
        debt: p.debt ? {
          token: {
            name: p.debt.token.name,
            symbol: p.debt.token.symbol,
            logoUrl: tokenPresets[p.debt.token.symbol]?.logoUrl || null,
          },
          amount: p.debt.amount.toString(),
        } : null,
      })),
    });
  } catch (err: any) {
    return c.json({ error: "positions_error", message: err.message }, 500);
  }
});

lending.post("/health", async (c) => {
  const user = c.get("user") as DbUser;
  const { collateralTokenSymbol, debtTokenSymbol, poolAddress } = await c.req.json();
  const collateralToken = resolveToken(collateralTokenSymbol);
  const debtToken = resolveToken(debtTokenSymbol);
  if (!collateralToken || !debtToken) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const health = await wallet.lending().getHealth({
      collateralToken: toStarkzapToken(collateralToken),
      debtToken: toStarkzapToken(debtToken),
      poolAddress: poolAddress as any,
    });
    return c.json({
      isCollateralized: health.isCollateralized,
      collateralValue: health.collateralValue.toString(),
      debtValue: health.debtValue.toString(),
    });
  } catch (err: any) {
    return c.json({ error: "health_error", message: err.message }, 500);
  }
});

lending.post("/deposit", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, amount, poolAddress } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.lending().deposit({ token: toStarkzapToken(token), amount: Amount.parse(amount, token.decimals, token.symbol), poolAddress: poolAddress as any });
    logTransaction(user.id, "lend", JSON.stringify({ action: "deposit", tokenSymbol, amount }), (tx.hash || tx.transactionHash));
    tx.wait().then(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "confirmed")).catch(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "failed"));
    return c.json({ txHash: (tx.hash || tx.transactionHash), explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "deposit_error", message: err.message }, 500);
  }
});

lending.post("/withdraw", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, amount, poolAddress } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.lending().withdraw({ token: toStarkzapToken(token), amount: Amount.parse(amount, token.decimals, token.symbol), poolAddress: poolAddress as any });
    logTransaction(user.id, "lend", JSON.stringify({ action: "withdraw", tokenSymbol, amount }), (tx.hash || tx.transactionHash));
    tx.wait().then(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "confirmed")).catch(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "failed"));
    return c.json({ txHash: (tx.hash || tx.transactionHash), explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "withdraw_error", message: err.message }, 500);
  }
});

lending.post("/borrow", async (c) => {
  const user = c.get("user") as DbUser;
  const { collateralTokenSymbol, debtTokenSymbol, amount, collateralAmount, poolAddress } = await c.req.json();
  const collateralToken = resolveToken(collateralTokenSymbol);
  const debtToken = resolveToken(debtTokenSymbol);
  if (!collateralToken || !debtToken) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const borrowRequest: any = {
      collateralToken: toStarkzapToken(collateralToken),
      debtToken: toStarkzapToken(debtToken),
      amount: Amount.parse(amount, debtToken.decimals, debtToken.symbol),
      poolAddress: poolAddress as any,
    };
    // If collateralAmount provided, include it so Vesu deposits collateral + borrows atomically
    if (collateralAmount) {
      borrowRequest.collateralAmount = Amount.parse(collateralAmount, collateralToken.decimals, collateralToken.symbol);
    }
    const tx = await wallet.lending().borrow(borrowRequest);
    logTransaction(user.id, "lend", JSON.stringify({ action: "borrow", collateralTokenSymbol, debtTokenSymbol, amount }), (tx.hash || tx.transactionHash));
    tx.wait().then(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "confirmed")).catch(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "failed"));
    return c.json({ txHash: (tx.hash || tx.transactionHash), explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "borrow_error", message: err.message }, 500);
  }
});

lending.post("/repay", async (c) => {
  const user = c.get("user") as DbUser;
  const { collateralTokenSymbol, debtTokenSymbol, amount, poolAddress } = await c.req.json();
  const collateralToken = resolveToken(collateralTokenSymbol);
  const debtToken = resolveToken(debtTokenSymbol);
  if (!collateralToken || !debtToken) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.lending().repay({ collateralToken: toStarkzapToken(collateralToken), debtToken: toStarkzapToken(debtToken), amount: Amount.parse(amount, debtToken.decimals, debtToken.symbol), poolAddress: poolAddress as any });
    logTransaction(user.id, "lend", JSON.stringify({ action: "repay", collateralTokenSymbol, debtTokenSymbol, amount }), (tx.hash || tx.transactionHash));
    tx.wait().then(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "confirmed")).catch(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "failed"));
    return c.json({ txHash: (tx.hash || tx.transactionHash), explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "repay_error", message: err.message }, 500);
  }
});

lending.post("/estimate-max-borrow", async (c) => {
  const user = c.get("user") as DbUser;
  const { collateralTokenSymbol, debtTokenSymbol, collateralAmount, poolAddress } = await c.req.json();
  const collateralToken = resolveToken(collateralTokenSymbol);
  const debtToken = resolveToken(debtTokenSymbol);
  if (!collateralToken || !debtToken) return c.json({ error: "invalid_token" }, 400);
  if (!collateralAmount || parseFloat(collateralAmount) <= 0) return c.json({ maxBorrow: "0" });

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const provider = wallet.getProvider();

    let pool = poolAddress;
    if (!pool) {
      const markets = await wallet.lending().getMarkets();
      const collMarkets = markets.filter((m) => m.asset.symbol === collateralTokenSymbol);
      const debtMarkets = markets.filter((m) => m.asset.symbol === debtTokenSymbol);
      for (const cm of collMarkets) {
        if (debtMarkets.some((dm) => dm.poolAddress === cm.poolAddress)) {
          pool = cm.poolAddress as string;
          break;
        }
      }
      if (!pool) return c.json({ maxBorrow: "0", error: "No pool found with both tokens" });
    }

    const [collPriceRes, debtPriceRes, pairConfigRes] = await Promise.all([
      provider.callContract({ contractAddress: pool, entrypoint: "price", calldata: [collateralToken.address] }),
      provider.callContract({ contractAddress: pool, entrypoint: "price", calldata: [debtToken.address] }),
      provider.callContract({ contractAddress: pool, entrypoint: "pair_config", calldata: [collateralToken.address, debtToken.address] }),
    ]);

    const collPrice = BigInt(collPriceRes[0] || "0");
    const debtPrice = BigInt(debtPriceRes[0] || "0");
    const maxLtv = BigInt(pairConfigRes[0] || "0");
    const SCALE = BigInt("1000000000000000000"); // 1e18


    if (collPrice === 0n || debtPrice === 0n || maxLtv === 0n) {
      return c.json({ maxBorrow: "0", note: "Could not read on-chain prices" });
    }

    const collAmountRaw = BigInt(Math.floor(parseFloat(collateralAmount) * Math.pow(10, collateralToken.decimals)));
    const collValue = (collAmountRaw * collPrice) / BigInt(Math.pow(10, collateralToken.decimals));

    const maxBorrowValue = (collValue * maxLtv) / SCALE;

    const debtScale = BigInt(Math.pow(10, debtToken.decimals));
    const maxBorrowAmount = (maxBorrowValue * debtScale) / debtPrice;

    // Apply 95% safety margin
    const safeMax = (maxBorrowAmount * 95n) / 100n;
    const formatted = (Number(safeMax) / Math.pow(10, debtToken.decimals)).toFixed(debtToken.decimals > 6 ? 6 : debtToken.decimals);

    return c.json({ maxBorrow: formatted, collPrice: collPrice.toString(), debtPrice: debtPrice.toString(), maxLtv: maxLtv.toString() });
  } catch (err: any) {
    return c.json({ maxBorrow: "0", error: err.message });
  }
});

lending.post("/withdraw-max", async (c) => {
  const user = c.get("user") as DbUser;
  const { tokenSymbol, poolAddress } = await c.req.json();
  const token = resolveToken(tokenSymbol);
  if (!token) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const tx = await wallet.lending().withdrawMax({ token: toStarkzapToken(token), poolAddress: poolAddress as any });
    logTransaction(user.id, "lend", JSON.stringify({ action: "withdraw_max", tokenSymbol }), (tx.hash || tx.transactionHash));
    tx.wait().then(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "confirmed")).catch(() => updateTransactionStatus((tx.hash || tx.transactionHash)!, "failed"));
    return c.json({ txHash: (tx.hash || tx.transactionHash), explorerUrl: tx.explorerUrl || null, status: "pending" });
  } catch (err: any) {
    return c.json({ error: "withdraw_max_error", message: err.message }, 500);
  }
});

lending.post("/max-borrow", async (c) => {
  const user = c.get("user") as DbUser;
  const { collateralTokenSymbol, debtTokenSymbol, poolAddress } = await c.req.json();
  const collateralToken = resolveToken(collateralTokenSymbol);
  const debtToken = resolveToken(debtTokenSymbol);
  if (!collateralToken || !debtToken) return c.json({ error: "invalid_token", message: "Unknown token" }, 400);

  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const maxBorrow = await wallet.lending().getMaxBorrowAmount({
      collateralToken: toStarkzapToken(collateralToken),
      debtToken: toStarkzapToken(debtToken),
      poolAddress: poolAddress as any,
    });
    const formatted = Amount.fromRaw(maxBorrow, debtToken.decimals, debtToken.symbol);
    return c.json({ maxBorrow: formatted.toUnit(), maxBorrowRaw: maxBorrow.toString() });
  } catch (err: any) {
    return c.json({ error: "max_borrow_error", message: err.message, maxBorrow: "0" }, 500);
  }
});

// --- Advanced lending endpoint (mounted at /api/advanced/lending-health-quote via advancedLendingRoutes) ---

const advancedLendingRoutes = new Hono();

advancedLendingRoutes.post("/lending-health-quote", async (c) => {
  const user = c.get("user") as DbUser;
  const { action, collateralTokenSymbol, debtTokenSymbol, amount, poolAddress } = await c.req.json();
  const collateralToken = resolveToken(collateralTokenSymbol);
  const debtToken = resolveToken(debtTokenSymbol);
  if (!collateralToken || !debtToken) return c.json({ error: "invalid_token" }, 400);
  try {
    const wallet = await getWalletForUser(user.telegram_id, user.encrypted_private_key);
    const szC = toStarkzapToken(collateralToken);
    const szD = toStarkzapToken(debtToken);
    const health = { collateralToken: szC, debtToken: szD, poolAddress: poolAddress as any };
    const actionInput: any = {
      action,
      request: {
        collateralToken: szC, debtToken: szD,
        amount: Amount.parse(amount, debtToken.decimals, debtToken.symbol),
        poolAddress: poolAddress as any,
      },
    };
    const projected = await wallet.lending().quoteHealth({ action: actionInput, health });
    return c.json(projected ? {
      isCollateralized: projected.isCollateralized,
      collateralValue: projected.collateralValue.toString(),
      debtValue: projected.debtValue.toString(),
    } : { projected: null });
  } catch (err: any) {
    return c.json({ error: "health_quote_error", message: err.message }, 500);
  }
});

export { advancedLendingRoutes };
export default lending;
