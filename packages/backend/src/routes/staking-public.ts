import { Hono } from "hono";
import { getSdk } from "../services/starkzap.js";
import { mainnetValidators } from "starkzap";
import { log } from "../utils/logger.js";

const publicStaking = new Hono();

publicStaking.get("/validators", async (c) => {
  const sdk = getSdk();
  const validators = Object.values(mainnetValidators).map((v) => ({
    name: v.name,
    stakerAddress: v.stakerAddress as string,
    logoUrl: v.logoUrl?.toString() || null,
  }));

  const withPools = await Promise.all(
    validators.slice(0, 50).map(async (v) => {
      try {
        const pools = await sdk.getStakerPools(v.stakerAddress as any);
        return {
          ...v,
          pools: pools.map((p) => ({
            address: (p.poolContract || p.address) as string,
            token: { name: p.token.name, symbol: p.token.symbol },
            amount: p.amount.toFormatted(true),
          })),
        };
      } catch {
        return { ...v, pools: [] };
      }
    })
  );

  const active = withPools.filter((v) => v.pools.length > 0);
  const inactive = withPools.filter((v) => v.pools.length === 0);
  const all = [...active, ...inactive];

  log.info("staking", `${active.length} active validators with pools out of ${validators.length} total`);
  return c.json({ validators: all, count: all.length, activeCount: active.length });
});

publicStaking.get("/validators/quick", (c) => {
  const validators = Object.values(mainnetValidators).map((v) => ({
    name: v.name,
    stakerAddress: v.stakerAddress as string,
    logoUrl: v.logoUrl?.toString() || null,
  }));
  return c.json({ validators, count: validators.length });
});

publicStaking.get("/pools/:stakerAddress", async (c) => {
  const stakerAddress = c.req.param("stakerAddress");
  try {
    const sdk = getSdk();
    const provider = sdk.getProvider();
    const config = (sdk as any).getResolvedConfig?.()?.staking || { contract: "0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7" };
    const pools = await sdk.getStakerPools(stakerAddress as any);

    const { Staking } = await import("starkzap");
    const poolsWithData = await Promise.all(
      pools.map(async (p) => {
        const poolAddr = (p.poolContract || p.address) as string;
        let commission = 0;
        try {
          const staking = await Staking.fromPool(poolAddr as any, provider, config, { timeoutMs: 10000 });
          commission = await staking.getCommission();
        } catch {}
        return {
          address: poolAddr,
          token: { name: p.token.name, symbol: p.token.symbol },
          amount: p.amount.toFormatted(true),
          commission,
        };
      })
    );
    return c.json({ pools: poolsWithData });
  } catch (err: any) {
    return c.json({ error: "pools_error", message: err.message }, 500);
  }
});

publicStaking.get("/tokens", async (c) => {
  try {
    const tokens = await getSdk().stakingTokens();
    return c.json({ tokens: tokens.map((t) => ({ name: t.name, symbol: t.symbol, address: t.address, decimals: t.decimals })) });
  } catch (err: any) {
    return c.json({ error: "staking_error", message: err.message }, 500);
  }
});

let apyCache: any = null;

publicStaking.get("/apy", async (c) => {
  const now = Date.now();
  if (apyCache && now - apyCache.timestamp < 300000) {
    return c.json(apyCache);
  }
  try {
    const sdk = getSdk();
    const stakingContract = "0x00ca1702e64c81d9a07b86bd2c540188d92a2c73cf5cc0e508d949015e7e84a7";
    const mintingCurve = "0x00ca1705e74233131dbcdee7f1b8d2926bf262168c7df339004b3f46015b6984";
    const rewardSupplier = "0x009035556d1ee136e7722ae4e78f92828553a45eed3bc9b2aba90788ec2ca112";

    const [totalStakeResult, yearlyMintResult, alphaResult] = await Promise.all([
      sdk.callContract({ contractAddress: stakingContract, entrypoint: "get_total_stake", calldata: [] }),
      sdk.callContract({ contractAddress: mintingCurve, entrypoint: "yearly_mint", calldata: [] }),
      sdk.callContract({ contractAddress: rewardSupplier, entrypoint: "get_alpha", calldata: [] }).catch(() => null),
    ]);

    const totalStaked = Number(BigInt(((totalStakeResult as any).result || totalStakeResult)[0])) / 1e18;
    const yearlyMint = Number(BigInt(((yearlyMintResult as any).result || yearlyMintResult)[0])) / 1e18;

    let alpha = 0;
    if (alphaResult) {
      const raw = ((alphaResult as any).result || alphaResult);
      alpha = parseInt(raw[0], 16) || 0;
    }

    const btcShareFraction = alpha / 10000;
    const strkRewardPool = yearlyMint * (1 - btcShareFraction);
    const btcRewardPool = yearlyMint * btcShareFraction;
    const strkApy = totalStaked > 0 ? (strkRewardPool / totalStaked) * 100 : 0;

    const btcStrkPerYear = btcRewardPool > 0 ? Math.round(btcRewardPool / 678) : 0;

    apyCache = {
      strkApy: Math.round(strkApy * 100) / 100,
      yearlyMint: Math.round(yearlyMint),
      totalStaked: Math.round(totalStaked),
      alpha,
      btcRewardPoolStrk: Math.round(btcRewardPool),
      btcStrkPerYear: btcStrkPerYear,
      timestamp: now,
    };
    log.info("staking", `STRK APY: ${apyCache.strkApy}%, alpha: ${alpha}/10000, BTC pool: ${apyCache.btcRewardPoolStrk} STRK/yr`);
    return c.json(apyCache);
  } catch (err: any) {
    return c.json({ strkApy: 0, error: err.message }, 500);
  }
});

export default publicStaking;
