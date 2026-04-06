import { useState, useEffect } from "react";
import { TokenInput } from "../components/TokenInput.js";
import { TokenSelector } from "../components/TokenSelector.js";
import { ConfirmSheet } from "../components/ConfirmSheet.js";
import { TxStatus } from "../components/TxStatus.js";
import { IconShield } from "../components/Icons.js";
import { getConfidentialInfo, getConfidentialBalance, getMyTongoId } from "../lib/api.js";
import { useTelegram } from "../hooks/useTelegram.js";
import type { Token } from "@starkzap-tg/shared";
import { useTokens } from "../hooks/useTokens.js";
import { useClientWallet } from "../hooks/useClientWallet.js";
import { Amount } from "starkzap";

type Mode = "normal" | "batch" | "confidential" | "sign";

export function Send() {
  const { haptic } = useTelegram();
  const { getToken } = useTokens();
  const { getWallet } = useClientWallet();
  const [mode, setMode] = useState<Mode>("normal");
  const [token, setToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [selectingToken, setSelectingToken] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [txStatus, setTxStatus] = useState<"signing" | "pending" | "confirmed" | "failed" | null>(null);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [explorerUrl, setExplorerUrl] = useState<string | undefined>();

  const [batchRecipients, setBatchRecipients] = useState<Array<{ to: string; amount: string }>>([{ to: "", amount: "" }]);

  const [messageToSign, setMessageToSign] = useState("");
  const [signature, setSignature] = useState<string[] | null>(null);

  const [confInfo, setConfInfo] = useState<any>(null);
  const [confAction, setConfAction] = useState<"fund" | "transfer" | "withdraw">("fund");
  const [confBalance, setConfBalance] = useState<string | null>(null);
  const [confRecipient, setConfRecipient] = useState("");
  const [myTongoId, setMyTongoId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { const eth = getToken("ETH"); if (eth) setToken(eth); }
  }, [getToken("ETH")]);

  useEffect(() => {
    if (mode === "confidential") {
      if (!confInfo) getConfidentialInfo().then(setConfInfo).catch(() => {});
      if (!myTongoId) getMyTongoId().then((r) => setMyTongoId(r.tongoAddress)).catch(() => {});
      if (token) getConfidentialBalance(token.symbol).then((r) => setConfBalance(r.balance || "0")).catch(() => setConfBalance(null));
    }
  }, [mode, token?.symbol]);

  const handleSend = async () => {
    if (!token) return;
    setShowConfirm(false);
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      const wallet = getWallet();
      const sdkToken = { name: token.name, symbol: token.symbol, decimals: token.decimals, address: token.address };
      let tx: any;
      if (mode === "confidential") {
        const parsedAmount = Amount.parse(amount, token.decimals, token.symbol);
        if (confAction === "fund") {
          tx = await wallet.tx().confidentialFund({ token: sdkToken, amount: parsedAmount }).send();
        } else if (confAction === "transfer") {
          tx = await wallet.tx().confidentialTransfer({ token: sdkToken, amount: parsedAmount, recipientAddress: confRecipient }).send();
        } else {
          tx = await wallet.tx().confidentialWithdraw({ token: sdkToken, amount: parsedAmount }).send();
        }
      } else if (mode === "batch") {
        const valid = batchRecipients.filter((r) => r.to && r.amount);
        if (valid.length === 0) { setTxStatus("failed"); return; }
        const transfers = valid.map((r) => ({ to: r.to, amount: Amount.parse(r.amount, token.decimals, token.symbol) }));
        tx = await wallet.transfer(sdkToken, transfers);
      } else {
        tx = await wallet.transfer(sdkToken, [{ to: recipient, amount: Amount.parse(amount, token.decimals, token.symbol) }]);
      }
      setTxHash(tx?.hash);
      setExplorerUrl(tx?.explorerUrl);
      setTxStatus("pending");
      haptic?.notificationOccurred("success");
      if (tx?.wait) {
        tx.wait().then(() => {
          setTxStatus("confirmed");
          haptic?.notificationOccurred("success");
        }).catch(() => {
          setTxStatus("failed");
          haptic?.notificationOccurred("error");
        });
      }
    } catch {
      setTxStatus("failed");
      haptic?.notificationOccurred("error");
    }
  };

  const handleSign = async () => {
    if (!messageToSign) return;
    setTxStatus("signing");
    try {
      const wallet = getWallet();
      const typedData = {
        types: { StarkNetDomain: [{ name: "name", type: "felt" }], Message: [{ name: "message", type: "felt" }] },
        primaryType: "Message",
        domain: { name: "StarkZap" },
        message: { message: messageToSign },
      };
      const result = await wallet.signMessage(typedData);
      setSignature(Array.isArray(result) ? result : [result]);
      setTxStatus("confirmed");
      haptic?.notificationOccurred("success");
    } catch {
      setTxStatus("failed");
    }
  };

  const addBatchRow = () => setBatchRecipients([...batchRecipients, { to: "", amount: "" }]);
  const updateBatchRow = (i: number, field: "to" | "amount", val: string) => {
    const rows = [...batchRecipients];
    rows[i] = { ...rows[i], [field]: val };
    setBatchRecipients(rows);
  };
  const removeBatchRow = (i: number) => setBatchRecipients(batchRecipients.filter((_, idx) => idx !== i));

  return (
    <div className="relative space-y-4">
      <h1 className="text-xl font-extrabold text-white tracking-tight text-center animate-in">Send</h1>

      {/* Mode toggle */}
      <div className="animate-in delay-1 flex bg-sz-card rounded-xl p-1 gap-0.5 border-2 border-sz-border">
        {([["normal", "Send"], ["batch", "Batch"], ["confidential", "Private"]] as const).map(([m, label]) => (
          <button key={m} onClick={() => { haptic?.selectionChanged(); setMode(m as Mode); }}
            className={`flex-1 py-2 px-1 rounded-lg text-[10px] font-extrabold transition-all truncate ${
              mode === m
                ? m === "confidential" ? "bg-purple-600 text-white" : "bg-sz-orange text-white"
                : "text-sz-text-muted"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Confidential — Tongo Protocol (LIVE) */}
      {mode === "confidential" && (
        <div className="animate-in delay-2 space-y-3">
          <div className="glass-card" style={{ borderColor: "rgba(147,51,234,0.2)" }}>
            <div className="flex items-center gap-2 mb-1">
              <IconShield />
              <span className="text-xs text-purple-300 font-bold">Tongo Protocol</span>
              <span className="text-[9px] text-sz-green font-bold bg-sz-green/10 rounded px-1.5 py-0.5">Live</span>
            </div>
            <p className="text-[10px] text-sz-text-muted">ZK-powered private transfers. Amounts hidden on-chain.</p>
            {confBalance !== null && (
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-sz-text-muted">Private Balance</span>
                <span className="text-purple-300 font-bold">{confBalance} {token?.symbol}</span>
              </div>
            )}
          </div>

          {/* Fund / Transfer / Withdraw selector */}
          <div className="flex bg-purple-900/20 rounded-xl p-1 gap-0.5 border border-purple-500/20">
            {(["fund", "transfer", "withdraw"] as const).map((a) => (
              <button key={a} onClick={() => setConfAction(a)}
                className={`flex-1 py-2 rounded-lg text-[10px] font-extrabold capitalize ${confAction === a ? "bg-purple-600 text-white" : "text-sz-text-muted"}`}>
                {a}
              </button>
            ))}
          </div>

          {/* Your Tongo ID — share with others so they can send you private transfers */}
          {myTongoId && (
            <div className="glass-card flex items-center justify-between" style={{ borderColor: "rgba(147,51,234,0.15)" }}>
              <div>
                <div className="text-[9px] text-sz-text-muted font-extrabold uppercase tracking-widest">Your Private ID</div>
                <div className="text-[10px] text-purple-300 font-mono mt-0.5">{myTongoId.slice(0, 12)}...{myTongoId.slice(-8)}</div>
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(myTongoId); haptic?.notificationOccurred("success"); }}
                className="text-[9px] text-purple-400 font-bold bg-purple-500/10 rounded-lg px-2 py-1">Copy</button>
            </div>
          )}

          {/* Transfer recipient — just enter their Starknet address */}
          {confAction === "transfer" && (
            <div>
              <label className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-[0.15em] mb-2 block px-1">Recipient Address</label>
              <input type="text" placeholder="0x... (StarkZap user address)" value={confRecipient} onChange={(e) => setConfRecipient(e.target.value)}
                className="w-full glass-card text-white text-sm placeholder:text-sz-text-muted/40 font-mono" />
              <p className="text-[9px] text-sz-text-muted mt-1 px-1">Enter their Starknet wallet address. We auto-resolve their private key.</p>
            </div>
          )}

          <TokenInput label={confAction === "fund" ? "Deposit Amount" : confAction === "withdraw" ? "Withdraw Amount" : "Transfer Amount"}
            token={token} value={amount} onChange={setAmount} onTokenClick={() => setSelectingToken(true)} />

          <div className="text-[9px] text-sz-text-muted px-1">
            {confAction === "fund" && "Deposit public tokens into your private Tongo balance."}
            {confAction === "transfer" && "Send tokens privately — amounts hidden by ZK proofs."}
            {confAction === "withdraw" && "Convert private balance back to public tokens."}
            {" "}Supported: {confInfo?.supportedTokens?.join(", ") || "STRK, ETH, WBTC, USDC, USDT, DAI"}
          </div>

          <button onClick={() => { haptic?.impactOccurred("medium"); setShowConfirm(true); }}
            disabled={!amount || !token || (confAction === "transfer" && !confRecipient)} className="btn-primary"
            style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)" }}>
            {confAction === "fund" ? "Fund Private Balance" : confAction === "withdraw" ? "Withdraw to Public" : "Send Privately"}
          </button>
        </div>
      )}

      {/* Sign message mode */}
      {mode === "sign" ? (
        <div className="space-y-3">
          <div className="animate-in delay-2">
            <label className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-[0.15em] mb-2 block px-1">Message to Sign</label>
            <textarea placeholder="Enter message..." value={messageToSign} onChange={(e) => setMessageToSign(e.target.value)}
              className="w-full glass-card text-white text-sm placeholder:text-sz-text-muted/40 min-h-[80px] resize-none" />
          </div>
          <button onClick={handleSign} disabled={!messageToSign} className="btn-primary">Sign Message</button>
          {signature && (
            <div className="glass-card animate-in">
              <div className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest mb-1">Signature</div>
              <div className="text-[9px] text-white font-mono break-all leading-relaxed">{signature.join(", ")}</div>
              <button onClick={() => { navigator.clipboard?.writeText(signature.join(",")); haptic?.notificationOccurred("success"); }}
                className="mt-2 text-[10px] text-sz-orange font-bold">Copy</button>
            </div>
          )}
        </div>
      ) : mode === "batch" ? (
        /* Batch transfer mode */
        <div className="space-y-3">
          <div className="animate-in delay-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-[0.15em]">Recipients ({batchRecipients.length})</label>
              <button onClick={addBatchRow} className="text-[10px] text-sz-orange font-bold">+ Add</button>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
              {batchRecipients.map((r, i) => (
                <div key={i} className="glass-card flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <input type="text" placeholder="0x..." value={r.to} onChange={(e) => updateBatchRow(i, "to", e.target.value)}
                      className="w-full text-[10px] bg-transparent text-white placeholder:text-sz-text-muted/40 font-mono" />
                    <input type="text" inputMode="decimal" placeholder="Amount" value={r.amount} onChange={(e) => updateBatchRow(i, "amount", e.target.value)}
                      className="w-full text-xs bg-transparent text-white placeholder:text-sz-text-muted/40 font-bold" />
                  </div>
                  {batchRecipients.length > 1 && (
                    <button onClick={() => removeBatchRow(i)} className="text-sz-red text-[10px] font-bold shrink-0">X</button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="animate-in delay-3">
            <TokenInput label="Token" token={token} value="" onChange={() => {}} onTokenClick={() => setSelectingToken(true)} />
          </div>
          <button onClick={() => { haptic?.impactOccurred("medium"); setShowConfirm(true); }}
            disabled={!token || batchRecipients.every((r) => !r.to || !r.amount)} className="btn-primary">
            Send to {batchRecipients.filter((r) => r.to && r.amount).length} recipients
          </button>
        </div>
      ) : mode === "normal" ? (
        /* Normal send */
        <>
          <div className="animate-in delay-2">
            <label className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-[0.15em] mb-2 block px-1">
              Recipient Address
            </label>
            <input type="text" placeholder="0x..."
              value={recipient} onChange={(e) => setRecipient(e.target.value)}
              className="w-full glass-card text-white text-sm placeholder:text-sz-text-muted/40" />
          </div>
          <div className="animate-in delay-3">
            <TokenInput label="Amount" token={token} value={amount} onChange={setAmount} onTokenClick={() => setSelectingToken(true)} />
          </div>
          <div className="animate-in delay-4 pt-2">
            <button onClick={() => { haptic?.impactOccurred("medium"); setShowConfirm(true); }}
              disabled={!amount || !recipient || !token} className="btn-primary">
              Send
            </button>
          </div>
        </>
      ) : null}

      <TokenSelector isOpen={selectingToken} onClose={() => setSelectingToken(false)} onSelect={setToken} />

      {showConfirm && token && (
        <ConfirmSheet isOpen title={mode === "batch" ? "Confirm Batch Send" : mode === "confidential" ? "Confirm Private Send" : "Confirm Send"}
          details={mode === "batch" ? [
            { label: "Token", value: token.symbol },
            { label: "Recipients", value: `${batchRecipients.filter((r) => r.to && r.amount).length}` },
            { label: "Total", value: `${batchRecipients.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0).toFixed(4)} ${token.symbol}`, highlight: true },
            { label: "Mode", value: "Batch (1 transaction)" },
            { label: "Network Fee", value: "Gasless" },
          ] : [
            { label: "To", value: `${recipient.slice(0, 8)}...${recipient.slice(-6)}` },
            { label: "Amount", value: `${amount} ${token.symbol}`, highlight: true },
            { label: "Mode", value: mode === "confidential" ? "Confidential (ZK)" : "Normal" },
            { label: "Network Fee", value: "Gasless" },
          ]}
          confirmLabel="Send" onConfirm={handleSend} onCancel={() => setShowConfirm(false)} />
      )}

      {txStatus && mode !== "sign" && (
        <TxStatus status={txStatus} txHash={txHash} explorerUrl={explorerUrl}
          onDone={() => { setTxStatus(null); setAmount(""); setRecipient(""); setBatchRecipients([{ to: "", amount: "" }]); }} />
      )}
    </div>
  );
}
