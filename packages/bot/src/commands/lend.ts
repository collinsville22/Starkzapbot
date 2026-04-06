import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botAuth, botApi } from "../utils/backend.js";
import { setState, getState, updateState, clearState, setCache, getCache } from "../utils/state.js";

const MINI_APP_URL = process.env.MINI_APP_URL || "https://starkzap-azure.vercel.app";

export async function lendCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const parts = (ctx.message?.text || "").split(" ").slice(1);
  if ((parts[0] === "deposit" || parts[0] === "withdraw") && parts.length >= 3) {
    const kb = new InlineKeyboard().webApp("Open App to Execute", `${MINI_APP_URL}?startapp=lend`);
    await ctx.reply(`${parts[0] === "deposit" ? "Deposit" : "Withdraw"} ${parts[1]} ${parts[2].toUpperCase()}\n\nOpen the app to complete this transaction:`, { reply_markup: kb });
    return;
  }
  if ((parts[0] === "borrow" || parts[0] === "repay") && parts.length >= 4) {
    const kb = new InlineKeyboard().webApp("Open App to Execute", `${MINI_APP_URL}?startapp=lend`);
    await ctx.reply(`${parts[0] === "borrow" ? "Borrow" : "Repay"} ${parts[1]} ${parts[2].toUpperCase()} against ${parts[3].toUpperCase()}\n\nOpen the app to complete this transaction:`, { reply_markup: kb });
    return;
  }

  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first to set up your wallet."); return; }

  setState(userId, "lend", "main");

  const [marketsRes, positionsRes] = await Promise.all([
    botApi(token, "/api/lending/markets").catch(() => ({ markets: [] })),
    botApi(token, "/api/lending/positions").catch(() => ({ positions: [] })),
  ]);

  const markets = marketsRes.markets || [];
  const positions = positionsRes.positions || [];
  const topMarkets = markets.filter((m: any) => m.supplyApy && parseFloat(m.supplyApy) > 0).slice(0, 6);
  setCache(userId, "markets", markets);

  let msg = "*Vesu Lending*\n\n";

  if (positions.length > 0) {
    msg += "*Your Positions:*\n";
    for (const p of positions) {
      const icon = p.type === "earn" ? "+" : "-";
      msg += `${icon} ${p.type.toUpperCase()}: ${p.collateral?.token?.symbol || "?"}`;
      if (p.pool?.name) msg += ` (${p.pool.name})`;
      if (p.debt) msg += ` | Debt: ${p.debt.token?.symbol}`;
      msg += "\n";
    }
    msg += "\n";
  }

  msg += "*Top Markets:*\n";
  for (const m of topMarkets) {
    const apy = (parseFloat(m.supplyApy) * 100).toFixed(2);
    msg += `${m.asset.symbol}: *${apy}% APY*`;
    if (m.totalSupplied) msg += ` · TVL: ${m.totalSupplied}`;
    if (m.utilization) msg += ` · ${(parseFloat(m.utilization) * 100).toFixed(0)}% util`;
    msg += "\n";
  }

  msg += "\nWhat would you like to do?";

  const kb = new InlineKeyboard()
    .text("Deposit (Earn)", "ld:deposit").text("Withdraw", "ld:withdraw").row()
    .text("Borrow", "ld:borrow").text("Repay Debt", "ld:repay").row()
    .text("Withdraw All", "ld:wmax").text("All Markets", "ld:markets");

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
}

export async function handleLendCallback(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const data = ctx.callbackQuery?.data || "";
  await ctx.answerCallbackQuery();

  const authToken = await botAuth(userId);
  if (!authToken) { await ctx.editMessageText("Open the app first."); return; }

  const TOKENS = ["USDC", "ETH", "STRK", "WBTC", "DAI", "USDT"];

  if (data === "ld:markets") {
    const res = await botApi(authToken, "/api/lending/markets").catch(() => null);
    if (!res?.markets?.length) { await ctx.editMessageText("No markets."); return; }
    let msg = "*All Vesu Markets*\n\n";
    for (const m of res.markets.slice(0, 12)) {
      const sApy = m.supplyApy ? (parseFloat(m.supplyApy) * 100).toFixed(2) : "0";
      const bApr = m.borrowApr ? (parseFloat(m.borrowApr) * 100).toFixed(2) : null;
      msg += `*${m.asset.symbol}*`;
      if (m.poolName) msg += ` — ${m.poolName}`;
      msg += `\n  Supply: ${sApy}% APY`;
      if (bApr) msg += ` | Borrow: ${bApr}% APR`;
      if (m.totalSupplied) msg += `\n  TVL: ${m.totalSupplied}`;
      if (m.utilization) msg += ` · Util: ${(parseFloat(m.utilization) * 100).toFixed(0)}%`;
      msg += "\n\n";
    }
    await ctx.editMessageText(msg, { parse_mode: "Markdown" });
    return;
  }

  if (data === "ld:deposit" || data === "ld:withdraw") {
    const action = data === "ld:deposit" ? "deposit" : "withdraw";
    updateState(userId, "select_token", { action });

    let markets = getCache(userId, "markets");
    if (!markets || markets.length === 0) {
      const res = await botApi(authToken, "/api/lending/markets").catch(() => ({ markets: [] }));
      markets = res.markets || [];
      setCache(userId, "markets", markets);
    }

    const kb = new InlineKeyboard();
    TOKENS.forEach((t, i) => { kb.text(t, `ld:tk:${t}`); if ((i + 1) % 3 === 0) kb.row(); });

    let apyHint = "";
    if (action === "deposit") {
      for (const t of TOKENS.slice(0, 4)) {
        const m = markets.find((x: any) => x.asset.symbol === t && parseFloat(x.supplyApy || "0") > 0);
        if (m) apyHint += `${t}: ${(parseFloat(m.supplyApy) * 100).toFixed(1)}% APY\n`;
      }
    }

    await ctx.editMessageText(
      `*${action === "deposit" ? "Deposit" : "Withdraw"}*\n\n` +
      (apyHint ? apyHint + "\n" : "") +
      `*Step 1/3* — Select token:`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return;
  }

  if (data === "ld:wmax") {
    clearState(userId);
    const kb = new InlineKeyboard().webApp("Withdraw All in App", `${MINI_APP_URL}?startapp=lend`);
    await ctx.editMessageText("Open the app to withdraw all:", { reply_markup: kb });
    return;
  }

  if (data === "ld:borrow" || data === "ld:repay") {
    const action = data === "ld:borrow" ? "borrow" : "repay";
    updateState(userId, "borrow_debt", { action });

      let healthMsg = "";
    const health = await botApi(authToken, "/api/lending/health", {
      method: "POST", body: JSON.stringify({ collateralTokenSymbol: "ETH", debtTokenSymbol: "USDC" }),
    }).catch(() => null);
    if (health && health.debtValue && health.debtValue !== "0") {
      healthMsg = `\nHealth: ${health.isCollateralized ? "Safe" : "AT RISK"}\n`;
    }

    const kb = new InlineKeyboard();
    TOKENS.forEach((t, i) => { kb.text(t, `ld:dt:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
    await ctx.editMessageText(
      `*${action === "borrow" ? "Borrow" : "Repay"}*\n${healthMsg}\n` +
      `*Step 1/4* — Select ${action === "borrow" ? "token to borrow" : "debt token"}:`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return;
  }

  if (data.startsWith("ld:dt:")) {
    const debtToken = data.split(":")[2];
    updateState(userId, "borrow_coll", { debtToken });
    const kb = new InlineKeyboard();
    TOKENS.filter(t => t !== debtToken).forEach((t, i) => { kb.text(t, `ld:cl:${t}`); if ((i + 1) % 3 === 0) kb.row(); });
    await ctx.editMessageText(`*Step 2/4* — Select collateral token:`, { parse_mode: "Markdown", reply_markup: kb });
    return;
  }

  if (data.startsWith("ld:cl:")) {
    const collateral = data.split(":")[2];
    updateState(userId, "enter_amount", { collateralToken: collateral });
    const state = getState(userId)!;

    let extra = "";
    if (state.data.action === "borrow") {
      const maxRes = await botApi(authToken, "/api/lending/max-borrow", {
        method: "POST", body: JSON.stringify({ collateralTokenSymbol: collateral, debtTokenSymbol: state.data.debtToken }),
      }).catch(() => null);
      if (maxRes?.maxBorrow && parseFloat(maxRes.maxBorrow) > 0) {
        extra = `\nMax borrow: *${parseFloat(maxRes.maxBorrow).toFixed(4)} ${state.data.debtToken}*\n`;
      }
    }

    await ctx.editMessageText(
      `*${state.data.action === "borrow" ? "Borrow" : "Repay"}*\n\n` +
      `${state.data.debtToken} against ${collateral}\n` +
      extra +
      `\n*Step 3/4* — Enter amount:`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data.startsWith("ld:tk:")) {
    const tokenSym = data.split(":")[2];
    updateState(userId, "select_pool", { tokenSymbol: tokenSym });
    const state = getState(userId)!;

    const markets = getCache(userId, "markets") || [];
    const tokenMarkets = markets.filter((m: any) => m.asset.symbol === tokenSym);
    setCache(userId, "tokenMarkets", tokenMarkets);

    if (tokenMarkets.length === 0) {
      updateState(userId, "enter_amount", {});
      await ctx.editMessageText(`*${state.data.action === "deposit" ? "Deposit" : "Withdraw"} ${tokenSym}*\n\nNo specific pools found.\n\n*Step 3/3* — Enter amount:`, { parse_mode: "Markdown" });
      return;
    }

    if (tokenMarkets.length === 1) {
      updateState(userId, "enter_amount", { poolAddress: tokenMarkets[0].poolAddress, poolName: tokenMarkets[0].poolName || "Default" });
      const apy = tokenMarkets[0].supplyApy ? (parseFloat(tokenMarkets[0].supplyApy) * 100).toFixed(2) + "% APY" : "";
      await ctx.editMessageText(
        `*${state.data.action === "deposit" ? "Deposit" : "Withdraw"} ${tokenSym}*\n\nPool: ${tokenMarkets[0].poolName || "Default"} ${apy}\n\n*Step 3/3* — Enter amount:`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const kb = new InlineKeyboard();
    tokenMarkets.forEach((m: any, i: number) => {
      const apy = m.supplyApy ? (parseFloat(m.supplyApy) * 100).toFixed(2) + "%" : "--";
      const util = m.utilization ? (parseFloat(m.utilization) * 100).toFixed(0) + "% util" : "";
      const label = `${m.poolName || "Pool"} · ${apy} APY ${util ? "· " + util : ""}`;
      kb.text(label, `ld:pl:${i}`).row();
    });

    await ctx.editMessageText(
      `*${state.data.action === "deposit" ? "Deposit" : "Withdraw"} ${tokenSym}*\n\n*Step 2/4* — Select pool:`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return;
  }

  if (data.startsWith("ld:pl:")) {
    const idx = parseInt(data.split(":")[2]);
    const tokenMarkets = getCache(userId, "tokenMarkets") || [];
    const market = tokenMarkets[idx];
    if (!market) { await ctx.editMessageText("Pool not found."); return; }

    updateState(userId, "enter_amount", { poolAddress: market.poolAddress, poolName: market.poolName || "Default" });
    const state = getState(userId)!;
    const apy = market.supplyApy ? (parseFloat(market.supplyApy) * 100).toFixed(2) + "% APY" : "";
    const tvl = market.totalSupplied ? `TVL: ${market.totalSupplied}` : "";

    await ctx.editMessageText(
      `*${state.data.action === "deposit" ? "Deposit" : "Withdraw"} ${state.data.tokenSymbol}*\n\n` +
      `Pool: *${market.poolName || "Default"}*\n${apy} ${tvl}\n\n` +
      `*Step 3/4* — Enter amount:`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "ld:confirm") {
    const state = getState(userId);
    if (!state) return;
    clearState(userId);
    const kb = new InlineKeyboard().webApp("Open App to Execute", `${MINI_APP_URL}?startapp=lend`);
    await ctx.editMessageText("Open the app to complete this transaction:", { reply_markup: kb });
    return;
  }

  if (data === "ld:cancel") { clearState(userId); await ctx.editMessageText("Cancelled."); }
}

export async function handleLendTextInput(ctx: Context, userId: number, text: string) {
  const state = getState(userId);
  if (!state || state.flow !== "lend" || state.step !== "enter_amount") return false;
  if (isNaN(parseFloat(text)) || parseFloat(text) <= 0) { await ctx.reply("Enter a valid amount:"); return true; }

  updateState(userId, "confirm", { amount: text.trim() });
  const s = getState(userId)!.data;

  let healthMsg = "";
  if (s.action === "borrow" || s.action === "repay") {
    const authToken = await botAuth(userId);
    if (authToken) {
      const projected = await botApi(authToken, "/api/advanced/lending-health-quote", {
        method: "POST", body: JSON.stringify({ action: s.action, collateralTokenSymbol: s.collateralToken, debtTokenSymbol: s.debtToken, amount: text.trim() }),
      }).catch(() => null);
      if (projected) healthMsg = `\nAfter ${s.action}: *${projected.isCollateralized ? "Safe" : "LIQUIDATION RISK!"}*\n`;
    }
  }

  const kb = new InlineKeyboard()
    .webApp("Open App to Execute", `${MINI_APP_URL}?startapp=lend`)
    .text("Cancel", "ld:cancel");
  let msg = `*Confirm ${s.action}*\n\n`;
  if (s.action === "deposit" || s.action === "withdraw") {
    msg += `Amount: *${text.trim()} ${s.tokenSymbol}*\n`;
    if (s.poolName) msg += `Pool: ${s.poolName}\n`;
  } else {
    msg += `${s.action === "borrow" ? "Borrow" : "Repay"}: *${text.trim()} ${s.debtToken}*\n`;
    msg += `Collateral: ${s.collateralToken}\n`;
  }
  msg += `Protocol: Vesu\nFee: Gasless${healthMsg}\n\nOpen the app to complete this transaction:`;
  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
  return true;
}
