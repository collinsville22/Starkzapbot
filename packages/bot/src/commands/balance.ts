import type { Context } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

export async function balanceCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const tokenFilter = (ctx.message?.text || "").split(" ")[1]?.toUpperCase();

  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Could not authenticate. Open the Mini App first to create your wallet."); return; }

  try {
    const data = await botApi(token, "/api/portfolio");
    const balances = data.balances?.filter((b: any) => parseFloat(b.balance) > 0) || [];

    if (tokenFilter) {
      const found = data.balances?.find((b: any) => b.token.symbol === tokenFilter);
      if (!found || parseFloat(found.balance) === 0) { await ctx.reply(`No ${tokenFilter} in your wallet.`); return; }
      const usd = found.usdValue ? ` ($${found.usdValue.toFixed(2)})` : "";
      await ctx.reply(`*${tokenFilter}*: ${parseFloat(found.balance).toFixed(6)}${usd}`, { parse_mode: "Markdown" });
      return;
    }

    if (balances.length === 0) { await ctx.reply("Your wallet is empty. Send tokens to your address (/address)."); return; }

    let msg = `*Balances* — $${(data.totalUsd || 0).toFixed(2)} total\n\n`;
    for (const b of balances) {
      const usd = b.usdValue ? ` · $${b.usdValue.toFixed(2)}` : "";
      msg += `${b.token.symbol}: ${parseFloat(b.balance).toFixed(4)}${usd}\n`;
    }
    await ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err: any) {
    await ctx.reply(`Could not load balances: ${err.message}`);
  }
}
