import type { Context } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

export async function addressCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Could not authenticate. Open the Mini App first to create your wallet."); return; }

  try {
    const deployRes = await botApi(token, "/api/advanced/deploy-status");
    const addr = deployRes.address;
    const status = deployRes.deployed ? "Deployed" : "Not deployed";
    const explorer = `https://starkscan.co/contract/${addr}`;

    await ctx.reply(
      `*Your Starknet Wallet*\n\n` +
      `Address:\n\`${addr}\`\n\n` +
      `Status: ${status}\n` +
      `Explorer: [View on StarkScan](${explorer})\n\n` +
      `_Send STRK, ETH, or any Starknet token to this address._`,
      { parse_mode: "Markdown", link_preview_options: { is_disabled: true } }
    );
  } catch (err: any) {
    await ctx.reply(`Could not load wallet info: ${err.message}`);
  }
}
