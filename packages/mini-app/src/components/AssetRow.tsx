import type { TokenBalance } from "@starkzap-tg/shared";
import { formatBalance } from "../lib/format.js";
import { TokenIcon } from "./Icons.js";

interface AssetRowProps {
  balance: TokenBalance;
  onClick?: () => void;
  delay?: number;
}

export function AssetRow({ balance, onClick, delay = 0 }: AssetRowProps) {
  const bal = parseFloat(balance.balance);
  const hasBalance = bal > 0;
  const usd = balance.usdValue || 0;

  return (
    <button
      onClick={onClick}
      className="animate-in w-full flex items-center gap-3 glass-card mb-2 tilt-press"
      style={{ animationDelay: `${delay * 0.04}s` }}
    >
      <TokenIcon symbol={balance.token.symbol} size={40} logoUrl={balance.token.logoUrl} />
      <div className="flex-1 text-left min-w-0">
        <div className="text-sm text-white font-bold tracking-tight">{balance.token.symbol}</div>
        <div className="text-[11px] text-sz-text-muted truncate">{balance.token.name}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold tracking-tight ${hasBalance ? "text-white" : "text-sz-text-muted/30"}`}>
          {hasBalance ? formatBalance(balance.balance) : "0"}
        </div>
        {hasBalance && usd > 0 && (
          <div className="text-[11px] text-sz-green font-semibold">
            ${usd < 0.01 ? "<0.01" : usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>
    </button>
  );
}
