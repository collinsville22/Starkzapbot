import { useState } from "react";
import type { Token } from "@starkzap-tg/shared";
import { useTokens } from "../hooks/useTokens.js";
import { TokenIcon } from "./Icons.js";
import { useTelegram } from "../hooks/useTelegram.js";

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  exclude?: string;
}

export function TokenSelector({ isOpen, onClose, onSelect, exclude }: TokenSelectorProps) {
  const [search, setSearch] = useState("");
  const { haptic } = useTelegram();
  const { tokens } = useTokens();

  const filtered = tokens.filter(
    (t) => t.symbol !== exclude &&
      (t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 bg-sz-surface rounded-t-3xl animate-slide-up max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center py-3"><div className="w-10 h-1 rounded-full bg-sz-border" /></div>
        <div className="px-5 pb-3">
          <h2 className="text-base font-extrabold text-white tracking-tight mb-3">Select Token</h2>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-sz-card border-2 border-sz-border rounded-xl px-4 py-3 text-white text-sm placeholder:text-sz-text-muted"
            autoFocus
          />
          <p className="text-[10px] text-sz-text-muted mt-2 font-semibold">{filtered.length} tokens from StarkZap SDK</p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-8 no-scrollbar">
          {filtered.map((token, i) => (
            <button
              key={token.address}
              onClick={() => { haptic?.impactOccurred("medium"); onSelect(token); onClose(); setSearch(""); }}
              className="animate-in w-full flex items-center gap-3 py-3 rounded-xl active:bg-sz-card transition-colors"
              style={{ animationDelay: `${Math.min(i, 15) * 0.02}s` }}
            >
              <TokenIcon symbol={token.symbol} size={38} logoUrl={token.logoUrl} />
              <div className="text-left flex-1">
                <div className="text-sm text-white">{token.symbol}</div>
                <div className="text-[10px] text-sz-text-muted">{token.name}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sz-text-muted py-8 text-sm">No tokens found</p>
          )}
        </div>
      </div>
    </div>
  );
}
