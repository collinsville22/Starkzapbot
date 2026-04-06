import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";
import { setState, getState, updateState, clearState, setCache, getCache } from "../utils/state.js";

const TOKENS = ["STRK", "ETH", "USDC", "WBTC", "DAI"];

export async function dcaCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const parts = (ctx.message?.text || "").split(" ").slice(1);
  if (parts[0] === "create" && parts.length >= 6) return createDirect(ctx, userId, parts[1], parts[2], parts[3], parts[4], parts[5]);
  if (parts[0] === "cancel" && parts[1]) return cancelOrder(ctx, userId, parts[1]);

  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }

  setState(userId, "dca", "main");

  const ordersRes = await botApi(token, "/api/dca/orders").catch(() => ({ orders: [] }));
  const orders = ordersRes.orders || [];

  let msg = "*Dollar-Cost Averaging*\n\nAutomate recurring token purchases.\n\n";

  if (orders.length > 0) {
    msg += "*Active Orders:*\n";
    setCache(userId, "orders", orders);
    for (let i = 0; i < Math.min(orders.length, 5); i++) {
      const o = orders[i];
      const freq: Record<string, string> = { PT1H: "Hourly", PT12H: "12h", P1D: "Daily", P1W: "Weekly" };
      msg += `${i + 1}. *${o.status}* — ${freq[o.frequency] || o.frequency}\n`;
      msg += `   ${o.executedTradesCount || 0} trades done, ${o.pendingTradesCount || 0} pending\n`;
    }
    msg += "\n";
  }

  msg += "What would you like to do?";

  const kb = new InlineKeyboard()
    .text("Create DCA Order", "dc:create")
    .row();
  if (orders.length > 0) {
    kb.text("Cancel Order", "dc:cancelsel").text("Order Details", "dc:details").row();
  }
  kb.text("Refresh Orders", "dc:refresh");

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
}

export async function handleDcaCallback(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const data = ctx.callbackQuery?.data || "";
  await ctx.answerCallbackQuery();

  if (data === "dc:create") {
    setState(userId, "dca", "sell_token");
    const kb = new InlineKeyboard();
    TOKENS.forEach((t, i) => { kb.text(t, `dc:st:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
    await ctx.editMessageText("*Create DCA Order*\n\n*Step 1/5* — Token to sell (spend):", { parse_mode: "Markdown", reply_markup: kb });
    return;
  }

  if (data.startsWith("dc:st:")) {
    const sell = data.split(":")[2];
    updateState(userId, "buy_token", { sellToken: sell });
    const kb = new InlineKeyboard();
    TOKENS.filter(t => t !== sell).forEach((t, i) => { kb.text(t, `dc:bt:${t}`); if ((i + 1) % 2 === 0) kb.row(); });
    await ctx.editMessageText(`*Create DCA*\n\nSelling: *${sell}*\n\n*Step 2/5* — Token to buy:`, { parse_mode: "Markdown", reply_markup: kb });
    return;
  }

  if (data.startsWith("dc:bt:")) {
    const buy = data.split(":")[2];
    updateState(userId, "enter_total", { buyToken: buy });
    const state = getState(userId)!;
    await ctx.editMessageText(
      `*Create DCA*\n\n${state.data.sellToken} → *${buy}*\n\n*Step 3/5* — Enter total budget (e.g. 100):`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data.startsWith("dc:fr:")) {
    const freq = data.split(":")[2];
    updateState(userId, "confirm", { frequency: freq });
    const state = getState(userId)!;
    const s = state.data;

    const freqLabels: Record<string, string> = { PT1H: "Every hour", PT12H: "Every 12 hours", P1D: "Every day", P1W: "Every week" };

    const authToken = await botAuth(userId);
    let previewMsg = "";
    if (authToken) {
      const preview = await botApi(authToken, "/api/dca/preview", {
        method: "POST", body: JSON.stringify({ sellTokenSymbol: s.sellToken, buyTokenSymbol: s.buyToken, amountPerCycle: s.perCycle }),
      }).catch(() => null);
      if (preview?.amountOut) {
        const buyDec = ["WBTC"].includes(s.buyToken) ? 8 : 18;
        const amtOut = (Number(BigInt(preview.amountOut)) / Math.pow(10, buyDec)).toFixed(6);
        previewMsg = `\nEst. per cycle: ~${amtOut} ${s.buyToken}\n`;
      }
    }

    const cycles = parseFloat(s.totalAmount) / parseFloat(s.perCycle);

    const kb = new InlineKeyboard()
      .text("Create DCA Order", "dc:confirm")
      .text("Cancel", "dc:cancel");

    await ctx.editMessageText(
      `*Step 5/5 — Confirm DCA*\n\n` +
      `Sell: *${s.totalAmount} ${s.sellToken}*\n` +
      `Buy: *${s.buyToken}*\n` +
      `Per cycle: *${s.perCycle} ${s.sellToken}*\n` +
      `Frequency: *${freqLabels[freq] || freq}*\n` +
      `Total cycles: ~${cycles.toFixed(0)}\n` +
      previewMsg +
      `Fee: Gasless`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return;
  }

  if (data === "dc:confirm") {
    const state = getState(userId);
    if (!state) return;
    clearState(userId);
    await createDirect(ctx, userId, state.data.sellToken, state.data.buyToken, state.data.totalAmount, state.data.perCycle, state.data.frequency);
    return;
  }

  if (data === "dc:cancelsel") {
    const orders = getCache(userId, "orders") || [];
    if (orders.length === 0) { await ctx.editMessageText("No orders to cancel."); return; }
    const kb = new InlineKeyboard();
    orders.slice(0, 5).forEach((o: any, i: number) => {
      const freq: Record<string, string> = { PT1H: "Hourly", PT12H: "12h", P1D: "Daily", P1W: "Weekly" };
      kb.text(`${i + 1}. ${o.status} ${freq[o.frequency] || o.frequency}`, `dc:cx:${i}`).row();
    });
    await ctx.editMessageText("*Cancel DCA Order*\n\nSelect order to cancel:", { parse_mode: "Markdown", reply_markup: kb });
    return;
  }

  if (data.startsWith("dc:cx:")) {
    const idx = parseInt(data.split(":")[2]);
    const orders = getCache(userId, "orders") || [];
    const order = orders[idx];
    if (!order) { await ctx.editMessageText("Order not found."); return; }
    clearState(userId);
    await cancelOrder(ctx, userId, order.id || order.orderAddress);
    return;
  }

  if (data === "dc:details") {
    const orders = getCache(userId, "orders") || [];
    if (orders.length === 0) { await ctx.editMessageText("No orders."); return; }
    let msg = "*DCA Order Details*\n\n";
    for (let i = 0; i < Math.min(orders.length, 3); i++) {
      const o = orders[i];
      const freq: Record<string, string> = { PT1H: "Hourly", PT12H: "12h", P1D: "Daily", P1W: "Weekly" };
      msg += `*Order ${i + 1}*\n`;
      msg += `Status: ${o.status}\n`;
      msg += `Frequency: ${freq[o.frequency] || o.frequency}\n`;
      msg += `Trades: ${o.executedTradesCount} done / ${o.pendingTradesCount} pending\n`;
      if (o.startDate) msg += `Started: ${new Date(o.startDate).toLocaleDateString()}\n`;
      if (o.id) msg += `ID: \`${o.id}\`\n`;
      msg += "\n";
    }
    await ctx.editMessageText(msg, { parse_mode: "Markdown" });
    return;
  }

  if (data === "dc:refresh") {
    const authToken = await botAuth(userId);
    if (!authToken) return;
    const res = await botApi(authToken, "/api/dca/orders").catch(() => ({ orders: [] }));
    setCache(userId, "orders", res.orders || []);
    let msg = `*DCA Orders* (refreshed)\n\n`;
    if (!res.orders?.length) msg += "No active orders.";
    else for (const o of res.orders.slice(0, 5)) {
      msg += `${o.status} — ${o.frequency} — ${o.executedTradesCount} trades\n`;
    }
    await ctx.editMessageText(msg, { parse_mode: "Markdown" });
    return;
  }

  if (data === "dc:cancel") { clearState(userId); await ctx.editMessageText("Cancelled."); }
}

export async function handleDcaTextInput(ctx: Context, userId: number, text: string) {
  const state = getState(userId);
  if (!state || state.flow !== "dca") return false;

  if (state.step === "enter_total") {
    if (isNaN(parseFloat(text)) || parseFloat(text) <= 0) { await ctx.reply("Enter a valid total amount:"); return true; }
    updateState(userId, "enter_per_cycle", { totalAmount: text.trim() });
    const suggested = (parseFloat(text) / 10).toFixed(2);
    await ctx.reply(`*Step 4/5* — Enter amount per cycle:\n\nSuggested: ${suggested} ${state.data.sellToken} (10 cycles)`, { parse_mode: "Markdown" });
    return true;
  }

  if (state.step === "enter_per_cycle") {
    if (isNaN(parseFloat(text)) || parseFloat(text) <= 0) { await ctx.reply("Enter a valid per-cycle amount:"); return true; }
    updateState(userId, "select_frequency", { perCycle: text.trim() });
    const kb = new InlineKeyboard()
      .text("Hourly", "dc:fr:PT1H")
      .text("Every 12h", "dc:fr:PT12H")
      .row()
      .text("Daily", "dc:fr:P1D")
      .text("Weekly", "dc:fr:P1W");
    await ctx.reply("*Step 5/5* — Select frequency:", { parse_mode: "Markdown", reply_markup: kb });
    return true;
  }

  return false;
}

async function createDirect(ctx: Context, userId: number, sell: string, buy: string, total: string, perCycle: string, freq: string) {
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }
  const freqLabels: Record<string, string> = { PT1H: "hourly", PT12H: "every 12h", P1D: "daily", P1W: "weekly" };
  await ctx.reply(`Creating DCA: ${total} ${sell.toUpperCase()} → ${buy.toUpperCase()} (${perCycle}/cycle, ${freqLabels[freq] || freq})...`);
  const result = await botApi(token, "/api/dca/create", {
    method: "POST", body: JSON.stringify({ sellTokenSymbol: sell.toUpperCase(), buyTokenSymbol: buy.toUpperCase(), totalAmount: total, amountPerCycle: perCycle, frequency: freq }),
  }).catch((e: any) => ({ error: true, message: e.message }));
  if (result.error) { await ctx.reply(`Failed: ${result.message}`); return; }
  await ctx.reply(`*DCA Created!*\n\n${total} ${sell.toUpperCase()} → ${buy.toUpperCase()}\n${freqLabels[freq] || freq}\n\n[View](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
}

async function cancelOrder(ctx: Context, userId: number, orderId: string) {
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }
  await ctx.reply("Cancelling DCA order...");
  const result = await botApi(token, "/api/dca/cancel", { method: "POST", body: JSON.stringify({ orderId }) }).catch((e: any) => ({ error: true, message: e.message }));
  if (result.error) { await ctx.reply(`Failed: ${result.message}`); return; }
  await ctx.reply(`*Cancelled!*\n\n[View](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
}
