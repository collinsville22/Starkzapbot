import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

const MINI_APP_URL = process.env.MINI_APP_URL || "https://starkzap-azure.vercel.app";

export async function deployCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first to set up your wallet."); return; }

  const status = await botApi(token, "/api/advanced/deploy-status");
  if (status.deployed) {
    await ctx.reply(`Account already deployed.\nAddress: \`${status.address}\``, { parse_mode: "Markdown" });
    return;
  }

  const kb = new InlineKeyboard().webApp("Deploy in App", `${MINI_APP_URL}?startapp=deploy`);
  await ctx.reply("Your account is not yet deployed.\n\nOpen the app to deploy your Starknet account:", { reply_markup: kb });
}
