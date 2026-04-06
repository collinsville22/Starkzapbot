import type { Context } from "grammy";
import { mainMenuKeyboard } from "../keyboards.js";

export async function startCommand(ctx: Context) {
  const user = ctx.from;
  if (!user) return;

  await ctx.reply(
    `Welcome to StarkZap!\n\n` +
    `Your gateway to Starknet DeFi — all from Telegram.\n` +
    `A wallet is created for you automatically.\n\n` +

    `WALLET\n` +
    `/balance — Your balances + USD values\n` +
    `/address — Wallet address + explorer link\n` +
    `/deploy — Deploy account on Starknet\n\n` +

    `TRADING\n` +
    `/price ETH — Live token price\n` +
    `/swap ETH USDC 0.5 — Execute swap instantly\n` +
    `/send 0x... 10 STRK — Send tokens\n\n` +

    `EARNING\n` +
    `/stake — Staking APY + stake/claim/unstake\n` +
    `/validators — Browse 138+ validators\n` +
    `/lend — Vesu markets + deposit/borrow/repay\n` +
    `/dca — Dollar-cost averaging orders\n\n` +

    `ADVANCED\n` +
    `/private — Confidential transfers (Tongo ZK)\n` +
    `/history — Transaction history\n` +
    `/position — Staking + lending positions\n` +
    `/health USDC ETH — Lending health factor\n\n` +

    `All gasless! Or open the Mini App for the full UI:`,
    { reply_markup: mainMenuKeyboard() }
  );
}
