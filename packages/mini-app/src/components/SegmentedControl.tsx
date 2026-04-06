import { useTelegram } from "../hooks/useTelegram.js";

interface SegmentedControlProps {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, selected, onChange }: SegmentedControlProps) {
  const { haptic } = useTelegram();
  const isCompact = options.length > 3;

  return (
    <div className="flex bg-sz-card rounded-2xl p-1.5 gap-1 border border-sz-border w-full">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => { haptic?.selectionChanged(); onChange(opt); }}
          className={`flex-1 rounded-xl font-extrabold transition-all min-w-0 truncate border ${
            isCompact ? "py-2 px-2 text-[10px]" : "py-2.5 px-3 text-xs"
          } ${
            selected === opt
              ? "bg-sz-orange text-white border-sz-orange/50 shadow-lg shadow-sz-orange/25"
              : "text-sz-text-muted border-transparent hover:text-white"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
