import { useState, useEffect } from "react";
import { TokenInput } from "../components/TokenInput.js";
import { TokenSelector } from "../components/TokenSelector.js";
import { ConfirmSheet } from "../components/ConfirmSheet.js";
import { TxStatus } from "../components/TxStatus.js";
import { SegmentedControl } from "../components/SegmentedControl.js";
import { TokenIcon } from "../components/Icons.js";
import { getDcaOrders, createDcaOrder, cancelDcaOrder, previewDcaCycle, waitForTx } from "../lib/api.js";
import { useTelegram } from "../hooks/useTelegram.js";
import { useTokens } from "../hooks/useTokens.js";
import type { Token } from "@starkzap-tg/shared";
import { DCA_FREQUENCIES } from "@starkzap-tg/shared";

export function DCA() {
  const { haptic } = useTelegram();
  const { getToken } = useTokens();
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

  const handleCreate = async () => {
    if (!sellToken || !buyToken) return;
    setShowConfirm(false);
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      const result = await createDcaOrder({
        sellTokenSymbol: sellToken.symbol, buyTokenSymbol: buyToken.symbol,
        totalAmount, amountPerCycle, frequency,
      });
      setTxHash(result.txHash);
      setTxStatus("pending");
      waitForTx(result.txHash, (status) => {
        setTxStatus(status);
        haptic?.notificationOccurred(status === "confirmed" ? "success" : "error");
      });
    } catch {
      setTxStatus("failed");
      haptic?.notificationOccurred("error");
    }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await cancelDcaOrder({ orderId });
      haptic?.notificationOccurred("success");
      setOrders(orders.filter((o) => o.id !== orderId));
    } catch { haptic?.notificationOccurred("error"); }
  };

  return (
    <div className="relative space-y-4">
      <div className="animate-in">
        <SegmentedControl options={["Create", "Active"]} selected={tab} onChange={setTab} />
      </div>

      {tab === "Create" ? (
        <div className="space-y-4">
          <div className="animate-in delay-1">
            <TokenInput label="Total budget" token={sellToken} value={totalAmount}
              onChange={setTotalAmount} onTokenClick={() => setSelectingFor("sell")} />
          </div>

          <div className="animate-in delay-2">
            <TokenInput label="Per cycle" token={sellToken} value={amountPerCycle}
              onChange={setAmountPerCycle} onTokenClick={() => {}} />
          </div>

          {preview && (
            <div className="animate-in delay-2 glass-card flex justify-between items-center">
              <span className="text-[10px] text-sz-text-muted font-bold">Est. per cycle</span>
              <span className="text-xs text-sz-green font-bold">~{preview} {buyToken?.symbol}</span>
            </div>
          )}

          <div className="animate-in delay-3 glass-card">
            <span className="text-[10px] font-extrabold text-sz-text-muted uppercase tracking-widest block mb-3">Buy token</span>
            <button onClick={() => setSelectingFor("buy")} className="flex items-center gap-3 bg-black/20 border border-sz-border rounded-xl px-4 py-3 w-full active:scale-[0.98] transition-transform">
              {buyToken && <TokenIcon symbol={buyToken.symbol} size={32} logoUrl={buyToken.logoUrl} />}
              <span className="font-bold text-white">{buyToken?.symbol || "Select"}</span>
              <span className="text-sz-text-muted text-[10px] flex-1 text-right">{buyToken?.name || ""}</span>
            </button>
          </div>

          <div className="animate-in delay-4 glass-card">
            <span className="text-[10px] font-extrabold text-sz-text-muted uppercase tracking-widest block mb-3">Frequency</span>
            <div className="grid grid-cols-4 gap-1.5">
              {DCA_FREQUENCIES.map((f) => (
                <button key={f.value} onClick={() => { haptic?.selectionChanged(); setFrequency(f.value); }}
                  className={`py-2.5 rounded-xl text-[10px] font-extrabold transition-all ${
                    frequency === f.value ? "bg-sz-orange text-white" : "bg-black/20 text-sz-text-muted border border-sz-border"
                  }`}
                  style={frequency === f.value ? { boxShadow: "0 0 12px rgba(250,96,5,0.2)" } : {}}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="animate-in delay-5 pt-1">
            <button onClick={() => { haptic?.impactOccurred("medium"); setShowConfirm(true); }}
              disabled={!totalAmount || !amountPerCycle || !sellToken || !buyToken} className="btn-primary">
              Create DCA Order
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-in delay-1">
          {ordersLoading ? (
            <div className="space-y-1.5">{[1,2,3].map((i) => <div key={i} className="skeleton h-[60px]" />)}</div>
          ) : orders.length === 0 ? (
            <div className="glass-card text-center py-6">
              <p className="text-xs text-sz-text-muted font-bold mb-1">No active orders</p>
              <p className="text-[10px] text-sz-text-muted">Create a DCA order to auto-invest</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {orders.map((order, i) => (
                <div key={order.id} className="glass-card animate-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-white font-bold">{order.frequency} · {order.status}</p>
                      <p className="text-[10px] text-sz-text-muted mt-1">{order.executedTrades} trades executed</p>
                    </div>
                    <button onClick={() => handleCancel(order.id)}
                      className="text-[10px] text-sz-red font-bold px-2.5 py-1 rounded-lg bg-sz-red-dim border border-sz-red/20 active:scale-95 transition-transform">
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TokenSelector isOpen={selectingFor !== null} onClose={() => setSelectingFor(null)}
        onSelect={(t) => { if (selectingFor === "sell") setSellToken(t); else setBuyToken(t); }}
        exclude={selectingFor === "sell" ? buyToken?.symbol : sellToken?.symbol} />

      {showConfirm && sellToken && buyToken && (
        <ConfirmSheet isOpen title="Confirm DCA Order" details={[
          { label: "Sell", value: `${totalAmount} ${sellToken.symbol}` },
          { label: "Per Cycle", value: `${amountPerCycle} ${sellToken.symbol}`, highlight: true },
          { label: "Buy", value: buyToken.symbol },
          { label: "Est. per cycle", value: preview ? `~${preview} ${buyToken.symbol}` : "..." },
          { label: "Frequency", value: DCA_FREQUENCIES.find((f) => f.value === frequency)?.label || frequency },
          { label: "Network Fee", value: "Gasless" },
        ]} confirmLabel="Create" onConfirm={handleCreate} onCancel={() => setShowConfirm(false)} />
      )}

      {txStatus && (
        <TxStatus status={txStatus} txHash={txHash} onDone={() => { setTxStatus(null); setTotalAmount(""); setAmountPerCycle(""); }} />
      )}
    </div>
  );
}
