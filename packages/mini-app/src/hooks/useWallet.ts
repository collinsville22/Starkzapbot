import { create } from "zustand";
import { authenticate } from "../lib/api.js";

interface WalletState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: number;
    telegramId: number;
    username: string | null;
    walletAddress: string;
  } | null;
  error: string | null;
  login: (initData: string) => Promise<void>;
}

export const useWallet = create<WalletState>((set) => ({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: null,

  login: async (initData: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authenticate(initData);
      set({
        isAuthenticated: true,
        isLoading: false,
        user: result.user,
      });
    } catch (err: any) {
      set({
        isAuthenticated: false,
        isLoading: false,
        error: err.message,
      });
    }
  },
}));
