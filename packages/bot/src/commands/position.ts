import type { Context } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

export async function positionCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first to set up your wallet."); return; }

  const text = ctx.message?.text || "";
  const poolAddress = text.split(" ")[1];

  if (poolAddress) {
    try {
      const data = await botApi(token, "/api/staking-manage/position", {
        method: "POST", body: JSON.stringify({ poolAddress }),
      });
      if (!data.isMember) { await ctx.reply("You are not a member of this pool."); return; }
      const p = data.position;
      let msg = `*Staking Position*\n\n`;
      msg += `Staked: ${p.staked}\n`;
      msg += `Rewards: ${p.rewards}\n`;
      msg += `Total: ${p.total}\n`;
      msg += `Commission: ${p.commissionPercent}%\n`;
      if (p.unpoolTime) msg += `Exit available: ${new Date(p.unpoolTime).toLocaleDateString()}\n`;
      msg += `\nClaim: /stake claim ${poolAddress}\nUnstake: /stake unstake ${poolAddress} <amount> <token>`;
      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch { await ctx.reply("Could not load position."); }
    return;
  }

  try {
    const data = await botApi(token, "/api/lending/positions");
    const positions = data.positions || [];

    if (positions.length === 0) {
      await ctx.reply("No active lending positions.\n\nDeposit: /lend deposit 100 USDC\nStake: Use the app to browse validators.");
      return;
    }

    let msg = `*Your Lending Positions*\n\n`;
    for (const p of positions) {
      msg += `*${p.type.toUpperCase()}* — ${p.collateral?.token?.symbol || "?"}`;
      if (p.pool?.name) msg += ` (${p.pool.name})`;
      if (p.debt) msg += ` | Debt: ${p.debt.token?.symbol}`;
      msg += `\n`;
    }
    msg += `\nWithdraw: /lend withdraw <amount> <token>`;
    await ctx.reply(msg, { parse_mode: "Markdown" });
  } catch { await ctx.reply("Could not load positions."); }
}
