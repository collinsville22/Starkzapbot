import { InlineKeyboard } from "grammy";

const MINI_APP_URL = () => process.env.MINI_APP_URL || "https://starkzap-tg.vercel.app";

export function mainMenuKeyboard() {
  return new InlineKeyboard()
    .webApp("Open App", MINI_APP_URL())
    .row()
    .webApp("Swap", `${MINI_APP_URL()}?startapp=swap`)
    .webApp("Stake", `${MINI_APP_URL()}?startapp=stake`)
    .row()
    .webApp("Lend", `${MINI_APP_URL()}?startapp=lend`)
    .webApp("DCA", `${MINI_APP_URL()}?startapp=dca`)
    .row()
    .webApp("Bridge", `${MINI_APP_URL()}?startapp=bridge`)
    .webApp("Send", `${MINI_APP_URL()}?startapp=send`);
}

export function swapConfirmKeyboard(tokenIn: string, tokenOut: string, amount: string) {
  return new InlineKeyboard()
    .text("Confirm Swap", `swap:confirm:${tokenIn}:${tokenOut}:${amount}`)
    .text("Cancel", "swap:cancel");
}

export function portfolioKeyboard() {
  return new InlineKeyboard()
    .webApp("Full Portfolio", MINI_APP_URL())
    .row()
    .text("Refresh", "portfolio:refresh");
}
