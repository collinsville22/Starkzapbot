export function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#FA6005" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V13h6v8" />
    </svg>
  );
}

export function IconTrade({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#FA6005" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10l5-6 5 6" />
      <path d="M7 14l5 6 5-6" />
    </svg>
  );
}

export function IconEarn({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#FA6005" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function IconActivity({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#FA6005" : "rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function IconSend() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

export function IconReceive() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  );
}

export function IconSwap() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export function IconFlip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

export function IconChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconCheck() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-5" />
    </svg>
  );
}

export function IconX() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

export function IconLoader() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#FA6005" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IconCopy() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

import { useState as useIconState } from "react";

const FALLBACK_COLORS: Record<string, string> = {
  ETH: "from-[#627eea] to-[#3b4874]",
  STRK: "from-[#8b5cf6] to-[#5b21b6]",
  USDC: "from-[#2775ca] to-[#1a4d8c]",
  USDT: "from-[#26a17b] to-[#166d54]",
  WBTC: "from-[#f7931a] to-[#b36a0f]",
  DAI: "from-[#f5ac37] to-[#c48a20]",
  SOL: "from-[#9945ff] to-[#14f195]",
  AAVE: "from-[#2ebac6] to-[#b6509e]",
  UNI: "from-[#ff007a] to-[#a8005a]",
};

export function TokenIcon({ symbol, size = 40, logoUrl }: { symbol: string; size?: number; logoUrl?: string }) {
  const [imgError, setImgError] = useIconState(false);
  const fontSize = size < 32 ? 9 : size < 40 ? 11 : 13;
  const gradient = FALLBACK_COLORS[symbol] || "from-[#FA6005]/30 to-[#FA6005]/10";

  if (logoUrl && !imgError) {
    return (
      <div className="shrink-0 rounded-xl overflow-hidden bg-black/30" style={{ width: size, height: size }}>
        <img
          src={logoUrl}
          alt={symbol}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-br ${gradient} text-white rounded-xl flex items-center justify-center font-extrabold shrink-0 shadow-lg`}
      style={{ width: size, height: size, fontSize, letterSpacing: "-0.02em" }}
    >
      {symbol.length <= 4 ? symbol : symbol.slice(0, 3)}
    </div>
  );
}
