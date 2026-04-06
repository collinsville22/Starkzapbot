import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TabBar } from "./components/TabBar.js";
import { Home } from "./pages/Home.js";
import { Swap } from "./pages/Swap.js";
import { Bridge } from "./pages/Bridge.js";
import { DCA } from "./pages/DCA.js";
import { Stake } from "./pages/Stake.js";
import { Lend } from "./pages/Lend.js";
import { Send } from "./pages/Send.js";
import { Activity } from "./pages/Activity.js";
import { useTelegram } from "./hooks/useTelegram.js";
import { useWallet } from "./hooks/useWallet.js";
import { useTokens } from "./hooks/useTokens.js";
import { SegmentedControl } from "./components/SegmentedControl.js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function TradePage() {
  const [tab, setTab] = useState("Swap");
  return (
    <>
      <div className="mb-4 animate-in delay-1">
        <SegmentedControl options={["Swap", "Bridge", "DCA"]} selected={tab} onChange={setTab} />
      </div>
      {tab === "Swap" && <Swap />}
      {tab === "Bridge" && <Bridge />}
      {tab === "DCA" && <DCA />}
    </>
  );
}

function EarnPage() {
  const [tab, setTab] = useState("Stake");
  return (
    <>
      <div className="mb-4 animate-in delay-1">
        <SegmentedControl options={["Stake", "Lend"]} selected={tab} onChange={setTab} />
      </div>
      {tab === "Stake" && <Stake />}
      {tab === "Lend" && <Lend />}
    </>
  );
}

const TITLES: Record<string, string> = {
  "/": "",
  "/trade": "Trade",
  "/earn": "Earn",
  "/send": "Send",
  "/activity": "Activity",
};

function HeaderBar() {
  const location = useLocation();
  const title = TITLES[location.pathname] || "";
  const { user } = useWallet();

  return (
    <div className="header-zone">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="StarkZap" className="w-8 h-8 rounded-lg shadow-lg shadow-orange-500/20" />
          <div>
            <p className="text-sm text-white font-extrabold tracking-tight">{title || "StarkZap"}</p>
            {user?.username && <p className="text-[10px] text-sz-text-muted">@{user.username}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 bg-sz-card rounded-full px-3 py-1.5 border-2 border-sz-border">
          <div className="w-1.5 h-1.5 rounded-full bg-sz-green" style={{ boxShadow: "0 0 6px rgba(144,239,137,0.5)" }} />
          <span className="text-[10px] text-sz-text-muted font-semibold">Mainnet</span>
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { initData, startParam } = useTelegram();
  const { login, isAuthenticated, isLoading, error } = useWallet();
  const { load: loadTokens } = useTokens();
  const navigate = useNavigate();

  useEffect(() => {
    loadTokens();
    if (!isAuthenticated && !isLoading && !error) {
      login(initData || "dev");
    }
  }, []);

  useEffect(() => {
    if (startParam) {
      const p = startParam.toLowerCase();
      if (p.startsWith("swap")) navigate("/trade");
      else if (p === "stake" || p === "lend") navigate("/earn");
      else if (p === "bridge" || p === "dca") navigate("/trade");
    }
  }, [startParam]);

  if (isLoading && !error) {
    return (
      <div className="flex items-center justify-center h-screen bg-black relative overflow-hidden">
        <div className="absolute w-[400px] h-[400px] rounded-full top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ background: "radial-gradient(circle, rgba(250,96,5,0.1) 0%, transparent 60%)", filter: "blur(60px)" }} />
        <div className="text-center relative z-10 animate-in">
          <img src="/logo.jpg" alt="StarkZap" className="w-20 h-20 rounded-2xl mx-auto mb-5 pulse-glow shadow-lg shadow-orange-500/30" />
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-1">StarkZap</h2>
          <p className="text-sm text-sz-text-muted font-semibold">Setting up your wallet...</p>
          <div className="mt-5 flex justify-center">
            <div className="w-7 h-7 border-[2.5px] border-sz-orange/20 border-t-sz-orange rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <HeaderBar />

      <div className="content-sheet-outer">
        <div className="content-sheet-inner no-scrollbar">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trade" element={<TradePage />} />
            <Route path="/earn" element={<EarnPage />} />
            <Route path="/send" element={<Send />} />
            <Route path="/activity" element={<Activity />} />
          </Routes>
        </div>
      </div>

      <TabBar />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
