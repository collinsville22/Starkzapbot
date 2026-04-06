import { useState, useCallback } from "react";

interface PinModalProps {
  isOpen: boolean;
  mode: "create" | "unlock";
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
  error?: string;
}

export function PinModal({ isOpen, mode, onSubmit, onCancel, error }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [phase, setPhase] = useState<"enter" | "confirm">("enter");

  const handleDigit = useCallback((d: string) => {
    if (phase === "confirm") {
      if (confirmPin.length < 4) {
        const next = confirmPin + d;
        setConfirmPin(next);
        if (next.length === 4) {
          if (next === pin) {
            onSubmit(next);
            setPin("");
            setConfirmPin("");
            setPhase("enter");
          } else {
            setConfirmPin("");
          }
        }
      }
      return;
    }

    if (pin.length < 4) {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) {
        if (mode === "unlock") {
          onSubmit(next);
          setPin("");
        } else {
          setPhase("confirm");
        }
      }
    }
  }, [pin, confirmPin, phase, mode, onSubmit]);

  const handleBackspace = useCallback(() => {
    if (phase === "confirm") {
      setConfirmPin((p) => p.slice(0, -1));
    } else {
      setPin((p) => p.slice(0, -1));
    }
  }, [phase]);

  if (!isOpen) return null;

  const currentPin = phase === "confirm" ? confirmPin : pin;
  const title = mode === "create"
    ? phase === "confirm" ? "Confirm PIN" : "Create PIN"
    : "Enter PIN";
  const subtitle = mode === "create"
    ? phase === "confirm" ? "Enter your PIN again" : "Choose a 4-digit PIN to secure your wallet"
    : "Unlock your wallet";

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <h2 className="text-xl font-extrabold text-white tracking-tight">{title}</h2>
        <p className="text-xs text-sz-text-muted mt-2">{subtitle}</p>
        {error && <p className="text-xs text-sz-red mt-2">{error}</p>}
        {phase === "confirm" && confirmPin.length === 0 && pin.length === 4 && (
          <p className="text-xs text-sz-yellow mt-2">PINs didn't match. Try again.</p>
        )}
      </div>

      <div className="flex gap-4 mb-10">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all ${
              i < currentPin.length
                ? "bg-sz-orange shadow-lg shadow-sz-orange/40"
                : "bg-sz-card border-2 border-sz-border"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 w-64">
        {["1","2","3","4","5","6","7","8","9","","0","←"].map((key) => (
          <button
            key={key || "empty"}
            onClick={() => {
              if (key === "←") handleBackspace();
              else if (key) handleDigit(key);
            }}
            disabled={!key}
            className={`h-14 rounded-2xl text-xl font-extrabold transition-all active:scale-90 ${
              key === "←"
                ? "text-sz-text-muted bg-transparent"
                : key
                  ? "text-white bg-sz-card border border-sz-border"
                  : ""
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {onCancel && (
        <button onClick={onCancel} className="mt-8 text-xs text-sz-text-muted font-bold">
          Cancel
        </button>
      )}
    </div>
  );
}
