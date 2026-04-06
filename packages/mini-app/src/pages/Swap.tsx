import { useState, useRef, useEffect } from "react";
import { TokenInput } from "../components/TokenInput.js";
import { TokenSelector } from "../components/TokenSelector.js";
import { ConfirmSheet } from "../components/ConfirmSheet.js";
import { TxStatus } from "../components/TxStatus.js";
import { IconFlip } from "../components/Icons.js";
import { getSwapQuote, getPortfolio, estimateSwapFee, getSwapProviders } from "../lib/api.js";
import { useTelegram } from "../hooks/useTelegram.js";
import type { Token } from "@starkzap-tg/shared";
import { useTokens } from "../hooks/useTokens.js";
import { useClientWallet } from "../hooks/useClientWallet.js";
import { Amount } from "starkzap";

export function Swap() {
  const { haptic } = useTelegram();
  const { getToken } = useTokens();
  const { getWallet } = useClientWallet();
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);
  const [amountIn, setAmountIn] = useState("");
  const [amountOut, setAmountOut] = useState("");
  const [priceImpact, setPriceImpact] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [selectingFor, setSelectingFor] = useState<"in" | "out" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [txStatus, setTxStatus] = useState<"signing" | "pending" | "confirmed" | "failed" | null>(null);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [slippage, setSlippage] = useState("100"); // basis points, 1%
  const [explorerUrl, setExplorerUrl] = useState<string | undefined>();
  const [swapProviders, setSwapProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [feeEstimate, setFeeEstimate] = useState<string | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!tokenIn) { const eth = getToken("ETH"); if (eth) setTokenIn(eth); }
    if (!tokenOut) { const usdc = getToken("USDC"); if (usdc) setTokenOut(usdc); }
  }, [getToken("ETH"), getToken("USDC")]);

  useEffect(() => {
    getSwapProviders().then((res) => {
      setSwapProviders(res.providers || ["avnu"]);
      setSelectedProvider(res.default || "avnu");
    }).catch(() => {});
    getPortfolio()
      .then((res) => {
        const bals: Record<string, string> = {};
        for (const b of res.balances) bals[b.token.symbol] = b.balance;
        setBalances(bals);
      })
      .catch(() => {});
  }, []);

  const fetchQuote = async (amount: string) => {
    if (!tokenIn?.symbol || !tokenOut?.symbol || !amount || parseFloat(amount) <= 0) return;
    setQuoteLoading(true);
    try {
      const quote = await getSwapQuote({ tokenIn: tokenIn.symbol, tokenOut: tokenOut.symbol, amountIn: amount, slippageBps: parseInt(slippage) || 100 });
      setAmountOut(quote.amountOut);
      setPriceImpact(quote.priceImpactBps);
      setProvider(quote.provider);
      estimateSwapFee({ tokenInSymbol: tokenIn.symbol, tokenOutSymbol: tokenOut.symbol, amount, slippageBps: parseInt(slippage) || 100 })
        .then((f) => { if (f.overallFee) setFeeEstimate(f.overallFee); })
        .catch(() => setFeeEstimate(null));
    } catch { setAmountOut(""); }
    finally { setQuoteLoading(false); }
  };

  const handleAmountChange = (val: string) => {
    setAmountIn(val);
    setAmountOut("");
    clearTimeout(quoteTimer.current);
    if (val && parseFloat(val) > 0) {
      quoteTimer.current = setTimeout(() => fetchQuote(val), 600);
    }
  };

  const flipTokens = () => {
    haptic?.impactOccurred("heavy");
    setFlipped(!flipped);
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    setAmountIn(amountOut);
    setAmountOut("");
  };

  const handleSwap = async () => {
    if (!tokenIn?.symbol || !tokenOut?.symbol || !amountIn) return;
    setShowConfirm(false);
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      const wallet = getWallet();
      const toSdkToken = (t: Token) => ({ name: t.name, symbol: t.symbol, decimals: t.decimals, address: t.address });
      const tx = await wallet.swap({
        tokenIn: toSdkToken(tokenIn),
        tokenOut: toSdkToken(tokenOut),
        amountIn: Amount.parse(amountIn, tokenIn.decimals, tokenIn.symbol),
        slippageBps: BigInt(parseInt(slippage) || 100),
      });
      setExplorerUrl(tx.explorerUrl);
      setTxHash(tx.hash);
      setTxStatus("pending");
      haptic?.notificationOccurred("success");
      tx.wait().then(() => {
        setTxStatus("confirmed");
        haptic?.notificationOccurred("success");
      }).catch(() => {
        setTxStatus("failed");
        haptic?.notificationOccurred("error");
      });
    } catch {
      setTxStatus("failed");
      haptic?.notificationOccurred("error");
    }
  };

  const rate = amountIn && amountOut && parseFloat(amountIn) > 0
    ? (parseFloat(amountOut) / parseFloat(amountIn)).toFixed(4) : null;
  const canSwap = amountIn && amountOut && !quoteLoading;

  return (
    <div className="relative">
      <div className="relative z-10 space-y-2">
        <div className="animate-in">
          <TokenInput label="You pay" token={tokenIn} value={amountIn} onChange={handleAmountChange}
            onTokenClick={() => setSelectingFor("in")} balance={tokenIn ? balances[tokenIn.symbol] : undefined} />
        </div>

        <div className="flex justify-center -my-1.5 relative z-10 animate-in delay-1">
          <button onClick={flipTokens}
            className="w-10 h-10 rounded-xl bg-sz-surface border-2 border-sz-border flex items-center justify-center text-sz-orange hover:bg-sz-orange hover:text-white hover:border-sz-orange active:scale-90 transition-all duration-300 shadow-lg shadow-black/30"
            style={{ transform: flipped ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), background 0.2s, color 0.2s, border-color 0.2s" }}>
            <IconFlip />
          </button>
        </div>

        <div className="animate-in delay-2 relative">
          <TokenInput label="You receive" token={tokenOut} value={quoteLoading ? "" : amountOut}
            onChange={() => {}} onTokenClick={() => setSelectingFor("out")} readOnly />
          {quoteLoading && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-sz-orange/30 border-t-sz-orange rounded-full animate-spin" />
            </div>
          )}
        </div>

        {(rate || quoteLoading) && (
          <div className="animate-in delay-3 glass-card">
            <div className="space-y-2.5">
              {rate && (
                <div className="flex justify-between text-xs">
                  <span className="text-sz-text-muted">Rate</span>
                  <span className="text-white font-bold">1 {tokenIn?.symbol} = {rate} {tokenOut?.symbol}</span>
                </div>
              )}
              {priceImpact && (
                <div className="flex justify-between text-xs">
                  <span className="text-sz-text-muted">Price Impact</span>
                  <span className={`font-bold ${parseInt(priceImpact) > 100 ? "text-sz-yellow" : "text-sz-green"}`}>
                    {(parseInt(priceImpact) / 100).toFixed(2)}%
                  </span>
                </div>
              )}
              {(provider || swapProviders.length > 1) && (
                <div className="flex justify-between text-xs">
                  <span className="text-sz-text-muted">Provider</span>
                  <div className="flex gap-1">
                    {swapProviders.length > 1 ? swapProviders.map((p) => (
                      <button key={p} onClick={() => setSelectedProvider(p)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize ${selectedProvider === p ? "bg-sz-orange text-white" : "text-sz-text-muted bg-black/20"}`}>
                        {p}
                      </button>
                    )) : (
                      <span className="text-white font-bold capitalize flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-sz-green" />{provider}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-sz-text-muted">Slippage</span>
                <div className="flex gap-1">
                  {["50", "100", "200", "500"].map((s) => (
                    <button key={s} onClick={() => setSlippage(s)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${slippage === s ? "bg-sz-orange text-white" : "text-sz-text-muted bg-black/20"}`}>
                      {(parseInt(s) / 100).toFixed(1)}%
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-sz-text-muted">Network Fee</span>
                <span className="text-sz-green font-bold">
                  {feeEstimate ? `~${(Number(feeEstimate) / 1e18).toFixed(6)} ETH (sponsored)` : "Gasless"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="animate-in delay-4 pt-3">
          <button onClick={() => { haptic?.impactOccurred("medium"); setShowConfirm(true); }}
            disabled={!canSwap} className="btn-primary">
            {quoteLoading ? "Finding best price..." : !amountIn ? "Enter an amount" : !amountOut ? "Select tokens" : "Swap"}
          </button>
        </div>
      </div>

      <TokenSelector isOpen={selectingFor !== null} onClose={() => setSelectingFor(null)}
        onSelect={(t) => { if (selectingFor === "in") setTokenIn(t); else setTokenOut(t); }}
        exclude={selectingFor === "in" ? tokenOut?.symbol : tokenIn?.symbol} />

      {showConfirm && tokenIn && tokenOut && (
        <ConfirmSheet isOpen title="Confirm Swap" details={[
          { label: "You pay", value: `${amountIn} ${tokenIn.symbol}` },
          { label: "You receive", value: `~${amountOut} ${tokenOut.symbol}`, highlight: true },
          { label: "Rate", value: rate ? `1 ${tokenIn.symbol} = ${rate} ${tokenOut.symbol}` : "..." },
          { label: "Network Fee", value: "Gasless" },
        ]} confirmLabel="Confirm Swap" onConfirm={handleSwap} onCancel={() => setShowConfirm(false)} />
      )}

      {txStatus && (
        <TxStatus status={txStatus} txHash={txHash} explorerUrl={explorerUrl} onDone={() => { setTxStatus(null); setAmountIn(""); setAmountOut(""); }} />
      )}
    </div>
  );
}
