import { useState, useEffect } from "react";
import { SegmentedControl } from "../components/SegmentedControl.js";
import { TokenIcon } from "../components/Icons.js";
import { getBridgeTokens } from "../lib/api.js";
import { useTelegram } from "../hooks/useTelegram.js";
import { useWallet } from "../hooks/useWallet.js";
import { useExternalWallet } from "../hooks/useExternalWallet.js";
import { shortenAddress } from "../lib/format.js";

interface BridgeToken {
  symbol: string; name: string; decimals: number; chain: string;
  protocol: string; address: string; starknetAddress: string; logoUrl?: string;
}

export function Bridge() {
  const { haptic } = useTelegram();
  const { user } = useWallet();
  const extWallet = useExternalWallet();
  const [chain, setChain] = useState("ethereum");
  const [tokens, setTokens] = useState<BridgeToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BridgeToken | null>(null);
  const [amount, setAmount] = useState("");
  const [bridging, setBridging] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "signing" | "pending" | "done" | "error">("idle");
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    getBridgeTokens(chain).then((res) => setTokens(res.tokens)).catch(() => {}).finally(() => setLoading(false));
  }, [chain]);

  const handleConnect = async () => {
    haptic?.impactOccurred("medium");
    if (chain === "ethereum") {
      await extWallet.connectEthereum();
    }
  };

  const handleBridge = async () => {
    if (!selected || !amount || !extWallet.connected || !extWallet.provider) return;
    haptic?.notificationOccurred("warning");
    setBridging(true);
    setBridgeStatus("signing");
    setBridgeError(null);

    try {
      const { ConnectedEthereumWallet } = await import("starkzap");
      const { StarkZap, ChainId, Amount: SzAmount } = await import("starkzap");

      const sdk = new StarkZap({ network: "mainnet" });
      const bridgeTokens = await sdk.getBridgingTokens();
      const bridgeToken = bridgeTokens.find(
        (t) => t.symbol === selected.symbol && t.protocol === selected.protocol
      );

      if (!bridgeToken) throw new Error("Bridge token not found");

      const externalWallet = await ConnectedEthereumWallet.from(
        {
          chain: 0 as any,
          provider: extWallet.provider,
          address: extWallet.address!,
          chainId: extWallet.chainId!,
        },
        ChainId.MAINNET
      );

      const recipient = user?.walletAddress;
      if (!recipient) throw new Error("No Starknet wallet");

      const bridgeAmount = SzAmount.parse(amount, bridgeToken.decimals, bridgeToken.symbol);

      setBridgeStatus("pending");

      const tx = await sdk.connectWallet({ account: { signer: null as any } }).then(async (wallet) => {
        return wallet.deposit(recipient as any, bridgeAmount, bridgeToken, externalWallet);
      });

      setBridgeStatus("done");
      haptic?.notificationOccurred("success");
    } catch (err: any) {
      setBridgeError(err.message);
      setBridgeStatus("error");
      haptic?.notificationOccurred("error");
    } finally {
      setBridging(false);
    }
  };

  return (
    <div className="relative space-y-4">
      <div className="animate-in">
        <SegmentedControl options={["ethereum", "solana"]} selected={chain}
          onChange={(c) => { setChain(c); haptic?.selectionChanged(); extWallet.disconnect(); }} />
      </div>

      {/* External wallet connection status */}
      <div className="animate-in delay-1 glass-card">
        {extWallet.connected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-sz-green" style={{ boxShadow: "0 0 6px rgba(144,239,137,0.5)" }} />
              <div>
                <div className="text-xs text-white font-bold">{chain === "ethereum" ? "Ethereum" : "Solana"} Wallet</div>
                <div className="text-[9px] text-sz-text-muted font-mono">{shortenAddress(extWallet.address || "", 6)}</div>
              </div>
            </div>
            <button onClick={() => extWallet.disconnect()}
              className="text-[10px] text-sz-red font-bold active:scale-95 transition-transform">
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-sz-orange-dim flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FA6005" strokeWidth="2.5" strokeLinecap="round"><path d="M13 5H1v14h12M17 9l4 4-4 4M6 12h15"/></svg>
              </div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">
                Bridge from {chain === "ethereum" ? "Ethereum" : "Solana"}
              </h3>
            </div>
            <p className="text-[10px] text-sz-text-muted leading-relaxed mb-3">
              Connect your {chain === "ethereum" ? "Ethereum" : "Solana"} wallet to bridge tokens onto Starknet.
              Uses WalletConnect — works with MetaMask, Rainbow, Trust, and 300+ wallets.
            </p>
            <button onClick={handleConnect} disabled={extWallet.connecting} className="btn-primary text-sm">
              {extWallet.connecting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                `Connect ${chain === "ethereum" ? "Ethereum" : "Solana"} Wallet`
              )}
            </button>
            {extWallet.error && (
              <p className="text-[10px] text-sz-red mt-2">{extWallet.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Selected token detail + bridge form */}
      {selected ? (
        <div className="animate-in space-y-3">
          <button onClick={() => { setSelected(null); setAmount(""); setBridgeStatus("idle"); }}
            className="text-[10px] text-sz-orange font-bold">Back to tokens</button>

          <div className="glass-card flex items-center gap-3">
            <TokenIcon symbol={selected.symbol} size={40} logoUrl={selected.logoUrl} />
            <div>
              <div className="text-base text-white font-extrabold">{selected.symbol}</div>
              <div className="text-[10px] text-sz-text-muted">{selected.name} · {selected.protocol}</div>
            </div>
          </div>

          {/* Bridge details */}
          <div className="glass-card space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-sz-text-muted">From</span>
              <span className="text-white font-bold capitalize">{chain}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-sz-text-muted">To</span>
              <span className="text-white font-bold">Starknet</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-sz-text-muted">Protocol</span>
              <span className="text-white font-bold">{selected.protocol}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-sz-text-muted">Destination</span>
              <span className="text-white font-bold font-mono text-[10px]">
                {user?.walletAddress ? shortenAddress(user.walletAddress, 5) : "..."}
              </span>
            </div>
            {extWallet.connected && (
              <div className="flex justify-between text-xs">
                <span className="text-sz-text-muted">Source Wallet</span>
                <span className="text-white font-bold font-mono text-[10px]">{shortenAddress(extWallet.address || "", 5)}</span>
              </div>
            )}
          </div>

          {/* Amount input */}
          {extWallet.connected && (
            <>
              <div className="glass-card">
                <div className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest mb-2">Bridge Amount</div>
                <div className="flex items-center gap-3">
                  <TokenIcon symbol={selected.symbol} size={26} logoUrl={selected.logoUrl} />
                  <input type="text" inputMode="decimal" placeholder="0.00" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 text-right text-xl font-extrabold bg-transparent text-white placeholder:text-sz-text-muted/30 min-w-0" />
                </div>
              </div>

              {/* Bridge status */}
              {bridgeStatus === "signing" && (
                <div className="glass-card flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-sz-orange/30 border-t-sz-orange rounded-full animate-spin" />
                  <span className="text-xs text-sz-orange font-bold">Waiting for wallet approval...</span>
                </div>
              )}
              {bridgeStatus === "pending" && (
                <div className="glass-card flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-sz-green/30 border-t-sz-green rounded-full animate-spin" />
                  <span className="text-xs text-sz-green font-bold">Bridge transaction submitted</span>
                </div>
              )}
              {bridgeStatus === "done" && (
                <div className="glass-card flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-sz-green" />
                  <span className="text-xs text-sz-green font-bold">Bridge complete! Tokens arriving on Starknet.</span>
                </div>
              )}
              {bridgeStatus === "error" && (
                <div className="glass-card">
                  <span className="text-xs text-sz-red font-bold">{bridgeError || "Bridge failed"}</span>
                </div>
              )}

              <button onClick={handleBridge} disabled={!amount || bridging || bridgeStatus === "done"}
                className="btn-primary text-sm">
                {bridging ? "Bridging..." : bridgeStatus === "done" ? "Done" : `Bridge ${selected.symbol}`}
              </button>
            </>
          )}

          {!extWallet.connected && (
            <div className="glass-card" style={{ borderColor: "rgba(250,96,5,0.15)" }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="dot-blink" />
                <span className="text-xs text-sz-orange font-bold">Connect wallet first</span>
              </div>
              <p className="text-[10px] text-sz-text-muted">
                Connect your {chain === "ethereum" ? "Ethereum" : "Solana"} wallet above to bridge {selected.symbol}.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Token list */
        <div className="animate-in delay-2">
          <h3 className="text-[10px] font-extrabold text-sz-text-muted uppercase tracking-[0.2em] mb-2 px-1">
            {loading ? "Loading..." : `${tokens.length} Bridgeable Tokens`}
          </h3>
          {loading ? (
            <div className="space-y-1.5">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-[55px]" />)}</div>
          ) : tokens.length === 0 ? (
            <div className="glass-card text-center py-4">
              <p className="text-xs text-sz-text-muted">No bridgeable tokens for {chain}</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto no-scrollbar">
              {tokens.map((t, i) => (
                <button key={`${t.symbol}-${t.protocol}-${i}`} onClick={() => { haptic?.impactOccurred("medium"); setSelected(t); setBridgeStatus("idle"); }}
                  className="w-full glass-card flex items-center gap-3 tilt-press text-left animate-in"
                  style={{ animationDelay: `${Math.min(i, 20) * 0.03}s` }}>
                  <TokenIcon symbol={t.symbol} size={32} logoUrl={t.logoUrl || undefined} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-extrabold">{t.symbol}</div>
                    <div className="text-[9px] text-sz-text-muted truncate">{t.name}</div>
                  </div>
                  <span className="text-[9px] text-sz-text-muted font-bold px-2 py-1 rounded-lg bg-black/20 border border-sz-border shrink-0">
                    {t.protocol}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
