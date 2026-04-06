import type { Context } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

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
    await ctx.reply(`Funding private ${parts[2].toUpperCase()} balance with ${parts[1]}...`);
    try {
      const result = await botApi(token, "/api/confidential/fund", {
        method: "POST", body: JSON.stringify({ tokenSymbol: parts[2].toUpperCase(), amount: parts[1] }),
      });
      if (result.error) { await ctx.reply(`Fund failed: ${result.message}`); return; }
      await ctx.reply(`*Funded!* ${parts[1]} ${parts[2].toUpperCase()} deposited privately\n\n[View](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch (err: any) { await ctx.reply(`Fund error: ${err.message}`); }
    return;
  }

  if (action === "send" && parts.length >= 4) {
    await ctx.reply(`Sending ${parts[2]} ${parts[3].toUpperCase()} privately to ${parts[1].slice(0, 8)}...`);
    try {
      const result = await botApi(token, "/api/confidential/transfer", {
        method: "POST", body: JSON.stringify({ tokenSymbol: parts[3].toUpperCase(), amount: parts[2], recipientAddress: parts[1] }),
      });
      if (result.error) { await ctx.reply(`Private send failed: ${result.message}`); return; }
      await ctx.reply(`*Sent Privately!* ${parts[2]} ${parts[3].toUpperCase()} (ZK proof)\n\n[View](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch (err: any) { await ctx.reply(`Send error: ${err.message}`); }
    return;
  }

  if (action === "withdraw" && parts.length >= 3) {
    await ctx.reply(`Withdrawing ${parts[1]} ${parts[2].toUpperCase()} to public...`);
    try {
      const result = await botApi(token, "/api/confidential/withdraw", {
        method: "POST", body: JSON.stringify({ tokenSymbol: parts[2].toUpperCase(), amount: parts[1] }),
      });
      if (result.error) { await ctx.reply(`Withdraw failed: ${result.message}`); return; }
      await ctx.reply(`*Withdrawn!* ${parts[1]} ${parts[2].toUpperCase()} back to public\n\n[View](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch (err: any) { await ctx.reply(`Withdraw error: ${err.message}`); }
    return;
  }

  await ctx.reply("Usage:\n/private — Info + your Tongo ID\n/private balance STRK\n/private fund 10 STRK\n/private send 0x... 5 STRK\n/private withdraw 5 STRK");
}
