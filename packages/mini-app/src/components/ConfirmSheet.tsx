import { IconLoader } from "./Icons.js";

interface ConfirmSheetProps {
  isOpen: boolean;
  title: string;
  details: Array<{ label: string; value: string; highlight?: boolean }>;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  isLoading?: boolean;
}

export function ConfirmSheet({ isOpen, title, details, onConfirm, onCancel, confirmLabel = "Confirm", isLoading = false }: ConfirmSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 animate-in" onClick={onCancel}>
      <div className="absolute bottom-0 left-0 right-0 bg-sz-surface border-t-2 border-sz-border rounded-t-3xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center py-3"><div className="w-10 h-1 rounded-full bg-sz-border" /></div>
        <div className="px-5 pb-8">
          <h3 className="text-lg font-extrabold text-white tracking-tight mb-4">{title}</h3>

          <div className="glass-card mb-5">
            {details.map((d, i) => (
              <div key={i} className={`flex justify-between py-2.5 ${i < details.length - 1 ? "border-b border-sz-border/50" : ""}`}>
                <span className="text-xs text-sz-text-muted font-medium">{d.label}</span>
                <span className={`text-xs font-extrabold ${d.highlight ? "text-sz-orange" : "text-white"}`}>{d.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={onCancel} disabled={isLoading} className="flex-1 btn-ghost text-sm">Cancel</button>
            <button onClick={onConfirm} disabled={isLoading} className="flex-[2] btn-primary text-sm flex items-center justify-center gap-2">
              {isLoading ? <><IconLoader /> Processing...</> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
