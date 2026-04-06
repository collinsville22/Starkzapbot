import { create } from "zustand";
import { getTokenList } from "../lib/api.js";
import type { Token } from "@starkzap-tg/shared";

interface TokensState {
  tokens: Token[];
  tokenMap: Record<string, Token>;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  getToken: (symbol: string) => Token | undefined;
}

export const useTokens = create<TokensState>((set, get) => ({
  tokens: [],
  tokenMap: {},
  loaded: false,
  loading: false,

  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await getTokenList();
      const map: Record<string, Token> = {};
      for (const t of res.tokens) map[t.symbol] = t;
      set({ tokens: res.tokens, tokenMap: map, loaded: true, loading: false });
    } catch {
      set({ loaded: true, loading: false });
    }
  },

  getToken: (symbol: string) => get().tokenMap[symbol],
}));
