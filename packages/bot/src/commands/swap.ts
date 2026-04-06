import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";
import { setState, getState, updateState, clearState } from "../utils/state.js";

const TOKENS = ["ETH", "STRK", "USDC", "WBTC", "DAI", "USDT", "wstETH"];
const MINI_APP_URL = process.env.MINI_APP_URL || "https://starkzap-azure.vercel.app";

export async function swapCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const parts = (ctx.message?.text || "").split(" ").slice(1);
  if (parts.length >= 3) {
    const kb = new InlineKeyboard().webApp("Swap in App", `${MINI_APP_URL}?startapp=swap`);
    await ctx.reply(`Swap ${parts[2]} ${parts[0].toUpperCase()} -> ${parts[1].toUpperCase()}\n\nOpen the app to complete this swap:`, { reply_markup: kb });
    return;
  }

  setState(userId, "swap", "select_sell");
  const kb = new InlineKeyboard();
  TOKENS.forEach((t, i) => { kb.text(t, `swap:sell:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
  await ctx.reply("*Swap Tokens*\n\n*Step 1/4* — Select token to sell:", { parse_mode: "Markdown", reply_markup: kb });
}

export async function handleSwapCallback(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const data = ctx.callbackQuery?.data || "";
  await ctx.answerCallbackQuery();

  if (data.startsWith("swap:sell:")) {
    const sell = data.split(":")[2];
    updateState(userId, "select_buy", { sellToken: sell });
    const kb = new InlineKeyboard();
    TOKENS.filter(t => t !== sell).forEach((t, i) => { kb.text(t, `swap:buy:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
    await ctx.editMessageText(`*Swap Tokens*\n\nSelling: *${sell}*\n\n*Step 2/4* — Select token to buy:`, { parse_mode: "Markdown", reply_markup: kb });
    return;
  }

  if (data.startsWith("swap:buy:")) {
    const buy = data.split(":")[2];
    updateState(userId, "enter_amount", { buyToken: buy });
    const state = getState(userId)!;
    await ctx.editMessageText(`*Swap Tokens*\n\n${state.data.sellToken} → *${buy}*\n\n*Step 3/4* — Enter amount of ${state.data.sellToken} to sell:`, { parse_mode: "Markdown" });
    return;
  }

  if (data.startsWith("swap:slippage:")) {
    const slip = data.split(":")[2];
    updateState(userId, "confirm", { slippage: slip });
    const state = getState(userId)!;
    const token = await botAuth(userId);
    if (!token) return;
    const quote = await botApi(token, "/api/swap/quote", {
      method: "POST", body: JSON.stringify({ tokenIn: state.data.sellToken, tokenOut: state.data.buyToken, amountIn: state.data.amount, slippageBps: parseInt(slip) }),
    }).catch(() => null);
    if (quote?.amountOut) updateState(userId, "confirm", { amountOut: quote.amountOut, provider: quote.provider, priceImpact: quote.priceImpactBps });
    await showConfirmMessage(ctx, state, quote);
    return;
  }

  if (data === "swap:confirm") {
    const state = getState(userId);
    if (!state) return;
    clearState(userId);
    const kb = new InlineKeyboard().webApp("Swap in App", `${MINI_APP_URL}?startapp=swap`);
    await ctx.editMessageText("Open the app to complete this swap:", { reply_markup: kb });
    return;
  }

  if (data === "swap:cancel") { clearState(userId); await ctx.editMessageText("Swap cancelled."); }
}

export async function handleSwapAmountInput(ctx: Context, userId: number, text: string) {
  const state = getState(userId);
  if (!state || state.flow !== "swap" || state.step !== "enter_amount") return false;
  if (isNaN(parseFloat(text)) || parseFloat(text) <= 0) { await ctx.reply("Enter a valid amount (e.g. 0.5):"); return true; }

  updateState(userId, "confirm", { amount: text.trim(), slippage: "100" });
  await ctx.reply("Fetching quote...");

  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first to set up your wallet."); clearState(userId); return true; }

  const quote = await botApi(token, "/api/swap/quote", {
    method: "POST", body: JSON.stringify({ tokenIn: state.data.sellToken, tokenOut: state.data.buyToken, amountIn: text.trim(), slippageBps: 100 }),
  }).catch(() => null);

  if (!quote || quote.error) {
    await ctx.reply(`Quote failed: ${quote?.message || "Try again"}`);
    clearState(userId);
    return true;
  }

  updateState(userId, "confirm", { amountOut: quote.amountOut, provider: quote.provider || "AVNU", priceImpact: quote.priceImpactBps || "0" });

  const fee = await botApi(token, "/api/advanced/estimate-fee", {
    method: "POST", body: JSON.stringify({ tokenInSymbol: state.data.sellToken, tokenOutSymbol: state.data.buyToken, amount: text.trim(), slippageBps: 100 }),
  }).catch(() => null);

  const feeStr = fee?.overallFee ? `~${(Number(fee.overallFee) / 1e18).toFixed(6)} ETH (sponsored)` : "Gasless";
  updateState(userId, "confirm", { feeStr });

  const updatedState = getState(userId)!;
  await showConfirmMessage(ctx, updatedState, quote, feeStr);
  return true;
}

async function showConfirmMessage(ctx: Context, state: any, quote: any, feeStr?: string) {
  const s = state.data;
  const impact = s.priceImpact ? (parseInt(s.priceImpact) / 100).toFixed(2) : "0.00";
  const slip = s.slippage || "100";

  const slipKb = new InlineKeyboard()
    .text(slip === "50" ? "0.5%" : "0.5%", "swap:slippage:50")
    .text(slip === "100" ? "1%" : "1%", "swap:slippage:100")
    .text(slip === "200" ? "2%" : "2%", "swap:slippage:200")
    .text(slip === "500" ? "5%" : "5%", "swap:slippage:500")
    .row()
    .webApp("Swap in App", `${MINI_APP_URL}?startapp=swap`)
    .text("Cancel", "swap:cancel");

  await ctx.reply(
    `*Step 4/4 — Confirm Swap*\n\n` +
    `You pay: *${s.amount} ${s.sellToken}*\n` +
    `You receive: *~${s.amountOut || "?"} ${s.buyToken}*\n` +
    `Rate: 1 ${s.sellToken} = ${s.amountOut && s.amount ? (parseFloat(s.amountOut) / parseFloat(s.amount)).toFixed(4) : "?"} ${s.buyToken}\n` +
    `Price Impact: ${impact}%\n` +
    `Provider: ${s.provider || "AVNU"}\n` +
    `Slippage: ${(parseInt(slip) / 100).toFixed(1)}% (tap to change)\n` +
    `Network Fee: ${feeStr || s.feeStr || "Gasless"}\n\n` +
    `Open the app to complete this swap:`,
    { parse_mode: "Markdown", reply_markup: slipKb }
  );
}
