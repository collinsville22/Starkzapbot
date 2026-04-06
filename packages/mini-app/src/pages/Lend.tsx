import { useState, useEffect } from "react";
import { SegmentedControl } from "../components/SegmentedControl.js";
import { TokenInput } from "../components/TokenInput.js";
import { TokenSelector } from "../components/TokenSelector.js";
import { ConfirmSheet } from "../components/ConfirmSheet.js";
import { TxStatus } from "../components/TxStatus.js";
import { HealthBar } from "../components/HealthBar.js";
import { TokenIcon } from "../components/Icons.js";
import {
  lendDeposit, lendBorrow, lendRepay, lendWithdraw, lendWithdrawMax,
  getLendingHealth, getLendingMarkets, getLendingPositions, getMaxBorrow, estimateMaxBorrow, quoteLendingHealth, waitForTx,
} from "../lib/api.js";
import { useTelegram } from "../hooks/useTelegram.js";
import { useTokens } from "../hooks/useTokens.js";
import type { Token } from "@starkzap-tg/shared";

const ACTIONS = ["Deposit", "Withdraw", "Borrow", "Repay"];

interface Market {
  protocol: string; poolAddress: string; poolName: string | null;
  asset: { name: string; symbol: string; decimals: number; logoUrl: string | null };
  canBeBorrowed: boolean; supplyApy: string | null; borrowApr: string | null;
  totalSupplied: string | null; totalBorrowed: string | null; utilization: string | null;
}

export function Lend() {
  const { haptic } = useTelegram();
  const { getToken } = useTokens();
  const [action, setAction] = useState("Deposit");
  const [token, setToken] = useState<Token | null>(null);
  const [collateralToken, setCollateralToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState("");
  const [selectingFor, setSelectingFor] = useState<"token" | "collateral" | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [txStatus, setTxStatus] = useState<"signing" | "pending" | "confirmed" | "failed" | null>(null);
  const [txHash, setTxHash] = useState<string | undefined>();

  const [health, setHealth] = useState<any>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [maxBorrow, setMaxBorrow] = useState<string | null>(null);
  const [collateralAmount, setCollateralAmount] = useState("");
  const [projectedHealth, setProjectedHealth] = useState<any>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | undefined>();

  const isBorrowAction = action === "Borrow" || action === "Repay";
  const earnPositions = positions.filter((p: any) => p.type === "earn");
  const borrowPositions = positions.filter((p: any) => p.type === "borrow");

  useEffect(() => {
    if (!token) { const usdc = getToken("USDC"); if (usdc) setToken(usdc); }
    if (!collateralToken) { const eth = getToken("ETH"); if (eth) setCollateralToken(eth); }
  }, [getToken("USDC"), getToken("ETH")]);

  useEffect(() => {
    setLoadingData(true);
    Promise.allSettled([
      getLendingMarkets().then((res) => setMarkets(res.markets || [])),
      getLendingPositions().then((res) => setPositions(res.positions || [])),
    ]).finally(() => setLoadingData(false));
  }, []);

  useEffect(() => {
    if (isBorrowAction && collateralToken && token) {
      getLendingHealth({ collateralTokenSymbol: collateralToken.symbol, debtTokenSymbol: token.symbol })
        .then(setHealth).catch(() => setHealth(null));
      if (action === "Borrow") {
        getMaxBorrow({ collateralTokenSymbol: collateralToken.symbol, debtTokenSymbol: token.symbol })
          .then((res) => setMaxBorrow(res.maxBorrow)).catch(() => setMaxBorrow(null));
      }
    }
  }, [token?.symbol, collateralToken?.symbol, action]);

  useEffect(() => {
    if (action === "Borrow" && collateralToken && token && collateralAmount && parseFloat(collateralAmount) > 0) {
      const timer = setTimeout(() => {
        estimateMaxBorrow({
          collateralTokenSymbol: collateralToken.symbol,
          debtTokenSymbol: token.symbol,
          collateralAmount,
        }).then((res) => { if (res.maxBorrow) setMaxBorrow(res.maxBorrow); })
          .catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [collateralAmount, collateralToken?.symbol, token?.symbol, action]);

  useEffect(() => {
    if (isBorrowAction && collateralToken && token && amount && parseFloat(amount) > 0) {
      const timer = setTimeout(() => {
        quoteLendingHealth({
          action: action.toLowerCase(),
          collateralTokenSymbol: collateralToken.symbol,
          debtTokenSymbol: token.symbol,
          amount,
        }).then(setProjectedHealth).catch(() => setProjectedHealth(null));
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setProjectedHealth(null);
    }
  }, [amount, token?.symbol, collateralToken?.symbol, action]);

  const handleExecute = async () => {
    if (!token) return;
    setShowConfirm(false);
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      let result: any;
      const poolAddress = selectedPool || undefined;
      if (action === "Deposit") result = await lendDeposit({ tokenSymbol: token.symbol, amount, poolAddress });
      else if (action === "Withdraw") result = await lendWithdraw({ tokenSymbol: token.symbol, amount, poolAddress });
      else if (action === "Borrow") result = await lendBorrow({ collateralTokenSymbol: collateralToken?.symbol || "", debtTokenSymbol: token.symbol, amount, collateralAmount: collateralAmount || undefined, poolAddress });
      else result = await lendRepay({ collateralTokenSymbol: collateralToken?.symbol || "", debtTokenSymbol: token.symbol, amount, poolAddress });
      setTxHash(result.txHash);
      setExplorerUrl(result.explorerUrl);
      setTxStatus("pending");
      haptic?.notificationOccurred("success");
      waitForTx(result.txHash, (s) => { setTxStatus(s); haptic?.notificationOccurred(s === "confirmed" ? "success" : "error"); });
    } catch {
      setTxStatus("failed");
      haptic?.notificationOccurred("error");
    }
  };

  const handleWithdrawMax = async (tokenSymbol: string) => {
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      const result = await lendWithdrawMax({ tokenSymbol, poolAddress: selectedPool });
      setTxHash(result.txHash);
      setTxStatus("pending");
      waitForTx(result.txHash, (s) => { setTxStatus(s); haptic?.notificationOccurred(s === "confirmed" ? "success" : "error"); });
    } catch {
      setTxStatus("failed");
      haptic?.notificationOccurred("error");
    }
  };

  const selectMarket = (m: Market) => {
    haptic?.impactOccurred("medium");
    const t = getToken(m.asset.symbol);
    if (t) setToken(t);
    setSelectedPool(m.poolAddress);
  };

  const fmtApy = (val: string | null) => {
    if (!val) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : (n * 100).toFixed(2);
  };

  return (
    <div className="relative space-y-4">
      <div className="animate-in">
        <SegmentedControl options={ACTIONS} selected={action} onChange={(a) => { setAction(a); setAmount(""); }} />
      </div>

      {isBorrowAction && (
        <div className="animate-in delay-1">
          {health ? (
            <HealthBar collateralValue={health.collateralValue} debtValue={health.debtValue} isCollateralized={health.isCollateralized} />
          ) : (
            <div className="glass-card flex justify-between">
              <span className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest">Health</span>
              <span className="text-xs text-sz-text-muted font-bold">{loadingData ? "Loading..." : "No position"}</span>
            </div>
          )}
        </div>
      )}

      {(action === "Withdraw" ? earnPositions : action === "Repay" ? borrowPositions : positions).length > 0 && (
        <div className="animate-in delay-1">
          <h3 className="text-[10px] font-extrabold text-sz-text-muted uppercase tracking-[0.2em] mb-2 px-1">
            {action === "Withdraw" ? "Your Deposits" : action === "Repay" ? "Your Debts" : "Your Positions"}
          </h3>
          <div className="space-y-1.5">
            {(action === "Withdraw" ? earnPositions : action === "Repay" ? borrowPositions : positions).map((p: any, i: number) => (
              <div key={i} className="glass-card">
                <div className="flex items-center gap-3">
                  <TokenIcon symbol={p.collateral?.token?.symbol || "?"} size={32} logoUrl={p.collateral?.token?.logoUrl} />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-sz-orange bg-sz-orange-dim rounded px-1.5 py-0.5 uppercase">{p.type}</span>
                      <span className="text-xs text-white font-bold">{p.collateral?.token?.symbol}</span>
                    </div>
                    {p.pool?.name && <div className="text-[9px] text-sz-text-muted mt-0.5">{p.pool.name}</div>}
                  </div>
                  <div className="text-right">
                    {p.collateral?.amount && (
                      <div className="text-xs text-white font-bold">{parseFloat(p.collateral.amount).toFixed(4)}</div>
                    )}
                    {p.debt && (
                      <div className="text-[10px] text-sz-red font-bold">{parseFloat(p.debt.amount).toFixed(4)} {p.debt.token?.symbol} debt</div>
                    )}
                  </div>
                </div>

                {p.type === "earn" && action === "Withdraw" && (
                  <div className="flex gap-2 mt-2 pt-2 border-t border-sz-border">
                    <button onClick={() => {
                      const t = getToken(p.collateral?.token?.symbol);
                      if (t) setToken(t);
                      setAmount(parseFloat(p.collateral?.amount || "0").toFixed(6));
                    }} className="flex-1 py-1.5 rounded-lg bg-white/5 text-[10px] text-white font-bold active:scale-95 transition-transform">
                      Withdraw Amount
                    </button>
                    <button onClick={() => handleWithdrawMax(p.collateral?.token?.symbol)}
                      className="flex-1 py-1.5 rounded-lg bg-sz-orange/10 border border-sz-orange/20 text-[10px] text-sz-orange font-bold active:scale-95 transition-transform">
                      Withdraw All + Yield
                    </button>
                  </div>
                )}

                {p.type === "borrow" && action === "Repay" && p.debt && (
                  <div className="mt-2 pt-2 border-t border-sz-border">
                    <button onClick={() => {
                      const t = getToken(p.debt?.token?.symbol);
                      if (t) setToken(t);
                      if (p.collateral?.token?.symbol) {
                        const ct = getToken(p.collateral.token.symbol);
                        if (ct) setCollateralToken(ct);
                      }
                      setAmount(parseFloat(p.debt?.amount || "0").toFixed(6));
                    }} className="w-full py-1.5 rounded-lg bg-sz-red/10 border border-sz-red/20 text-[10px] text-sz-red font-bold active:scale-95 transition-transform">
                      Repay {parseFloat(p.debt.amount).toFixed(4)} {p.debt.token?.symbol}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {action === "Withdraw" && earnPositions.length === 0 && !loadingData && (
        <div className="animate-in delay-1 glass-card text-center py-4">
          <p className="text-xs text-sz-text-muted">No deposits yet. Switch to Deposit tab to start earning yield.</p>
        </div>
      )}
      {action === "Repay" && borrowPositions.length === 0 && !loadingData && (
        <div className="animate-in delay-1 glass-card text-center py-4">
          <p className="text-xs text-sz-text-muted">No active loans. Switch to Borrow tab to take a loan.</p>
        </div>
      )}

      {isBorrowAction && (
        <div className="animate-in delay-2 glass-card flex justify-between items-center">
          <span className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest">Collateral</span>
          <button onClick={() => setSelectingFor("collateral")} className="flex items-center gap-2 active:scale-95 transition-transform">
            {collateralToken && <TokenIcon symbol={collateralToken.symbol} size={24} logoUrl={collateralToken.logoUrl} />}
            <span className="text-sm text-white font-bold">{collateralToken?.symbol || "Select"}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>
      )}

      {action === "Borrow" && collateralToken && (
        <div className="animate-in delay-2 glass-card">
          <div className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest mb-2">Collateral Amount</div>
          <div className="flex items-center gap-3">
            <TokenIcon symbol={collateralToken.symbol} size={22} logoUrl={collateralToken.logoUrl} />
            <input type="text" inputMode="decimal" placeholder="Amount to deposit as collateral"
              value={collateralAmount} onChange={(e) => setCollateralAmount(e.target.value)}
              className="flex-1 text-right text-sm font-extrabold bg-transparent text-white placeholder:text-sz-text-muted/30 min-w-0" />
          </div>
          <div className="text-[9px] text-sz-text-muted mt-1">
            Deposits {collateralToken.symbol} + borrows in 1 tx. Min ~$10 collateral value.
          </div>
        </div>
      )}

      {action === "Borrow" && maxBorrow && parseFloat(maxBorrow) > 0 && (
        <div className="animate-in glass-card flex justify-between items-center">
          <span className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest">Max Borrow</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white font-bold">{parseFloat(maxBorrow).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            <span className="text-[10px] text-sz-text-muted">{token?.symbol}</span>
            <button onClick={() => setAmount(maxBorrow)} className="text-[9px] text-sz-orange font-bold bg-sz-orange-dim rounded px-1.5 py-0.5 active:scale-95">USE</button>
          </div>
        </div>
      )}

      {projectedHealth && isBorrowAction && (
        <div className="animate-in glass-card flex justify-between items-center">
          <span className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest">After {action}</span>
          <span className={`text-xs font-bold ${projectedHealth.isCollateralized ? "text-sz-green" : "text-sz-red"}`}>
            {projectedHealth.isCollateralized ? "Safe" : "Liquidation risk!"}
          </span>
        </div>
      )}

      <div className="animate-in delay-2">
        <TokenInput label={`${action} Amount`} token={token} value={amount} onChange={setAmount} onTokenClick={() => setSelectingFor("token")} />
      </div>

      <div className="animate-in pt-1">
        <button onClick={() => { haptic?.impactOccurred("medium"); setShowConfirm(true); }}
          disabled={!amount || !token} className="btn-primary">
          {action}
        </button>
      </div>

      {(action === "Deposit" || action === "Borrow") && (
        <div className="animate-in delay-2">
          <h3 className="text-[10px] font-extrabold text-sz-text-muted uppercase tracking-[0.2em] mb-2 px-1">
            {loadingData ? "Loading..." : action === "Borrow" ? "Borrowable Markets" : `${markets.length} Vesu Markets`}
          </h3>
          {loadingData ? (
            <div className="space-y-1.5">{[1,2,3,4].map(i => <div key={i} className="skeleton h-[68px]" />)}</div>
          ) : (
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto no-scrollbar">
              {(action === "Borrow" ? markets.filter(m => m.canBeBorrowed) : markets).map((m, i) => {
                const apy = action === "Borrow" ? fmtApy(m.borrowApr) : fmtApy(m.supplyApy);
                const isSelected = token?.symbol === m.asset.symbol && selectedPool === m.poolAddress;
                return (
                  <button key={`${m.poolAddress}-${m.asset.symbol}`} onClick={() => selectMarket(m)}
                    className={`w-full glass-card flex items-center gap-3 tilt-press text-left animate-in ${isSelected ? "!border-2 !border-sz-orange/30" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 15) * 0.03}s`, ...(isSelected ? { boxShadow: "0 0 10px rgba(250,96,5,0.1)" } : {}) }}>
                    <TokenIcon symbol={m.asset.symbol} size={32} logoUrl={m.asset.logoUrl || undefined} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-white font-extrabold">{m.asset.symbol}</span>
                        {m.poolName && <span className="text-[9px] text-sz-text-muted">{m.poolName}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.totalSupplied && <span className="text-[9px] text-sz-text-muted">TVL: {m.totalSupplied}</span>}
                        {m.utilization && <span className="text-[9px] text-sz-text-muted">Util: {(parseFloat(m.utilization) * 100).toFixed(0)}%</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {apy ? (
                        <div>
                          <div className={`text-sm font-extrabold ${action === "Borrow" ? "text-sz-yellow" : "text-sz-green"}`}>{apy}%</div>
                          <div className="text-[9px] text-sz-text-muted">{action === "Borrow" ? "Borrow APR" : "Supply APY"}</div>
                        </div>
                      ) : <span className="text-[10px] text-sz-text-muted">--</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="animate-in glass-card">
        <div className="text-[9px] text-sz-text-muted leading-relaxed">
          {action === "Deposit" && "Deposit tokens to earn yield. Grows automatically via Supply APY. Withdraw anytime."}
          {action === "Withdraw" && "Withdraw deposited tokens + earned yield."}
          {action === "Borrow" && "Borrow against collateral. Min ~$10 collateral value. Monitor Health Factor."}
          {action === "Repay" && "Repay debt to improve Health Factor and avoid liquidation."}
        </div>
      </div>

      <TokenSelector isOpen={selectingFor !== null} onClose={() => setSelectingFor(null)}
        onSelect={(t) => { if (selectingFor === "collateral") setCollateralToken(t); else setToken(t); setSelectingFor(null); }} />

      {showConfirm && token && (
        <ConfirmSheet isOpen title={`Confirm ${action}`} details={[
          { label: "Action", value: action },
          { label: "Token", value: token.symbol },
          { label: "Amount", value: `${amount} ${token.symbol}`, highlight: true },
          ...(isBorrowAction && collateralToken ? [{ label: "Collateral", value: collateralToken.symbol }] : []),
          { label: "Protocol", value: "Vesu" },
          { label: "Network Fee", value: "Gasless" },
        ]} confirmLabel={action} onConfirm={handleExecute} onCancel={() => setShowConfirm(false)} />
      )}

      {txStatus && (
        <TxStatus status={txStatus} txHash={txHash} explorerUrl={explorerUrl} onDone={() => { setTxStatus(null); setAmount(""); }} />
      )}
    </div>
  );
}
