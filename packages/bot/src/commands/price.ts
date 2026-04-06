import type { Context } from "grammy";

const BACKEND_URL = () => process.env.BACKEND_URL || "http://localhost:3001";

export async function priceCommand(ctx: Context) {
  const text = ctx.message?.text || "";
  const token = text.split(" ")[1]?.toUpperCase();

  if (!token) {
    await ctx.reply("Usage: /price <token>\nExample: /price ETH\n\nSupported: ETH, STRK, WBTC, USDC, wstETH, DAI, USDT");
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL()}/api/prices`);
    if (!res.ok) throw new Error("Price API error");

    const data = await res.json();
    const price = data.prices?.[token];

    if (!price) {
      await ctx.reply(`Price not available for ${token}. Try: ETH, STRK, WBTC, USDC, wstETH`);
      return;
    }

    const formatted = price < 1 ? `$${price.toFixed(6)}` : `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    await ctx.reply(`*${token}*: ${formatted}\n\n_Price from AVNU DEX_`, { parse_mode: "Markdown" });
  } catch {
    await ctx.reply(`Could not fetch price for ${token}. Try again later.`);
  }
}
