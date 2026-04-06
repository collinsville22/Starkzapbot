import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";
import { setState, getState, updateState, clearState } from "../utils/state.js";

const TOKENS = ["STRK", "ETH", "USDC", "WBTC", "DAI", "USDT"];

export async function sendCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const parts = (ctx.message?.text || "").split(" ").slice(1);
  if (parts.length >= 3) return executeSend(ctx, userId, parts[0], parts[1], parts[2].toUpperCase());

  const kb = new InlineKeyboard()
    .text("Normal Send", "send:mode:normal")
    .text("Batch Send", "send:mode:batch")
    .row()
    .text("Private (Tongo)", "send:mode:private");
  await ctx.reply("*Send Tokens*\n\nChoose send mode:", { parse_mode: "Markdown", reply_markup: kb });
}

export async function handleSendCallback(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const data = ctx.callbackQuery?.data || "";
  await ctx.answerCallbackQuery();

  if (data === "send:mode:normal") {
    setState(userId, "send", "enter_address", { mode: "normal" });
    await ctx.editMessageText("*Send Tokens*\n\n*Step 1/4* — Paste recipient Starknet address (0x...):", { parse_mode: "Markdown" });
    return;
  }

  if (data === "send:mode:batch") {
    setState(userId, "send", "batch_enter", { mode: "batch", recipients: "[]" });
    await ctx.editMessageText(
      "*Batch Send*\n\n" +
      "Send to multiple recipients in 1 transaction.\n\n" +
      "Enter recipients one per line:\n`address amount`\n\n" +
      "Example:\n`0x0455...6e 10\n0x0723...0e 5`\n\n" +
      "Then select the token.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "send:mode:private") {
    const token = await botAuth(userId);
    if (!token) { await ctx.editMessageText("Open the app first."); return; }
    const [info, myId] = await Promise.all([
      botApi(token, "/api/confidential/info").catch(() => null),
      botApi(token, "/api/confidential/my-id").catch(() => null),
    ]);

    const kb = new InlineKeyboard()
      .text("Fund", "send:priv:fund")
      .text("Transfer", "send:priv:transfer")
      .text("Withdraw", "send:priv:withdraw")
      .row()
      .text("Check Balance", "send:priv:balance");

    let msg = `*Tongo Private Transfers*\n\nStatus: Live\nSupported: ${info?.supportedTokens?.join(", ") || "STRK, ETH, WBTC, USDC, USDT, DAI"}`;
    if (myId?.tongoAddress) msg += `\n\nYour Private ID:\n\`${myId.tongoAddress}\``;
    msg += "\n\nSelect action:";
    await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb });
    return;
  }

  if (data === "send:priv:fund") {
    setState(userId, "send", "priv_select_token", { mode: "priv_fund" });
    const kb = new InlineKeyboard();
    ["STRK", "ETH", "USDC", "WBTC", "DAI", "USDT"].forEach((t, i) => { kb.text(t, `send:privtoken:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
    await ctx.editMessageText("*Fund Private Balance*\n\nSelect token to deposit:", { parse_mode: "Markdown", reply_markup: kb });
    return;
  }
  if (data === "send:priv:transfer") {
    setState(userId, "send", "priv_enter_address", { mode: "priv_transfer" });
    await ctx.editMessageText("*Private Transfer*\n\nPaste recipient's Starknet address (must be a StarkZap user):", { parse_mode: "Markdown" });
    return;
  }
  if (data === "send:priv:withdraw") {
    setState(userId, "send", "priv_select_token", { mode: "priv_withdraw" });
    const kb = new InlineKeyboard();
    ["STRK", "ETH", "USDC", "WBTC", "DAI", "USDT"].forEach((t, i) => { kb.text(t, `send:privtoken:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
    await ctx.editMessageText("*Withdraw to Public*\n\nSelect token:", { parse_mode: "Markdown", reply_markup: kb });
    return;
  }
  if (data === "send:priv:balance") {
    setState(userId, "send", "priv_bal_token", { mode: "priv_balance" });
    const kb = new InlineKeyboard();
    ["STRK", "ETH", "USDC"].forEach(t => kb.text(t, `send:privbal:${t}`));
    await ctx.editMessageText("Check private balance for:", { reply_markup: kb });
    return;
  }
  if (data.startsWith("send:privbal:")) {
    const tokenSym = data.split(":")[2];
    const token = await botAuth(userId);
    if (!token) return;
    const bal = await botApi(token, "/api/confidential/balance", { method: "POST", body: JSON.stringify({ tokenSymbol: tokenSym }) }).catch(() => null);
    clearState(userId);
    await ctx.editMessageText(`*Private ${tokenSym} Balance*\n\nBalance: ${bal?.balance || "0"}\nPending: ${bal?.pending || "0"}`, { parse_mode: "Markdown" });
    return;
  }
  if (data.startsWith("send:privtoken:")) {
    const tokenSym = data.split(":")[2];
    updateState(userId, "priv_enter_amount", { tokenSymbol: tokenSym });
    const state = getState(userId)!;
    const label = state.data.mode === "priv_fund" ? "Fund" : state.data.mode === "priv_withdraw" ? "Withdraw" : "Transfer";
    await ctx.editMessageText(`*${label} ${tokenSym}*\n\nEnter amount:`, { parse_mode: "Markdown" });
    return;
  }

  if (data.startsWith("send:token:")) {
    const tokenSym = data.split(":")[2];
    updateState(userId, "enter_amount", { tokenSymbol: tokenSym });
    const state = getState(userId)!;
    await ctx.editMessageText(
      `*Send ${tokenSym}*\n\nTo: \`${state.data.recipient?.slice(0, 10)}...${state.data.recipient?.slice(-6)}\`\n\n*Step 3/4* — Enter amount:`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "send:confirm") {
    const state = getState(userId);
    if (!state) return;
    clearState(userId);
    if (state.data.mode === "normal") return executeSend(ctx, userId, state.data.recipient, state.data.amount, state.data.tokenSymbol);
    if (state.data.mode === "batch") return executeBatch(ctx, userId, state.data.tokenSymbol, JSON.parse(state.data.recipients || "[]"));
    if (state.data.mode === "priv_fund") return executePrivate(ctx, userId, "fund", state.data.tokenSymbol, state.data.amount);
    if (state.data.mode === "priv_transfer") return executePrivate(ctx, userId, "transfer", state.data.tokenSymbol, state.data.amount, state.data.recipient);
    if (state.data.mode === "priv_withdraw") return executePrivate(ctx, userId, "withdraw", state.data.tokenSymbol, state.data.amount);
    return;
  }

  if (data === "send:cancel") { clearState(userId); await ctx.editMessageText("Cancelled."); }
}

export async function handleSendTextInput(ctx: Context, userId: number, text: string) {
  const state = getState(userId);
  if (!state || state.flow !== "send") return false;

  if (state.step === "enter_address") {
    if (!text.startsWith("0x") || text.length < 20) { await ctx.reply("Enter a valid Starknet address (0x...):"); return true; }
    updateState(userId, "select_token", { recipient: text.trim() });
    const kb = new InlineKeyboard();
    TOKENS.forEach((t, i) => { kb.text(t, `send:token:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
    await ctx.reply(`*Step 2/4* — Select token to send:`, { parse_mode: "Markdown", reply_markup: kb });
    return true;
  }

  if (state.step === "enter_amount") {
    if (isNaN(parseFloat(text)) || parseFloat(text) <= 0) { await ctx.reply("Enter a valid amount:"); return true; }
    updateState(userId, "confirm", { amount: text.trim() });
    const s = getState(userId)!.data;
    const kb = new InlineKeyboard().text("Confirm Send", "send:confirm").text("Cancel", "send:cancel");
    await ctx.reply(
      `*Step 4/4 — Confirm Send*\n\nTo: \`${s.recipient?.slice(0, 10)}...${s.recipient?.slice(-6)}\`\nAmount: *${text.trim()} ${s.tokenSymbol}*\nFee: Gasless`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return true;
  }

  if (state.step === "batch_enter") {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(l => l);
    const recipients = lines.map(l => { const [to, amount] = l.split(/\s+/); return { to, amount }; }).filter(r => r.to && r.amount);
    if (recipients.length === 0) { await ctx.reply("Invalid format. Enter:\n`address amount`\nOne per line."); return true; }
    updateState(userId, "batch_select_token", { recipients: JSON.stringify(recipients) });
    const kb = new InlineKeyboard();
    TOKENS.forEach((t, i) => { kb.text(t, `send:token:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
    await ctx.reply(`Parsed ${recipients.length} recipients.\n\nSelect token:`, { reply_markup: kb });
    return true;
  }

  if (state.step === "batch_select_token") {
    return false;
  }

  if (state.step === "priv_enter_address") {
    if (!text.startsWith("0x")) { await ctx.reply("Enter valid Starknet address:"); return true; }
    updateState(userId, "priv_select_token", { recipient: text.trim() });
    const kb = new InlineKeyboard();
    ["STRK", "ETH", "USDC", "WBTC"].forEach(t => kb.text(t, `send:privtoken:${t}`));
    await ctx.reply("Select token to transfer:", { reply_markup: kb });
    return true;
  }

  if (state.step === "priv_enter_amount") {
    if (isNaN(parseFloat(text)) || parseFloat(text) <= 0) { await ctx.reply("Enter a valid amount:"); return true; }
    updateState(userId, "confirm", { amount: text.trim() });
    const s = getState(userId)!.data;
    const label = s.mode === "priv_fund" ? "Fund Private Balance" : s.mode === "priv_withdraw" ? "Withdraw to Public" : "Private Transfer";
    const kb = new InlineKeyboard().text(`Confirm ${label}`, "send:confirm").text("Cancel", "send:cancel");
    let msg = `*Confirm ${label}*\n\nAmount: *${text.trim()} ${s.tokenSymbol}*`;
    if (s.recipient) msg += `\nTo: \`${s.recipient.slice(0, 10)}...${s.recipient.slice(-6)}\``;
    msg += `\nProtocol: Tongo (ZK proofs)\nFee: Gasless`;
    await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
    return true;
  }

  return false;
}

async function executeSend(ctx: Context, userId: number, recipient: string, amount: string, tokenSymbol: string) {
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }
  await ctx.reply(`Sending ${amount} ${tokenSymbol} to ${recipient.slice(0, 8)}...${recipient.slice(-6)}...`);
  const result = await botApi(token, "/api/transfer/send", { method: "POST", body: JSON.stringify({ tokenSymbol, amount, recipient }) }).catch((e: any) => ({ error: true, message: e.message }));
  if (result.error) { await ctx.reply(`Failed: ${result.message}`); return; }
  await ctx.reply(`*Sent!* ${amount} ${tokenSymbol}\n\n[View on StarkScan](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
}

async function executeBatch(ctx: Context, userId: number, tokenSymbol: string, transfers: Array<{to: string; amount: string}>) {
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }
  await ctx.reply(`Sending ${tokenSymbol} to ${transfers.length} recipients in 1 transaction...`);
  const result = await botApi(token, "/api/advanced/batch-transfer", { method: "POST", body: JSON.stringify({ tokenSymbol, transfers }) }).catch((e: any) => ({ error: true, message: e.message }));
  if (result.error) { await ctx.reply(`Failed: ${result.message}`); return; }
  await ctx.reply(`*Batch Sent!* ${tokenSymbol} to ${transfers.length} recipients\n\n[View on StarkScan](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
}

async function executePrivate(ctx: Context, userId: number, action: string, tokenSymbol: string, amount: string, recipient?: string) {
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }
  const labels: Record<string, string> = { fund: "Funding", transfer: "Sending privately", withdraw: "Withdrawing" };
  await ctx.reply(`${labels[action] || action} ${amount} ${tokenSymbol}...`);
  const endpoint = action === "fund" ? "/api/confidential/fund" : action === "transfer" ? "/api/confidential/transfer" : "/api/confidential/withdraw";
  const body: any = { tokenSymbol, amount };
  if (recipient) body.recipientAddress = recipient;
  const result = await botApi(token, endpoint, { method: "POST", body: JSON.stringify(body) }).catch((e: any) => ({ error: true, message: e.message }));
  if (result.error) { await ctx.reply(`Failed: ${result.message}`); return; }
  const doneLabels: Record<string, string> = { fund: "Funded!", transfer: "Sent Privately!", withdraw: "Withdrawn!" };
  await ctx.reply(`*${doneLabels[action]}* ${amount} ${tokenSymbol}\n\n[View on StarkScan](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
}
