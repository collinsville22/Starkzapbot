import { useState, useCallback } from "react";

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "";

interface ExternalWalletState {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  chainId: number | null;
  chain: "ethereum" | "solana" | null;
  provider: any;
  error: string | null;
}

export function useExternalWallet() {
  const [state, setState] = useState<ExternalWalletState>({
    connected: false,
    connecting: false,
    address: null,
    chainId: null,
    chain: null,
    provider: null,
    error: null,
  });

  const connectEthereum = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const { EthereumProvider } = await import("@walletconnect/ethereum-provider");

      const provider = await EthereumProvider.init({
        projectId: PROJECT_ID,
        metadata: {
          name: "StarkZap",
          description: "Bridge tokens to Starknet via StarkZap",
          url: window.location.origin,
          icons: ["https://starkzap.io/favicon.ico"],
        },
        showQrModal: true,
        optionalChains: [1], // Ethereum mainnet
      });

      await provider.enable();

      const accounts = await provider.request({ method: "eth_accounts" }) as string[];
      const chainIdHex = await provider.request({ method: "eth_chainId" }) as string;
      const address = accounts[0];
      const chainId = parseInt(chainIdHex, 16);

      provider.on("disconnect", () => {
        setState({
          connected: false, connecting: false, address: null,
          chainId: null, chain: null, provider: null, error: null,
        });
      });

      setState({
        connected: true,
        connecting: false,
        address,
        chainId,
        chain: "ethereum",
        provider,
        error: null,
      });

      return { provider, address, chainId };
    } catch (err: any) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: err.message || "Failed to connect wallet",
      }));
      return null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (state.provider) {
      try {
        await state.provider.disconnect();
      } catch {}
    }
    setState({
      connected: false, connecting: false, address: null,
      chainId: null, chain: null, provider: null, error: null,
    });
  }, [state.provider]);

  return {
    ...state,
    connectEthereum,
    disconnect,
  };
}
