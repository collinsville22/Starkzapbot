import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

const MINI_APP_URL = process.env.MINI_APP_URL || "https://starkzap-azure.vercel.app";

export async function privateCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first to set up your wallet."); return; }

  const text = ctx.message?.text || "";
  const parts = text.split(" ").slice(1);
  if (parts.length === 0) {
    try {
      const [info, myId] = await Promise.all([
        botApi(token, "/api/confidential/info"),
        botApi(token, "/api/confidential/my-id"),
      ]);
      let msg = `*Tongo Private Transfers*\n\n`;
      msg += `Status: ${info.status === "live" ? "LIVE" : info.status}\n`;
      msg += `Supported: ${info.supportedTokens?.join(", ") || "STRK, ETH, WBTC, USDC, USDT, DAI"}\n\n`;
      msg += `Your Tongo Address:\n\`${myId.tongoAddress}\`\n\n`;
      msg += `Commands:\n`;
      msg += `/private balance STRK\n`;
      msg += `/private fund 10 STRK\n`;
      msg += `/private send 0x... 5 STRK\n`;
      msg += `/private withdraw 5 STRK`;
      await ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err: any) { await ctx.reply(`Error: ${err.message}`); }
    return;
  }

  const action = parts[0].toLowerCase();

  if (action === "balance" && parts[1]) {
    try {
      const data = await botApi(token, "/api/confidential/balance", {
        method: "POST", body: JSON.stringify({ tokenSymbol: parts[1].toUpperCase() }),
      });
      await ctx.reply(`*Private ${parts[1].toUpperCase()} Balance*\n\nBalance: ${data.balance}\nPending: ${data.pending}`, { parse_mode: "Markdown" });
    } catch (err: any) { await ctx.reply(`Error: ${err.message}`); }
    return;
  }

  if (action === "fund" && parts.length >= 3) {
    const kb = new InlineKeyboard().webApp("Fund in App", `${MINI_APP_URL}?startapp=send`);
    await ctx.reply(`Fund ${parts[1]} ${parts[2].toUpperCase()} to private balance\n\nOpen the app to complete this transaction:`, { reply_markup: kb });
    return;
  }

  if (action === "send" && parts.length >= 4) {
    const kb = new InlineKeyboard().webApp("Send Privately in App", `${MINI_APP_URL}?startapp=send`);
    await ctx.reply(`Private send ${parts[2]} ${parts[3].toUpperCase()} to ${parts[1].slice(0, 8)}...\n\nOpen the app to complete this transaction:`, { reply_markup: kb });
    return;
  }

  if (action === "withdraw" && parts.length >= 3) {
    const kb = new InlineKeyboard().webApp("Withdraw in App", `${MINI_APP_URL}?startapp=send`);
    await ctx.reply(`Withdraw ${parts[1]} ${parts[2].toUpperCase()} to public\n\nOpen the app to complete this transaction:`, { reply_markup: kb });
    return;
  }

  await ctx.reply("Usage:\n/private — Info + your Tongo ID\n/private balance STRK\n/private fund 10 STRK\n/private send 0x... 5 STRK\n/private withdraw 5 STRK");
}
