interface HealthBarProps {
  collateralValue: string;
  debtValue: string;
  isCollateralized: boolean;
}

export function HealthBar({ collateralValue, debtValue, isCollateralized }: HealthBarProps) {
  const collateral = parseFloat(collateralValue) || 0;
  const debt = parseFloat(debtValue) || 0;
  const ratio = debt > 0 ? collateral / debt : Infinity;
  const width = Math.min(100, Math.max(8, (ratio / 3) * 100));

  const label = !isCollateralized || ratio < 1.2 ? "Critical" : ratio < 1.5 ? "Warning" : "Healthy";
  const color = !isCollateralized || ratio < 1.2 ? "#ef4444" : ratio < 1.5 ? "#f3ba2f" : "#90ef89";

  return (
    <div className="glass-card">
      <div className="flex justify-between mb-2">
        <span className="text-[10px] text-sz-text-muted font-extrabold uppercase tracking-[0.15em]">Health</span>
        <span className="text-xs font-extrabold" style={{ color }}>
          {ratio === Infinity ? "---" : ratio.toFixed(2)} · {label}
        </span>
      </div>
      <div className="h-2 rounded-full bg-sz-border overflow-hidden border border-sz-border">
        <div className="progress-gradient h-full rounded-full transition-all duration-700" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
