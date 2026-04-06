import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { botAuth, botApi, botPublicApi } from "../utils/backend.js";
import { setState, getState, updateState, clearState, setCache, getCache } from "../utils/state.js";

export async function stakeCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const parts = (ctx.message?.text || "").split(" ").slice(1);
  if (parts[0] === "claim" && parts[1]) return claimRewards(ctx, userId, parts[1]);
  if (parts[0] === "unstake" && parts.length >= 4) return unstake(ctx, userId, parts[1], parts[2], parts[3]);
  if (parts.length >= 3 && parts[0].startsWith("0x")) return executeStake(ctx, userId, parts[0], parts[1], parts[2]);

  setState(userId, "stake", "select_token");

  const [tokensRes, apyRes] = await Promise.all([
    botPublicApi("/api/staking/tokens").catch(() => ({ tokens: [] })),
    botPublicApi("/api/staking/apy").catch(() => null),
  ]);

  let msg = "*Starknet Staking*\n\n";
  if (apyRes) {
    msg += `STRK APY: *${apyRes.strkApy}%*\n`;
    msg += `Total staked: ${(apyRes.totalStaked || 0).toLocaleString()} STRK\n`;
    if (apyRes.btcStrkPerYear) msg += `BTC: ~${apyRes.btcStrkPerYear} STRK/BTC/yr\n`;
    msg += "\n";
  }
  msg += "*Step 1/5* — Select token to stake:";

  const kb = new InlineKeyboard();
  const tokens = tokensRes.tokens || [];
  tokens.forEach((t: any, i: number) => kb.text(t.symbol, `sk:t:${i}`));
  setCache(userId, "tokens", tokens);
  kb.row().text("Claim Rewards", "sk:claim").text("Unstake", "sk:unstk");
  kb.row().text("My Position", "sk:pos");

  await ctx.reply(msg, { parse_mode: "Markdown", reply_markup: kb });
}

export async function handleStakeCallback(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const data = ctx.callbackQuery?.data || "";
  await ctx.answerCallbackQuery();

  if (data.startsWith("sk:t:")) {
    const idx = parseInt(data.split(":")[2]);
    const tokens = getCache(userId, "tokens") || [];
    const token = tokens[idx];
    if (!token) { await ctx.editMessageText("Token not found. Try /stake again."); return; }

    updateState(userId, "select_validator", { tokenSymbol: token.symbol });

    const res = await botPublicApi("/api/staking/validators/quick").catch(() => ({ validators: [] }));
    const validators = (res.validators || []).slice(0, 10);
    setCache(userId, "validators", validators);

    let msg = `*Staking ${token.symbol}*\n\n*Step 2/5* — Select validator:\n`;
    const kb = new InlineKeyboard();
    validators.forEach((v: any, i: number) => {
      kb.text(v.name, `sk:v:${i}`).row();
    });
    kb.text("More: /validators", "sk:noop");

    await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb });
    return;
  }

  if (data.startsWith("sk:v:")) {
    const idx = parseInt(data.split(":")[2]);
    const validators = getCache(userId, "validators") || [];
    const v = validators[idx];
    if (!v) { await ctx.editMessageText("Validator not found. Try /stake again."); return; }

    updateState(userId, "select_pool", { stakerAddress: v.stakerAddress, validatorName: v.name });

    const poolsRes = await botPublicApi(`/api/staking/pools/${v.stakerAddress}`).catch(() => ({ pools: [] }));
    const pools = poolsRes.pools || [];
    setCache(userId, "pools", pools);

    if (pools.length === 0) { await ctx.editMessageText(`No pools for ${v.name}.`); return; }

    let msg = `*${v.name}*\n\n*Step 3/5* — Select pool:\n`;
    const kb = new InlineKeyboard();
    pools.forEach((p: any, i: number) => {
      kb.text(`${p.token.symbol} · ${p.commission}% fee`, `sk:p:${i}`).row();
    });

    await ctx.editMessageText(msg, { parse_mode: "Markdown", reply_markup: kb });
    return;
  }

  if (data.startsWith("sk:p:")) {
    const idx = parseInt(data.split(":")[2]);
    const pools = getCache(userId, "pools") || [];
    const pool = pools[idx];
    if (!pool) { await ctx.editMessageText("Pool not found. Try /stake again."); return; }

    updateState(userId, "enter_amount", { poolAddress: pool.address, poolToken: pool.token.symbol, commission: String(pool.commission) });

    const state = getState(userId)!;
    const apyRes = await botPublicApi("/api/staking/apy").catch(() => null);
    let apyLine = "";
    if (apyRes && pool.token.symbol === "STRK") {
      apyLine = `Net APY: *${(apyRes.strkApy * (1 - pool.commission / 100)).toFixed(2)}%*\n`;
    }

    let posMsg = "";
    const authToken = await botAuth(userId);
    if (authToken) {
      const pos = await botApi(authToken, "/api/staking-manage/position", {
        method: "POST", body: JSON.stringify({ poolAddress: pool.address }),
      }).catch(() => null);
      if (pos?.isMember && pos?.position) {
        posMsg = `\n*Your Position:*\nStaked: ${pos.position.staked}\nRewards: ${pos.position.rewards}\n`;
      }
    }

    await ctx.editMessageText(
      `*${state.data.validatorName}* — ${pool.token.symbol}\n\n` +
      `Delegated: ${pool.amount}\n` +
      `Fee: ${pool.commission}%\n` +
      apyLine +
      posMsg +
      `\n*Step 4/5* — Enter amount of ${pool.token.symbol} to stake:`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "sk:confirm") {
    const state = getState(userId);
    if (!state) return;
    clearState(userId);
    await executeStake(ctx, userId, state.data.poolAddress, state.data.amount, state.data.poolToken);
    return;
  }
  if (data === "sk:cancel") { clearState(userId); await ctx.editMessageText("Cancelled."); return; }

  if (data === "sk:claim") {
    setState(userId, "stake", "claim_enter_pool");
    await ctx.editMessageText("*Claim Rewards*\n\nPaste the pool address:", { parse_mode: "Markdown" });
    return;
  }
  if (data === "sk:unstk") {
    setState(userId, "stake", "unstake_enter_pool");
    await ctx.editMessageText("*Unstake*\n\nPaste the pool address:", { parse_mode: "Markdown" });
    return;
  }
  if (data === "sk:pos") {
    setState(userId, "stake", "pos_enter_pool");
    await ctx.editMessageText("*Check Position*\n\nPaste pool address to check your position:", { parse_mode: "Markdown" });
    return;
  }
  if (data === "sk:noop") { /* do nothing */ return; }
}

export async function handleStakeTextInput(ctx: Context, userId: number, text: string) {
  const state = getState(userId);
  if (!state || state.flow !== "stake") return false;

  if (state.step === "enter_amount") {
    if (isNaN(parseFloat(text)) || parseFloat(text) <= 0) { await ctx.reply("Enter a valid amount:"); return true; }
    updateState(userId, "confirm", { amount: text.trim() });
    const s = getState(userId)!.data;
    const apyRes = await botPublicApi("/api/staking/apy").catch(() => null);
    let apyLine = "";
    if (apyRes && s.poolToken === "STRK") {
      apyLine = `Net APY: *${(apyRes.strkApy * (1 - parseInt(s.commission) / 100)).toFixed(2)}%*\n`;
    }
    const kb = new InlineKeyboard().text("Confirm Stake", "sk:confirm").text("Cancel", "sk:cancel");
    await ctx.reply(
      `*Step 5/5 — Confirm*\n\n` +
      `Validator: *${s.validatorName}*\n` +
      `Token: *${s.poolToken}*\n` +
      `Amount: *${text.trim()} ${s.poolToken}*\n` +
      `Fee: ${s.commission}%\n` +
      apyLine +
      `StarkZap: 0%\nNetwork: Gasless`,
      { parse_mode: "Markdown", reply_markup: kb }
    );
    return true;
  }

  if (state.step === "claim_enter_pool") {
    if (!text.startsWith("0x")) { await ctx.reply("Enter a valid address (0x...):"); return true; }
    clearState(userId);
    await claimRewards(ctx, userId, text.trim());
    return true;
  }

  if (state.step === "unstake_enter_pool") {
    if (!text.startsWith("0x")) { await ctx.reply("Enter a valid address (0x...):"); return true; }
    updateState(userId, "unstake_details", { poolAddress: text.trim() });
    await ctx.reply("Enter amount and token:\nExample: `100 STRK`", { parse_mode: "Markdown" });
    return true;
  }

  if (state.step === "unstake_details") {
    const [amount, token] = text.trim().split(/\s+/);
    if (!amount || !token) { await ctx.reply("Format: `amount TOKEN`", { parse_mode: "Markdown" }); return true; }
    clearState(userId);
    await unstake(ctx, userId, state.data.poolAddress, amount, token.toUpperCase());
    return true;
  }

  if (state.step === "pos_enter_pool") {
    if (!text.startsWith("0x")) { await ctx.reply("Enter a valid address (0x...):"); return true; }
    clearState(userId);
    const authToken = await botAuth(userId);
    if (!authToken) { await ctx.reply("Open the app first."); return true; }
    const pos = await botApi(authToken, "/api/staking-manage/position", {
      method: "POST", body: JSON.stringify({ poolAddress: text.trim() }),
    }).catch(() => null);
    if (!pos?.isMember) { await ctx.reply("You are not a member of this pool."); return true; }
    const p = pos.position;
    await ctx.reply(
      `*Staking Position*\n\n` +
      `Staked: ${p.staked}\nRewards: ${p.rewards}\nTotal: ${p.total}\n` +
      `Commission: ${p.commissionPercent}%\n` +
      (p.unpoolTime ? `Exit available: ${new Date(p.unpoolTime).toLocaleDateString()}\n` : "") +
      `\nClaim: /stake claim ${text.trim()}`,
      { parse_mode: "Markdown" }
    );
    return true;
  }

  return false;
}

async function executeStake(ctx: Context, userId: number, pool: string, amount: string, tokenSymbol: string) {
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }
  await ctx.reply(`Staking ${amount} ${tokenSymbol}...`);
  const result = await botApi(token, "/api/staking/stake", {
    method: "POST", body: JSON.stringify({ poolAddress: pool, amount, tokenSymbol }),
  }).catch((e: any) => ({ error: true, message: e.message }));
  if (result.error) { await ctx.reply(`Failed: ${result.message}`); return; }
  await ctx.reply(`*Staked!* ${amount} ${tokenSymbol}\n\nClaim: /stake claim ${pool}\n\n[View](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
}

async function claimRewards(ctx: Context, userId: number, pool: string) {
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }
  await ctx.reply("Claiming rewards...");
  const result = await botApi(token, "/api/staking-manage/claim-rewards", { method: "POST", body: JSON.stringify({ poolAddress: pool }) }).catch((e: any) => ({ error: true, message: e.message }));
  if (result.error) { await ctx.reply(`Failed: ${result.message}`); return; }
  await ctx.reply(`*Claimed!*\n\n[View](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
}

async function unstake(ctx: Context, userId: number, pool: string, amount: string, tokenSymbol: string) {
  const token = await botAuth(userId);
  if (!token) { await ctx.reply("Open the app first."); return; }
  await ctx.reply(`Unstaking ${amount} ${tokenSymbol}...`);
  const result = await botApi(token, "/api/staking-manage/exit-intent", { method: "POST", body: JSON.stringify({ poolAddress: pool, amount, tokenSymbol }) }).catch((e: any) => ({ error: true, message: e.message }));
  if (result.error) { await ctx.reply(`Failed: ${result.message}`); return; }
  await ctx.reply(`*Unstake Started!*\nComplete after waiting period.\n\n[View](${result.explorerUrl || `https://starkscan.co/tx/${result.txHash}`})`, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
}
