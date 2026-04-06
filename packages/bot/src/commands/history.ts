import type { Context } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";

export async function historyCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first to set up your wallet."); return; }

  const text = ctx.message?.text || "";
  const typeFilter = text.split(" ")[1]?.toLowerCase(); // /history swap

  try {
    const query = typeFilter ? `?type=${typeFilter}` : "";
    const data = await botApi(token, `/api/history${query}`);
    const txs = data.transactions || [];

    if (txs.length === 0) {
      await ctx.reply("No transaction history yet.\n\nStart swapping, staking, or lending!");
      return;
    }

    let msg = `*Transaction History*${typeFilter ? ` (${typeFilter})` : ""}\n\n`;
    for (const tx of txs.slice(0, 10)) {
      const status = tx.status === "confirmed" ? "done" : tx.status === "failed" ? "FAIL" : "pending";
      const time = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "";
      const explorer = tx.txHash ? `[tx](https://starkscan.co/tx/${tx.txHash})` : "";
      msg += `${tx.type.toUpperCase()} — ${status} ${time} ${explorer}\n`;
    }
    msg += `\n_${txs.length} total transactions_\nFilter: /history swap | stake | lend | dca`;

    await ctx.reply(msg, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
  } catch { await ctx.reply("Could not load history."); }
}
