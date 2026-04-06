import type { Context } from "grammy";
import { portfolioKeyboard } from "../keyboards.js";
import { botAuth, botApi } from "../utils/backend.js";

export async function portfolioCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Could not authenticate. Open the Mini App first to create your wallet.", { reply_markup: portfolioKeyboard() }); return; }

  try {
    const data = await botApi(token, "/api/portfolio");
    const nonZero = data.balances?.filter((b: any) => parseFloat(b.balance) > 0) || [];

    if (nonZero.length === 0) {
      await ctx.reply(
        `Your wallet: \`${data.walletAddress}\`\n\nNo assets yet. Send tokens to your address or bridge from Ethereum.`,
        { parse_mode: "Markdown", reply_markup: portfolioKeyboard() }
      );
      return;
    }

    let msg = `*Your Portfolio* — $${(data.totalUsd || 0).toFixed(2)}\n\n`;
    for (const b of nonZero.slice(0, 10)) {
      const usd = b.usdValue ? ` ($${b.usdValue.toFixed(2)})` : "";
      msg += `${b.token.symbol}: ${parseFloat(b.balance).toFixed(4)}${usd}\n`;
    }
    msg += `\nWallet: \`${data.walletAddress}\``;

    await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: portfolioKeyboard() });
  } catch (err: any) {
    await ctx.reply(`Could not load portfolio: ${err.message}`, { reply_markup: portfolioKeyboard() });
  }
}
