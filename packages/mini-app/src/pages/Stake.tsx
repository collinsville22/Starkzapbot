import { useState, useEffect } from "react";
import { TokenInput } from "../components/TokenInput.js";
import { ConfirmSheet } from "../components/ConfirmSheet.js";
import { TxStatus } from "../components/TxStatus.js";
import { TokenIcon } from "../components/Icons.js";
import { getStakingTokens, getValidatorsQuick, getStakerPools, getStakingApy, getStakingPosition, getPortfolio } from "../lib/api.js";
import { useTelegram } from "../hooks/useTelegram.js";
import { useTokens } from "../hooks/useTokens.js";
import { shortenAddress } from "../lib/format.js";
import type { Token } from "@starkzap-tg/shared";
import { useClientWallet } from "../hooks/useClientWallet.js";
import { Amount } from "starkzap";

interface ValidatorInfo {
  name: string;
  stakerAddress: string;
  logoUrl: string | null;
}

interface PoolInfo {
  address: string;
  token: { name: string; symbol: string };
  amount: string;
  commission: number;
}

export function Stake() {
  const { haptic } = useTelegram();
  const { getToken } = useTokens();
  const { getWallet } = useClientWallet();
  const [amount, setAmount] = useState("");
  const [selectedPool, setSelectedPool] = useState<PoolInfo | null>(null);
  const [selectedValidator, setSelectedValidator] = useState<ValidatorInfo | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [txStatus, setTxStatus] = useState<"signing" | "pending" | "confirmed" | "failed" | null>(null);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [validators, setValidators] = useState<ValidatorInfo[]>([]);
  const [stakeableTokens, setStakeableTokens] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [search, setSearch] = useState("");
  const [strkApy, setStrkApy] = useState<number>(0);
  const [totalStaked, setTotalStaked] = useState<number>(0);
  const [btcStrkPerYear, setBtcStrkPerYear] = useState<number>(0);
  const [alpha, setAlpha] = useState<number>(0);

  const [validatorPools, setValidatorPools] = useState<PoolInfo[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(false);

  const [myPosition, setMyPosition] = useState<any>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | undefined>();

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      getValidatorsQuick().then((res) => setValidators(res.validators || [])),
      getStakingApy().then((res: any) => {
        setStrkApy(res.strkApy || res.strkApy || 0);
        setTotalStaked(res.totalStaked || 0);
        setBtcStrkPerYear(res.btcStrkPerYear || 0);
        setAlpha(res.alpha || 0);
      }).catch(() => {}),
      getStakingTokens().then((res) => {
        setStakeableTokens(res.tokens || []);
        if (res.tokens?.length > 0) {
          const t = getToken(res.tokens[0].symbol);
          if (t) setSelectedToken(t);
        }
      }),
      getPortfolio().then((res) => {
        const bals: Record<string, string> = {};
        for (const b of res.balances) bals[b.token.symbol] = b.balance;
        setBalances(bals);
      }),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedToken && !loading) {
      const strk = getToken("STRK");
      if (strk) setSelectedToken(strk);
    }
  }, [loading, getToken("STRK")]);

  const selectValidator = async (v: ValidatorInfo) => {
    haptic?.impactOccurred("medium");
    setSelectedValidator(v);
    setSelectedPool(null);
    setValidatorPools([]);
    setPoolsLoading(true);
    try {
      const res = await getStakerPools(v.stakerAddress);
      setValidatorPools(res.pools || []);
      const match = (res.pools || []).find((p: PoolInfo) => p.token.symbol === selectedToken?.symbol);
      if (match) {
        setSelectedPool(match);
        getStakingPosition(match.address).then((r) => setMyPosition(r.position || null)).catch(() => setMyPosition(null));
      } else if (res.pools?.length > 0) {
        setSelectedPool(res.pools[0]);
        getStakingPosition(res.pools[0].address).then((r) => setMyPosition(r.position || null)).catch(() => setMyPosition(null));
      }
    } catch {
      setValidatorPools([]);
    } finally {
      setPoolsLoading(false);
    }
  };

  const handleStake = async () => {
    if (!amount || !selectedPool || !selectedToken) return;
    setShowConfirm(false);
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      const wallet = getWallet();
      const tx = await wallet.stake(selectedPool.address, Amount.parse(amount, selectedToken.decimals, selectedToken.symbol));
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

  const handleClaimRewards = async () => {
    if (!selectedPool) return;
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      const wallet = getWallet();
      const tx = await wallet.claimPoolRewards(selectedPool.address);
      setTxHash(tx.hash);
      setExplorerUrl(tx.explorerUrl);
      setTxStatus("pending");
      tx.wait().then(() => {
        setTxStatus("confirmed");
        haptic?.notificationOccurred("success");
      }).catch(() => {
        setTxStatus("failed");
        haptic?.notificationOccurred("error");
      });
    } catch { setTxStatus("failed"); }
  };

  const handleUnstake = async () => {
    if (!amount || parseFloat(amount) <= 0 || !selectedPool || !selectedToken) return;
    setTxStatus("signing");
    haptic?.notificationOccurred("warning");
    try {
      const wallet = getWallet();
      const tx = await wallet.exitPoolIntent(selectedPool.address, Amount.parse(amount, selectedToken.decimals, selectedToken.symbol));
      setTxHash(tx.hash);
      setExplorerUrl(tx.explorerUrl);
      setTxStatus("pending");
      tx.wait().then(() => {
        setTxStatus("confirmed");
        haptic?.notificationOccurred("success");
      }).catch(() => {
        setTxStatus("failed");
        haptic?.notificationOccurred("error");
      });
    } catch { setTxStatus("failed"); }
  };

  const filtered = search
    ? validators.filter((v) => v.name.toLowerCase().includes(search.toLowerCase()))
    : validators;

  return (
    <div className="relative space-y-4">
      {/* Stakeable tokens */}
      {stakeableTokens.length > 0 && (
        <div className="animate-in">
          <h3 className="text-[10px] font-extrabold text-sz-text-muted uppercase tracking-[0.2em] mb-2 px-1">
            {stakeableTokens.length} Stakeable Tokens
          </h3>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {stakeableTokens.map((st) => {
              const t = getToken(st.symbol);
              const isSelected = selectedToken?.symbol === st.symbol;
              return (
                <button key={st.symbol} onClick={() => { haptic?.impactOccurred("light"); if (t) setSelectedToken(t); }}
                  className={`shrink-0 glass-card flex items-center gap-2 tilt-press ${isSelected ? "!border-2 !border-sz-orange/40" : ""}`}
                  style={isSelected ? { boxShadow: "0 0 12px rgba(250,96,5,0.15)" } : {}}>
                  <TokenIcon symbol={st.symbol} size={24} logoUrl={t?.logoUrl} />
                  <span className="text-xs text-white font-extrabold">{st.symbol}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* APY card — all from on-chain data */}
      {strkApy > 0 && (
        <div className="animate-in delay-1 space-y-2">
          {/* STRK APY */}
          <div className="glass-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest">STRK Staking</div>
                <div className="text-[10px] text-sz-text-muted mt-0.5">{totalStaked.toLocaleString()} STRK staked</div>
              </div>
              <div className="text-right">
                <div className="text-xl text-sz-green font-extrabold">{strkApy}%</div>
                <div className="text-[9px] text-sz-text-muted">APY (before commission)</div>
              </div>
            </div>
          </div>

          {/* BTC Rewards */}
          {btcStrkPerYear > 0 && (
            <div className="glass-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest">BTC Staking</div>
                  <div className="text-[10px] text-sz-text-muted mt-0.5">Rewards paid in STRK (alpha: {alpha}/10000)</div>
                </div>
                <div className="text-right">
                  <div className="text-base text-sz-orange font-extrabold">~{btcStrkPerYear}</div>
                  <div className="text-[9px] text-sz-text-muted">STRK/BTC/year</div>
                </div>
              </div>
            </div>
          )}

          <div className="text-[9px] text-sz-text-muted leading-relaxed px-1">
            All data from on-chain contracts. Net APY = base minus validator fee. StarkZap charges 0%.
          </div>
        </div>
      )}

      {/* Selected validator + pool detail */}
      {selectedValidator && (
        <div className="animate-in glass-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {selectedValidator.logoUrl ? (
                <img src={selectedValidator.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-[9px] font-bold text-white">
                  {selectedValidator.name.slice(0, 2)}
                </div>
              )}
              <div>
                <div className="text-xs text-white font-extrabold">{selectedValidator.name}</div>
                <div className="text-[9px] text-sz-text-muted font-mono">{shortenAddress(selectedValidator.stakerAddress, 5)}</div>
              </div>
            </div>
            <button onClick={() => { setSelectedValidator(null); setSelectedPool(null); setValidatorPools([]); }}
              className="text-[10px] text-sz-orange font-bold">Change</button>
          </div>

          {poolsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-sz-orange/30 border-t-sz-orange rounded-full animate-spin" />
              <span className="text-[10px] text-sz-text-muted">Loading pools & commission...</span>
            </div>
          ) : validatorPools.length === 0 ? (
            <p className="text-[10px] text-sz-text-muted py-1">No delegation pools found for this validator</p>
          ) : (
            <div className="space-y-1.5">
              {validatorPools.map((pool) => {
                const isSelected = selectedPool?.address === pool.address;
                return (
                  <button key={pool.address} onClick={() => { haptic?.impactOccurred("light"); setSelectedPool(pool); const t = getToken(pool.token.symbol); if (t) setSelectedToken(t); }}
                    className={`w-full flex items-center justify-between py-2 px-3 rounded-lg text-left transition-all ${isSelected ? "bg-sz-orange/10 border border-sz-orange/30" : "bg-black/20 border border-sz-border"}`}>
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={pool.token.symbol} size={22} logoUrl={getToken(pool.token.symbol)?.logoUrl} />
                      <div>
                        <span className="text-[11px] text-white font-bold">{pool.token.symbol}</span>
                        <span className="text-[9px] text-sz-text-muted ml-1.5">{pool.amount} delegated</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {strkApy > 0 && pool.token.symbol === "STRK" ? (
                        <div>
                          <div className="text-xs text-sz-green font-extrabold">
                            {(strkApy * (1 - pool.commission / 100)).toFixed(2)}% APY
                          </div>
                          <div className="text-[9px] text-sz-text-muted">validator fee: {pool.commission}%</div>
                        </div>
                      ) : (
                        <div>
                          {btcStrkPerYear > 0 && (
                            <div className="text-xs text-sz-orange font-extrabold">~{Math.round(btcStrkPerYear * (1 - pool.commission / 100))} STRK/yr</div>
                          )}
                          {pool.commission > 0 && (
                            <div className="text-[9px] text-sz-text-muted">fee: {pool.commission}%</div>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Validator list (when none selected) */}
      {!selectedValidator && (
        <div className="animate-in delay-1">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-[10px] font-extrabold text-sz-text-muted uppercase tracking-[0.2em]">
              {loading ? "Loading..." : `${validators.length} Validators`}
            </h3>
          </div>

          {/* Search */}
          <input type="text" placeholder="Search validators..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-card text-white text-xs placeholder:text-sz-text-muted/40 mb-3" />

          {loading ? (
            <div className="space-y-1.5">{[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-[50px]" />)}</div>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto no-scrollbar">
              {filtered.slice(0, 50).map((v, i) => (
                <button key={v.stakerAddress} onClick={() => selectValidator(v)}
                  className="w-full glass-card flex items-center gap-3 tilt-press text-left animate-in"
                  style={{ animationDelay: `${Math.min(i, 20) * 0.025}s` }}>
                  {v.logoUrl ? (
                    <img src={v.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                      {v.name.slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-bold truncate">{v.name}</div>
                    <div className="text-[9px] text-sz-text-muted font-mono">{shortenAddress(v.stakerAddress, 4)}</div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              ))}
              {filtered.length === 0 && <p className="text-[10px] text-sz-text-muted text-center py-4">No validators match "{search}"</p>}
            </div>
          )}
        </div>
      )}

      {/* Your position in this pool */}
      {selectedPool && myPosition && (
        <div className="animate-in glass-card">
          <h4 className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-widest mb-2">Your Position</h4>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-sz-text-muted">Staked</span>
              <span className="text-white font-bold">{myPosition.staked}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-sz-text-muted">Rewards</span>
              <span className="text-sz-green font-bold">{myPosition.rewards}</span>
            </div>
            {myPosition.unpoolTime && (
              <div className="flex justify-between text-xs">
                <span className="text-sz-text-muted">Exit available</span>
                <span className="text-sz-yellow font-bold">{new Date(myPosition.unpoolTime).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="text-sz-text-muted">Commission</span>
              <span className="text-sz-text-muted">{myPosition.commissionPercent}%</span>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleClaimRewards} className="flex-1 py-2 rounded-xl bg-sz-green/10 border border-sz-green/20 text-xs text-sz-green font-bold active:scale-95 transition-transform">
              Claim Rewards
            </button>
            <button onClick={() => {
              if (amount && selectedPool && selectedToken) {
                handleUnstake();
              } else {
                setAmount(myPosition.stakedRaw || myPosition.staked?.replace(/[^0-9.]/g, "") || "");
                haptic?.impactOccurred("medium");
              }
            }} className="flex-1 py-2 rounded-xl bg-sz-red/10 border border-sz-red/20 text-xs text-sz-red font-bold active:scale-95 transition-transform">
              {amount && parseFloat(amount) > 0 ? "Unstake Now" : "Unstake"}
            </button>
          </div>
        </div>
      )}

      {/* Amount input (only when pool selected) */}
      {selectedPool && (
        <div className="animate-in">
          <TokenInput label="Stake Amount" token={selectedToken} value={amount} onChange={setAmount}
            onTokenClick={() => {}} balance={selectedToken ? balances[selectedToken.symbol] : undefined} />
        </div>
      )}

      {/* Stake / Unstake buttons */}
      {selectedPool && (
        <div className="animate-in pt-1 flex gap-2">
          <button onClick={() => { haptic?.impactOccurred("medium"); setShowConfirm(true); }}
            disabled={!amount || !selectedPool || !selectedToken} className="btn-primary flex-1">
            Stake {selectedToken?.symbol || ""}
          </button>
          {myPosition && (
            <button onClick={handleUnstake} disabled={!amount || !selectedPool || !selectedToken}
              className="flex-1 py-3 rounded-2xl bg-sz-red/10 border-2 border-sz-red/20 text-sm text-sz-red font-extrabold active:scale-95 transition-transform">
              Unstake
            </button>
          )}
        </div>
      )}

      {showConfirm && selectedToken && selectedPool && selectedValidator && (
        <ConfirmSheet isOpen title="Confirm Stake" details={[
          { label: "Validator", value: selectedValidator.name },
          { label: "Token", value: selectedToken.symbol },
          { label: "Amount", value: `${amount} ${selectedToken.symbol}`, highlight: true },
          { label: "Pool", value: shortenAddress(selectedPool.address, 6) },
          { label: "Validator Fee", value: `${selectedPool.commission}%` },
          ...(strkApy > 0 && selectedToken.symbol === "STRK" ? [{ label: "Net APY", value: `${(strkApy * (1 - selectedPool.commission / 100)).toFixed(2)}%`, highlight: true }] : []),
          { label: "StarkZap Fee", value: "0% (free)" },
          { label: "Network Fee", value: "Gasless" },
        ]} confirmLabel="Stake" onConfirm={handleStake} onCancel={() => setShowConfirm(false)} />
      )}

      {txStatus && (
        <TxStatus status={txStatus} txHash={txHash} explorerUrl={explorerUrl} onDone={() => { setTxStatus(null); setAmount(""); setMyPosition(null); }} />
      )}
    </div>
  );
}
