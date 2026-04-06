import { useState, useEffect } from "react";
import { TokenInput } from "../components/TokenInput.js";
import { TokenSelector } from "../components/TokenSelector.js";
import { ConfirmSheet } from "../components/ConfirmSheet.js";
import { TxStatus } from "../components/TxStatus.js";
import { SegmentedControl } from "../components/SegmentedControl.js";
import { TokenIcon } from "../components/Icons.js";
import { getDcaOrders, previewDcaCycle } from "../lib/api.js";
import { useTelegram } from "../hooks/useTelegram.js";
import { useTokens } from "../hooks/useTokens.js";
import type { Token } from "@starkzap-tg/shared";
import { DCA_FREQUENCIES } from "@starkzap-tg/shared";
import { useClientWallet } from "../hooks/useClientWallet.js";
import { Amount } from "starkzap";

export function DCA() {
  const { haptic } = useTelegram();
  const { getToken } = useTokens();
  const { getWallet } = useClientWallet();
  const [tab, setTab] = useState("Create");
  const [sellToken, setSellToken] = useState<Token | null>(null);
  const [buyToken, setBuyToken] = useState<Token | null>(null);
  const [totalAmount, setTotalAmount] = useState("");
  const [amountPerCycle, setAmountPerCycle] = useState("");
  const [frequency, setFrequency] = useState("P1D");
  const [selectingFor, setSelectingFor] = useState<"sell" | "buy" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [txStatus, setTxStatus] = useState<"signing" | "pending" | "confirmed" | "failed" | null>(null);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [explorerUrl, setExplorerUrl] = useState<string | undefined>();
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!sellToken) { const strk = getToken("STRK"); if (strk) setSellToken(strk); }
    if (!buyToken) { const eth = getToken("ETH"); if (eth) setBuyToken(eth); }
  }, [getToken("STRK"), getToken("ETH")]);

  useEffect(() => {
    if (tab === "Active") {
      setOrdersLoading(true);
      getDcaOrders().then((res) => setOrders(res.orders || [])).catch(() => {}).finally(() => setOrdersLoading(false));
    }
  }, [tab]);

  useEffect(() => {
    if (amountPerCycle && sellToken && buyToken && parseFloat(amountPerCycle) > 0) {
      previewDcaCycle({ sellTokenSymbol: sellToken.symbol, buyTokenSymbol: buyToken.symbol, amountPerCycle })
        .then((res) => setPreview(res.amountOut))
        .catch(() => setPreview(null));
    } else {
      setPreview(null);
    }
  }, [amountPerCycle, sellToken?.symbol, buyToken?.symbol]);

  const toSdkToken = (t: Token) => ({ name: t.name, symbol: t.symbol, decimals: t.decimals, address: t.address });

  const handleCreate = async () => {
    if (!sellToken || !buyToken) return;
    setShowConfirm(false);
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      const wallet = getWallet();
      const tx = await wallet.dca().create({
        sellToken: toSdkToken(sellToken),
        buyToken: toSdkToken(buyToken),
        sellAmount: Amount.parse(totalAmount, sellToken.decimals, sellToken.symbol),
        sellAmountPerCycle: Amount.parse(amountPerCycle, sellToken.decimals, sellToken.symbol),
        frequency,
      });
      setTxHash(tx.hash);
      setExplorerUrl(tx.explorerUrl);
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

  const handleCancel = async (orderId: string) => {
    try {
      const wallet = getWallet();
      await wallet.dca().cancel({ orderId });
      haptic?.notificationOccurred("success");
      setOrders(orders.filter((o) => o.id !== orderId));
    } catch { haptic?.notificationOccurred("error"); }
  };

  const freqLabels: Record<string, string> = { P1D: "Daily", P3D: "3 Days", P1W: "Weekly", P2W: "2 Weeks" };

  return (
    <div className="relative space-y-4">
      <div className="animate-in">
        <SegmentedControl options={["Create", "Active"]} selected={tab} onChange={setTab} />
      </div>

      {tab === "Create" ? (
        <div className="space-y-4">
          <div className="animate-in delay-1">
            <TokenInput label="Total Budget" token={sellToken} value={totalAmount} onChange={setTotalAmount} onTokenClick={() => setSelectingFor("sell")} />
          </div>

          <div className="animate-in delay-2">
            <TokenInput label="Per Cycle" token={sellToken} value={amountPerCycle} onChange={setAmountPerCycle} onTokenClick={() => setSelectingFor("sell")} />
          </div>

          {preview && buyToken && (
            <div className="animate-in delay-2 glass-card flex justify-between text-xs">
              <span className="text-sz-text-muted">Est. per cycle</span>
              <span className="text-white font-bold">~{(Number(BigInt(preview)) / Math.pow(10, buyToken.decimals)).toFixed(6)} {buyToken.symbol}</span>
            </div>
          )}

          <div className="animate-in delay-2 glass-card">
            <div className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest mb-2">Buy Token</div>
            <button onClick={() => setSelectingFor("buy")} className="flex items-center gap-2 active:scale-95 transition-transform">
              {buyToken && <TokenIcon symbol={buyToken.symbol} size={28} logoUrl={buyToken.logoUrl} />}
              <span className="text-sm text-white font-bold">{buyToken?.symbol || "Select"}</span>
            </button>
          </div>

          <div className="animate-in delay-3">
            <div className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest mb-2 px-1">Frequency</div>
            <div className="grid grid-cols-4 gap-2">
              {(DCA_FREQUENCIES || ["P1D", "P3D", "P1W", "P2W"]).map((f) => (
                <button key={f} onClick={() => { haptic?.selectionChanged(); setFrequency(f); }}
                  className={`py-2.5 rounded-xl text-[10px] font-bold transition-all border ${frequency === f ? "bg-sz-orange text-white border-sz-orange shadow-lg shadow-sz-orange/25" : "text-sz-text-muted border-sz-border"}`}>
                  {freqLabels[f] || f}
                </button>
              ))}
            </div>
          </div>

          <div className="animate-in delay-4 pt-1">
            <button onClick={() => { haptic?.impactOccurred("medium"); setShowConfirm(true); }}
              disabled={!totalAmount || !amountPerCycle || !sellToken || !buyToken} className="btn-primary">
              Create DCA Order
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {ordersLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-[60px]" />)}</div>
          ) : orders.length === 0 ? (
            <div className="glass-card text-center py-6">
              <p className="text-xs text-sz-text-muted">No active DCA orders</p>
            </div>
          ) : (
            orders.map((o, i) => (
              <div key={o.id || i} className="glass-card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs text-white font-bold">{freqLabels[o.frequency] || o.frequency}</span>
                    <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${o.status === "ACTIVE" ? "bg-sz-green-dim text-sz-green" : "bg-sz-red-dim text-sz-red"}`}>{o.status}</span>
                  </div>
                  <button onClick={() => handleCancel(o.id)} className="text-[10px] text-sz-red font-bold active:scale-95">Cancel</button>
                </div>
                <div className="text-[10px] text-sz-text-muted mt-1">{o.executedTradesCount || 0} trades executed</div>
              </div>
            ))
          )}
        </div>
      )}

      <TokenSelector isOpen={selectingFor !== null} onClose={() => setSelectingFor(null)}
        onSelect={(t) => { if (selectingFor === "sell") setSellToken(t); else setBuyToken(t); setSelectingFor(null); }} />

      {showConfirm && sellToken && buyToken && (
        <ConfirmSheet isOpen title="Confirm DCA Order" details={[
          { label: "Sell", value: `${totalAmount} ${sellToken.symbol}` },
          { label: "Per Cycle", value: `${amountPerCycle} ${sellToken.symbol}`, highlight: true },
          { label: "Buy", value: buyToken.symbol },
          { label: "Frequency", value: freqLabels[frequency] || frequency },
          { label: "Fee", value: "Gasless" },
        ]} confirmLabel="Create" onConfirm={handleCreate} onCancel={() => setShowConfirm(false)} />
      )}

      {txStatus && (
        <TxStatus status={txStatus} txHash={txHash} explorerUrl={explorerUrl} onDone={() => { setTxStatus(null); setTotalAmount(""); setAmountPerCycle(""); }} />
      )}
    </div>
  );
}
