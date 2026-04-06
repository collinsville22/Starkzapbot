import { IconCheck, IconX, IconLoader } from "./Icons.js";

interface TxStatusProps {
  status: "signing" | "pending" | "confirmed" | "failed";
  txHash?: string;
  explorerUrl?: string;
  message?: string;
  onDone?: () => void;
}

export function TxStatus({ status, txHash, explorerUrl, message, onDone }: TxStatusProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95">
      <div className="text-center px-8 animate-in">
        <div className="mb-5 flex justify-center">
          {(status === "signing" || status === "pending") && (
            <div className="pulse-glow rounded-full p-5 bg-sz-orange-dim"><IconLoader /></div>
          )}
          {status === "confirmed" && (
            <div className="rounded-full p-4 bg-sz-green-dim animate-in"><IconCheck /></div>
          )}
          {status === "failed" && (
            <div className="rounded-full p-4 bg-sz-red-dim animate-in"><IconX /></div>
          )}
        </div>

        <h3 className="text-xl font-extrabold text-white tracking-tight mb-1">
          {status === "signing" && "Signing..."}
          {status === "pending" && "Submitted"}
          {status === "confirmed" && "Confirmed"}
          {status === "failed" && "Failed"}
        </h3>
        <p className="text-xs text-sz-text-muted mb-4">
          {status === "signing" && "Preparing your transaction"}
          {status === "pending" && "Waiting for Starknet confirmation"}
          {status === "confirmed" && (message || "Transaction successful")}
          {status === "failed" && (message || "Transaction failed. Check your balance and try again.")}
        </p>

        {txHash && (
          <a href={explorerUrl || `https://starkscan.co/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
            className="inline-block text-xs text-sz-orange font-bold mb-5 underline underline-offset-4 decoration-sz-orange/30">
            View on StarkScan
          </a>
        )}

        {(status === "confirmed" || status === "failed") && onDone && (
          <button onClick={onDone} className="btn-primary mt-2">Done</button>
        )}
      </div>
    </div>
  );
}
