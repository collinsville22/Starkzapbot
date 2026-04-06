import type { Context } from "grammy";
import { mainMenuKeyboard } from "../keyboards.js";

export async function helpCommand(ctx: Context) {
  await ctx.reply(
    `*StarkZap Bot — Complete Command Reference*\n\n` +

    `*WALLET*\n` +
    `/balance — All token balances + USD\n` +
    `/balance STRK — Specific token\n` +
    `/address — Wallet address + explorer link\n` +
    `/deploy — Deploy account on Starknet\n` +
    `/portfolio — Full portfolio summary\n\n` +

    `*TRADING*\n` +
    `/price ETH — Live price from AVNU\n` +
    `/swap ETH USDC 0.5 — Quote + execute swap\n` +
    `/send 0x... 10 STRK — Send tokens\n\n` +

    `*EARNING*\n` +
    `/stake — View STRK/BTC staking APY\n` +
    `/stake <pool> <amount> <token> — Stake tokens\n` +
    `/stake claim <pool> — Claim rewards\n` +
    `/stake unstake <pool> <amount> <token> — Unstake\n` +
    `/validators — Browse 138+ validators\n` +
    `/validators Karnot — Search by name\n\n` +

    `*LENDING (Vesu)*\n` +
    `/lend — View markets + APY\n` +
    `/lend deposit 100 USDC — Earn yield\n` +
    `/lend withdraw 100 USDC\n` +
    `/lend borrow 50 USDC ETH — Borrow against collateral\n` +
    `/lend repay 50 USDC ETH\n` +
    `/health USDC ETH — Check liquidation risk\n\n` +

    `*DCA*\n` +
    `/dca — View active orders\n` +
    `/dca create STRK USDC 100 10 P1D — Daily DCA\n` +
    `/dca cancel <orderId>\n\n` +

    `*PRIVACY (Tongo)*\n` +
    `/private — Your Tongo ID + info\n` +
    `/private balance STRK — Private balance\n` +
    `/private fund 10 STRK — Deposit privately\n` +
    `/private send 0x... 5 STRK — ZK transfer\n` +
    `/private withdraw 5 STRK — Back to public\n\n` +

    `*HISTORY*\n` +
    `/history — All transactions\n` +
    `/history swap — Filter by type\n` +
    `/position — Staking + lending positions\n` +
    `/position <pool> — Specific staking position\n\n` +

    `_All transactions gasless (AVNU paymaster)_\n` +
    `_Bridge requires Mini App (WalletConnect)_`,
    { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() }
  );
}
