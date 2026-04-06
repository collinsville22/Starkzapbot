import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botPublicApi } from "../utils/backend.js";

const MINI_APP_URL = () => process.env.MINI_APP_URL || "https://starkzap-tg.vercel.app";

export async function validatorsCommand(ctx: Context) {
  const text = ctx.message?.text || "";
  const search = text.split(" ").slice(1).join(" ").toLowerCase();

  try {
    const data = await botPublicApi("/api/staking/validators/quick");
    let validators = data.validators || [];

    if (search) {
      validators = validators.filter((v: any) => v.name.toLowerCase().includes(search));
    }

    if (validators.length === 0) {
      await ctx.reply(search ? `No validators matching "${search}".` : "No validators found.");
      return;
    }

    const shown = validators.slice(0, 15);
    let msg = `*Starknet Validators* (${validators.length} total)\n\n`;
    for (const v of shown) {
      msg += `*${v.name}*\n\`${v.stakerAddress}\`\n\n`;
    }
    if (validators.length > 15) msg += `_...and ${validators.length - 15} more_\n`;
    msg += `\nSearch: /validators <name>\nStake: /stake <poolAddress> <amount> STRK`;

    await ctx.reply(msg, {
      parse_mode: "Markdown",
      reply_markup: new InlineKeyboard().webApp("Browse All", `${MINI_APP_URL()}?startapp=stake`),
    });
  } catch { await ctx.reply("Could not load validators."); }
}
