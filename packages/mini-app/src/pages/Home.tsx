import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet.js";
import { getPortfolio, getDeployStatus } from "../lib/api.js";
import { useClientWallet } from "../hooks/useClientWallet.js";
import { AssetRow } from "../components/AssetRow.js";
import { IconSend, IconSwap, IconReceive, IconCopy } from "../components/Icons.js";
import { shortenAddress } from "../lib/format.js";
import { useTelegram } from "../hooks/useTelegram.js";
import type { TokenBalance } from "@starkzap-tg/shared";

export function Home() {
  const { user } = useWallet();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { getWallet } = useClientWallet();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [realAddress, setRealAddress] = useState<string | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [deployed, setDeployed] = useState<boolean | null>(null);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    getPortfolio()
      .then((res) => {
        setBalances(res.balances);
        if (res.walletAddress) setRealAddress(res.walletAddress);
        if (res.totalUsd !== undefined) setTotalUsd(res.totalUsd);
      }),
      getDeployStatus().then((res) => setDeployed(res.deployed)).catch(() => {}
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const displayAddress = realAddress || user?.walletAddress;
  const copyAddress = () => {
    if (displayAddress) {
      navigator.clipboard?.writeText(displayAddress);
      haptic?.notificationOccurred("success");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const nonZeroCount = balances.filter((b) => parseFloat(b.balance || "0") > 0).length;

  return (
    <div className="relative">
      {/* Wallet address pill */}
      <div className="flex justify-center mb-4 animate-in">
        {displayAddress ? (
          <button onClick={copyAddress} onDoubleClick={() => displayAddress && window.open(`https://starkscan.co/contract/${displayAddress}`, "_blank")}
            className="flex items-center gap-2 bg-sz-card rounded-full px-4 py-2 border-2 border-sz-border active:scale-95 transition-transform">
            <div className="w-2 h-2 rounded-full bg-sz-green" style={{ boxShadow: "0 0 6px rgba(144,239,137,0.5)" }} />
            <span className="text-xs text-sz-text-muted font-semibold">{copied ? "Copied!" : shortenAddress(displayAddress, 5)}</span>
            <IconCopy />
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-sz-card rounded-full px-4 py-2 border-2 border-sz-border">
            <div className="dot-blink" />
            <span className="text-xs text-sz-text-muted font-semibold">{loading ? "Creating wallet..." : "Not connected"}</span>
          </div>
        )}
      </div>

      {/* Account deploy status */}
      {deployed === false && nonZeroCount > 0 && (
        <div className="animate-in glass-card mb-3" style={{ borderColor: "rgba(250,96,5,0.2)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-sz-orange font-bold">Account not deployed</div>
              <div className="text-[9px] text-sz-text-muted">Deploy to enable transactions</div>
            </div>
            <button onClick={async () => {
              setDeploying(true);
              try {
                const wallet = getWallet();
                await wallet.ensureReady({ deploy: "if_needed" });
                setDeployed(true);
                haptic?.notificationOccurred("success");
              } catch (e: any) {
                setError(e.message || "Deploy failed");
                haptic?.notificationOccurred("error");
              } finally { setDeploying(false); }
            }}
              disabled={deploying} className="text-[10px] text-white font-bold bg-sz-orange rounded-lg px-3 py-1.5 active:scale-95 transition-transform shrink-0">
              {deploying ? (
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Deploying
                </span>
              ) : "Deploy"}
            </button>
          </div>
          {deploying && (
            <div className="text-[9px] text-sz-text-muted mt-2">
              Deploying your account on Starknet... This uses a small STRK fee.
            </div>
          )}
        </div>
      )}

      {/* Hero balance — total USD from AVNU prices */}
      <div className="text-center mb-5 animate-in delay-1">
        {loading ? (
          <div className="skeleton w-40 h-14 mx-auto rounded-xl" />
        ) : error ? (
          <div>
            <p className="text-xl font-extrabold text-sz-red">Offline</p>
            <p className="text-[10px] text-sz-text-muted mt-1">{error}</p>
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-extrabold text-white tracking-tighter leading-none">
              {totalUsd > 0 ? (
                <>${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
              ) : nonZeroCount > 0 ? (
                <span className="text-sz-text-secondary">${totalUsd.toFixed(2)}</span>
              ) : (
                <span className="font-serif italic text-sz-text-muted">$0.00</span>
              )}
            </h1>
            <p className="text-[10px] text-sz-text-muted mt-2 font-semibold uppercase tracking-[0.2em]">
              {nonZeroCount > 0 ? `${nonZeroCount} asset${nonZeroCount > 1 ? "s" : ""} · Portfolio` : "Your Portfolio"}
            </p>
          </>
        )}
      </div>

      {/* Quick action row — Hamster Kombat card style */}
      <div className="flex gap-2 mb-5 animate-in delay-2">
        {[
          { label: "Send", icon: <IconSend />, action: () => navigate("/send") },
          { label: "Swap", icon: <IconSwap />, action: () => navigate("/trade") },
          { label: "Receive", icon: <IconReceive />, action: () => setShowReceive(true) },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => { haptic?.impactOccurred("medium"); item.action(); }}
            className="flex-1 glass-card tilt-press flex flex-col items-center gap-2 py-4 relative"
          >
            <div className="dot-blink absolute top-2 right-2" style={{ display: item.label === "Receive" && !nonZeroCount ? "block" : "none" }} />
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-sz-orange" style={{ background: "radial-gradient(circle, rgba(250,96,5,0.2), rgba(250,96,5,0.05))" }}>
              {item.icon}
            </div>
            <span className="text-[10px] text-sz-text-muted font-semibold">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Fund wallet CTA (empty state) */}
      {!loading && !error && nonZeroCount === 0 && (
        <div className="glass-card mb-4 animate-in delay-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[100px] h-[100px] rounded-full" style={{ background: "radial-gradient(circle, rgba(250,96,5,0.12), transparent 70%)" }} />
          <h3 className="text-sm font-extrabold text-white tracking-tight mb-1 relative z-10">Get started</h3>
          <p className="text-[10px] text-sz-text-muted leading-relaxed relative z-10 mb-3">
            Send ETH, STRK, or USDC to your wallet to start trading, staking, and earning.
          </p>
          <button
            onClick={() => { haptic?.impactOccurred("light"); setShowReceive(true); }}
            className="relative z-10 text-[10px] font-extrabold text-sz-orange bg-sz-orange-dim rounded-lg px-3 py-1.5 active:scale-95 transition-transform"
          >
            Show address
          </button>
        </div>
      )}

      {/* Assets list */}
      <div className="animate-in delay-3">
        <div className="flex justify-between items-center mb-2 px-1">
          <h2 className="text-[10px] font-extrabold text-sz-text-muted uppercase tracking-[0.2em]">Assets</h2>
          <span className="text-[10px] text-sz-text-muted font-semibold">{balances.length} tokens</span>
        </div>

        {loading ? (
          <div className="space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-[58px]" />)}</div>
        ) : (
          balances.map((b, i) => <AssetRow key={b.token.symbol} balance={b} delay={i} />)
        )}
      </div>

      {/* Receive bottom sheet */}
      {showReceive && (
        <div className="fixed inset-0 z-[60] bg-black/80" onClick={() => setShowReceive(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-sz-surface rounded-t-3xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center py-3"><div className="w-10 h-1 rounded-full bg-sz-border" /></div>
            <div className="px-6 pb-10 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "radial-gradient(circle, rgba(144,239,137,0.15), rgba(144,239,137,0.03))" }}>
                <IconReceive />
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight mb-1">Receive Tokens</h3>
              <p className="text-xs text-sz-text-muted mb-5">Send any Starknet token to this address</p>

              <div className="glass-card text-left mb-5">
                <p className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-[0.2em] mb-2">Starknet Address</p>
                {displayAddress ? (
                  <p className="text-[12px] text-white font-mono break-all leading-relaxed">{displayAddress}</p>
                ) : (
                  <p className="text-xs text-sz-text-muted">Generating...</p>
                )}
              </div>

              <button onClick={copyAddress} disabled={!displayAddress} className="btn-primary flex items-center justify-center gap-2">
                <IconCopy />
                {copied ? "Copied!" : "Copy Address"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
