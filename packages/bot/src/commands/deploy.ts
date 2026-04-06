import type { Context } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

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

  await ctx.reply("Deploying your account on Starknet... (uses small STRK fee)");
  try {
    const result = await botApi(token, "/api/advanced/deploy", { method: "POST" });
    if (result.deployed) {
      await ctx.reply(`*Account Deployed!*\n\n${result.message}`, { parse_mode: "Markdown" });
    } else {
      await ctx.reply(`Deploy failed: ${result.message}`);
    }
  } catch (err: any) { await ctx.reply(`Deploy error: ${err.message}`); }
}
