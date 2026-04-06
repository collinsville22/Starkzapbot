import { useState, useEffect } from "react";
import { getHistory } from "../lib/api.js";
import { timeAgo, shortenTxHash } from "../lib/format.js";
import { useTelegram } from "../hooks/useTelegram.js";

const FILTERS = ["All", "Swap", "Stake", "Lend", "DCA", "Bridge"];

const typeConfig: Record<string, { icon: string; color: string }> = {
  swap: { icon: "S", color: "bg-blue-500/20 text-blue-400" },
  transfer: { icon: "T", color: "bg-sz-orange-dim text-sz-orange" },
  stake: { icon: "K", color: "bg-purple-500/20 text-purple-400" },
  lend: { icon: "L", color: "bg-sz-green-dim text-sz-green" },
  dca: { icon: "D", color: "bg-cyan-500/20 text-cyan-400" },
  bridge: { icon: "B", color: "bg-sz-yellow-dim text-sz-yellow" },
  confidential: { icon: "C", color: "bg-purple-500/20 text-purple-400" },
};

const statusDot: Record<string, string> = {
  pending: "bg-sz-yellow animate-pulse",
  confirmed: "bg-sz-green",
  failed: "bg-sz-red",
};

export function Activity() {
  const { haptic } = useTelegram();
  const [filter, setFilter] = useState("All");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const type = filter === "All" ? undefined : filter.toLowerCase();
    getHistory(type).then((res) => setTransactions(res.transactions)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="relative">
      <h1 className="text-2xl font-extrabold text-sz-text tracking-tighter text-center pt-4 mb-5 animate-in">Activity</h1>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar animate-in delay-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { haptic?.selectionChanged(); setFilter(f); }}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              filter === f
                ? "bg-sz-orange text-white border-sz-orange shadow-lg shadow-sz-orange/20"
                : "bg-white/[0.03] text-sz-text-secondary border-sz-border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-[68px]" />)}
        </div>
      ) : transactions.length === 0 ? (
        <div className="glass-card p-10 text-center animate-in delay-2">
          <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <p className="text-sz-text-secondary font-semibold mb-1">No activity yet</p>
          <p className="text-xs text-sz-text-muted">Start swapping, staking, or lending to see transactions here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx, i) => {
            const cfg = typeConfig[tx.type] || typeConfig.swap;
            return (
              <div key={tx.id} onClick={() => tx.txHash && window.open(`https://starkscan.co/tx/${tx.txHash}`, "_blank")}
                className="glass-card p-4 flex items-center gap-3 animate-in cursor-pointer" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm ${cfg.color}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sz-text text-sm capitalize">{tx.type}</span>
                    <div className={`w-2 h-2 rounded-full ${statusDot[tx.status] || statusDot.pending}`} />
                  </div>
                  <p className="text-xs text-sz-text-muted mt-0.5">
                    {tx.txHash ? shortenTxHash(tx.txHash) : tx.status === "failed" ? "Failed" : "Pending"} · {timeAgo(tx.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
