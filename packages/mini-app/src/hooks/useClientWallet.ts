import { useState, useCallback, useRef, useEffect } from "react";
import { generateStarkPrivateKey, getPublicKey, computeWalletAddress, encryptWithPin, decryptWithPin } from "../lib/crypto.js";
import { saveEncryptedKey, loadEncryptedKey, saveWalletAddress, loadWalletAddress, hasWallet } from "../lib/storage.js";

interface ClientWalletState {
  address: string | null;
  publicKey: string | null;
  isReady: boolean;
  isLocked: boolean;
  needsSetup: boolean;
  loading: boolean;
  error: string | null;
}

let walletInstance: any = null;
let signerInstance: any = null;

export function useClientWallet() {
  const [state, setState] = useState<ClientWalletState>({
    address: null,
    publicKey: null,
    isReady: false,
    isLocked: true,
    needsSetup: true,
    loading: true,
    error: null,
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const exists = await hasWallet();
        const addr = await loadWalletAddress();
        setState((s) => ({
          ...s,
          needsSetup: !exists,
          isLocked: exists,
          address: addr,
          loading: false,
        }));
      } catch {
        setState((s) => ({ ...s, loading: false, needsSetup: true }));
      }
    })();
  }, []);

  const setup = useCallback(async (pin: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const privateKey = generateStarkPrivateKey();
      const publicKey = getPublicKey(privateKey);
      const address = computeWalletAddress(publicKey);

      const encrypted = await encryptWithPin(privateKey, pin);
      await saveEncryptedKey(encrypted);
      await saveWalletAddress(address);

      const { StarkZap, StarkSigner, AvnuSwapProvider, EkuboSwapProvider } = await import("starkzap");

      const sdk = new StarkZap({
        network: "mainnet",
        rpcUrl: "https://rpc.starknet.lava.build",
        paymaster: { nodeUrl: "https://starknet.paymaster.avnu.fi" },
      });

      signerInstance = new StarkSigner(privateKey);
      walletInstance = await sdk.connectWallet({
        account: { signer: signerInstance },
        feeMode: "user_pays",
        swapProviders: [new AvnuSwapProvider(), new EkuboSwapProvider()],
      });

      setState({
        address,
        publicKey,
        isReady: true,
        isLocked: false,
        needsSetup: false,
        loading: false,
        error: null,
      });

      return address;
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
      return null;
    }
  }, []);

  const unlock = useCallback(async (pin: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const encrypted = await loadEncryptedKey();
      if (!encrypted) throw new Error("No wallet found");

      const privateKey = await decryptWithPin(encrypted, pin);

      const publicKey = getPublicKey(privateKey);
      const address = computeWalletAddress(publicKey);

      const { StarkZap, StarkSigner, AvnuSwapProvider, EkuboSwapProvider } = await import("starkzap");

      const sdk = new StarkZap({
        network: "mainnet",
        rpcUrl: "https://rpc.starknet.lava.build",
        paymaster: { nodeUrl: "https://starknet.paymaster.avnu.fi" },
      });

      signerInstance = new StarkSigner(privateKey);
      walletInstance = await sdk.connectWallet({
        account: { signer: signerInstance },
        feeMode: "user_pays",
        swapProviders: [new AvnuSwapProvider(), new EkuboSwapProvider()],
      });

      await saveWalletAddress(address);

      setState({
        address,
        publicKey,
        isReady: true,
        isLocked: false,
        needsSetup: false,
        loading: false,
        error: null,
      });

      return true;
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Invalid PIN" }));
      return false;
    }
  }, []);

  const lock = useCallback(() => {
    walletInstance = null;
    signerInstance = null;
    setState((s) => ({ ...s, isReady: false, isLocked: true }));
  }, []);

  const getWallet = useCallback(() => {
    if (!walletInstance) throw new Error("Wallet is locked");
    return walletInstance;
  }, []);

  const getSigner = useCallback(() => {
    if (!signerInstance) throw new Error("Wallet is locked");
    return signerInstance;
  }, []);

  return {
    ...state,
    setup,
    unlock,
    lock,
    getWallet,
    getSigner,
  };
}
