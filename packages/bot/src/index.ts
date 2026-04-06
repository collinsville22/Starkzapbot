import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });

import { Bot } from "grammy";
import { startCommand } from "./commands/start.js";
import { portfolioCommand } from "./commands/portfolio.js";
import { swapCommand, handleSwapCallback, handleSwapAmountInput } from "./commands/swap.js";
import { priceCommand } from "./commands/price.js";
import { helpCommand } from "./commands/help.js";
import { addressCommand } from "./commands/address.js";
import { balanceCommand } from "./commands/balance.js";
import { stakeCommand, handleStakeCallback, handleStakeTextInput } from "./commands/stake.js";
import { sendCommand, handleSendCallback, handleSendTextInput } from "./commands/send.js";
import { lendCommand, handleLendCallback, handleLendTextInput } from "./commands/lend.js";
import { dcaCommand, handleDcaCallback, handleDcaTextInput } from "./commands/dca.js";
import { deployCommand } from "./commands/deploy.js";
import { historyCommand } from "./commands/history.js";
import { positionCommand } from "./commands/position.js";
import { privateCommand } from "./commands/private.js";
import { validatorsCommand } from "./commands/validators.js";
import { healthCommand } from "./commands/health.js";
import { getState } from "./utils/state.js";

const token = process.env.BOT_TOKEN;
if (!token) { process.stderr.write("BOT_TOKEN required\n"); process.exit(1); }

const bot = new Bot(token);

bot.command("start", startCommand);
bot.command("help", helpCommand);
bot.command("balance", balanceCommand);
bot.command("bal", balanceCommand);
bot.command("address", addressCommand);
bot.command("wallet", addressCommand);
bot.command("portfolio", portfolioCommand);
bot.command("deploy", deployCommand);
bot.command("price", priceCommand);
bot.command("swap", swapCommand);
bot.command("send", sendCommand);
bot.command("transfer", sendCommand);
bot.command("stake", stakeCommand);
bot.command("staking", stakeCommand);
bot.command("validators", validatorsCommand);
bot.command("lend", lendCommand);
bot.command("lending", lendCommand);
bot.command("dca", dcaCommand);
bot.command("history", historyCommand);
bot.command("txs", historyCommand);
bot.command("position", positionCommand);
bot.command("positions", positionCommand);
bot.command("health", healthCommand);
bot.command("private", privateCommand);
bot.command("confidential", privateCommand);

bot.callbackQuery(/^swap:/, handleSwapCallback);
bot.callbackQuery(/^send:/, handleSendCallback);
bot.callbackQuery(/^sk:/, handleStakeCallback);
bot.callbackQuery(/^ld:/, handleLendCallback);
bot.callbackQuery(/^lend:/, handleLendCallback);
bot.callbackQuery(/^dc:/, handleDcaCallback);
bot.callbackQuery(/^dca:/, handleDcaCallback);
bot.callbackQuery("portfolio:refresh", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "Refreshing..." });
  await portfolioCommand(ctx);
});

bot.on("message:text", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  const text = ctx.message.text;
  if (text.startsWith("/")) return;

  const state = getState(userId);
  if (state) {
    if (state.flow === "swap" && await handleSwapAmountInput(ctx, userId, text)) return;
    if (state.flow === "send" && await handleSendTextInput(ctx, userId, text)) return;
    if (state.flow === "stake" && await handleStakeTextInput(ctx, userId, text)) return;
    if (state.flow === "lend" && await handleLendTextInput(ctx, userId, text)) return;
    if (state.flow === "dca" && await handleDcaTextInput(ctx, userId, text)) return;
  }

  await ctx.reply(
    "Type /help for all commands, or try:\n" +
    "/swap — Interactive swap\n" +
    "/send — Send tokens\n" +
    "/stake — Staking\n" +
    "/lend — Lending\n" +
    "/dca — DCA orders"
  );
});

bot.catch(() => {});

bot.api.setMyCommands([
  { command: "balance", description: "Check balances + USD" },
  { command: "swap", description: "Swap tokens (interactive)" },
  { command: "send", description: "Send tokens (interactive)" },
  { command: "stake", description: "Stake/claim/unstake (interactive)" },
  { command: "lend", description: "Lend/borrow/repay (interactive)" },
  { command: "dca", description: "DCA orders (interactive)" },
  { command: "price", description: "Token price" },
  { command: "private", description: "Confidential transfers" },
  { command: "validators", description: "Browse validators" },
  { command: "position", description: "View positions" },
  { command: "history", description: "Transaction history" },
  { command: "health", description: "Lending health" },
  { command: "address", description: "Wallet address" },
  { command: "deploy", description: "Deploy account" },
  { command: "help", description: "All commands" },
]).catch(() => {});

process.stdout.write("Bot starting...\n");
bot.start({ onStart: () => process.stdout.write("Bot is running!\n") });
