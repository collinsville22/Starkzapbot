import type { Context } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

export async function healthCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }

  const text = ctx.message?.text || "";
  const parts = text.split(" ").slice(1); // /health USDC ETH

  if (parts.length < 2) {
    await ctx.reply("Usage: /health <debtToken> <collateralToken>\nExample: /health USDC ETH\n\nShows your lending health factor for the given pair.");
    return;
  }

  try {
    const data = await botApi(token, "/api/lending/health", {
      method: "POST",
      body: JSON.stringify({ collateralTokenSymbol: parts[1].toUpperCase(), debtTokenSymbol: parts[0].toUpperCase() }),
    });

    const collVal = Number(BigInt(data.collateralValue || "0")) / 1e18;
    const debtVal = Number(BigInt(data.debtValue || "0")) / 1e18;
    const ratio = debtVal > 0 ? (collVal / debtVal).toFixed(2) : "N/A";
    const status = data.isCollateralized ? "SAFE" : "AT RISK";

    let msg = `*Lending Health*\n\n`;
    msg += `Collateral (${parts[1].toUpperCase()}): $${collVal.toFixed(2)}\n`;
    msg += `Debt (${parts[0].toUpperCase()}): $${debtVal.toFixed(2)}\n`;
    msg += `Ratio: ${ratio}x\n`;
    msg += `Status: *${status}*\n`;
    if (!data.isCollateralized) msg += `\nLiquidation risk! Repay debt or add collateral.`;

    await ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err: any) { await ctx.reply(`Health check error: ${err.message}`); }
}
