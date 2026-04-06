import type { Token } from "@starkzap-tg/shared";
import { TokenIcon, IconChevron } from "./Icons.js";
import { useTelegram } from "../hooks/useTelegram.js";

interface TokenInputProps {
  label: string;
  token: Token | null;
  value: string;
  onChange: (value: string) => void;
  onTokenClick: () => void;
  balance?: string;
  readOnly?: boolean;
}

export function TokenInput({ label, token, value, onChange, onTokenClick, balance, readOnly = false }: TokenInputProps) {
  const { haptic } = useTelegram();

  const setPercent = (pct: number) => {
    if (!balance) return;
    haptic?.impactOccurred("light");
    onChange((parseFloat(balance) * pct).toString());
  };

  return (
    <div className="glass-card">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-[0.15em]">{label}</span>
        {balance && (
          <button onClick={() => setPercent(1)} className="text-xs text-white font-semibold active:text-sz-orange transition-colors">
            Bal: {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { haptic?.impactOccurred("light"); onTokenClick(); }}
          className="flex items-center gap-2 bg-black/30 rounded-xl px-3 py-2.5 shrink-0 border border-sz-border active:scale-95 transition-all hover:border-sz-orange/30"
        >
          {token ? <><TokenIcon symbol={token.symbol} size={26} logoUrl={token.logoUrl} /><span className="text-sm text-white font-bold">{token.symbol}</span></> : <span className="text-sm text-sz-orange font-bold">Select</span>}
          <IconChevron />
        </button>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          className="flex-1 text-right text-xl font-extrabold bg-transparent text-white placeholder:text-sz-text-muted/30 tracking-tight min-w-0"
        />
      </div>
      {balance && !readOnly && (
        <div className="flex gap-2 mt-3">
          {[{ l: "25%", p: 0.25 }, { l: "50%", p: 0.5 }, { l: "75%", p: 0.75 }, { l: "MAX", p: 1 }].map(({ l, p }) => (
            <button key={l} onClick={() => setPercent(p)}
              className={`flex-1 text-[10px] py-1.5 rounded-lg font-bold active:scale-95 transition-all ${l === "MAX" ? "bg-sz-orange-dim text-sz-orange border border-sz-orange/20" : "bg-white/5 text-sz-text-muted border border-sz-border hover:border-sz-text-muted/30"}`}
            >{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}
