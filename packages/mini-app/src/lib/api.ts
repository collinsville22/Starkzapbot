const BACKEND_URL = "";

let authToken: string | null = null;
let lastInitData: string | null = null;
let refreshing: Promise<void> | null = null;

function setAuthToken(token: string) {
  authToken = token;
}

async function refreshToken(): Promise<void> {
  if (!lastInitData) return;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: lastInitData }),
      });
      if (res.ok) {
        const data = await res.json();
        authToken = data.token;
      }
    } catch {}
    finally { refreshing = null; }
  })();
  return refreshing;
}

async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });

  if (res.status === 401 && lastInitData) {
    await refreshToken();
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
      res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

export async function authenticate(initData: string, walletAddress?: string) {
  lastInitData = initData;
  const result = await api<{ token: string; user: any }>("/auth/validate", {
    method: "POST",
    body: JSON.stringify({ initData, ...(walletAddress ? { walletAddress } : {}) }),
  });
  setAuthToken(result.token);
  return result;
}

export async function getPortfolio() {
  return api("/api/portfolio");
}

export async function getSwapQuote(params: any) {
  return api("/api/swap/quote", { method: "POST", body: JSON.stringify(params) });
}

export async function getStakingTokens() {
  return api("/api/staking/tokens");
}

export async function getValidatorsQuick() {
  return api("/api/staking/validators/quick");
}

export async function getStakerPools(stakerAddress: string) {
  return api(`/api/staking/pools/${stakerAddress}`);
}

export async function getStakingApy(): Promise<{ baseApy: number; totalStaked: number; yearlyMint: number }> {
  return api("/api/staking/apy");
}

export async function getStakingPosition(poolAddress: string) {
  return api("/api/staking-manage/position", { method: "POST", body: JSON.stringify({ poolAddress }) });
}

export async function getLendingMarkets() {
  return api("/api/lending/markets");
}

export async function getLendingPositions() {
  return api("/api/lending/positions");
}

export async function getLendingHealth(params: any) {
  return api("/api/lending/health", { method: "POST", body: JSON.stringify(params) });
}

export async function getMaxBorrow(params: any) {
  return api("/api/lending/max-borrow", { method: "POST", body: JSON.stringify(params) });
}

export async function estimateMaxBorrow(params: any) {
  return api("/api/lending/estimate-max-borrow", { method: "POST", body: JSON.stringify(params) });
}

export async function quoteLendingHealth(params: any) {
  return api("/api/advanced/lending-health-quote", { method: "POST", body: JSON.stringify(params) });
}

export async function getDcaOrders() {
  return api("/api/dca/orders");
}

export async function previewDcaCycle(params: any) {
  return api("/api/dca/preview", { method: "POST", body: JSON.stringify(params) });
}

export async function getBridgeTokens(chain?: string) {
  return api(`/api/bridge/tokens${chain ? `?chain=${chain}` : ""}`);
}

export async function getDeployStatus() {
  return api("/api/advanced/deploy-status");
}

export async function getSwapProviders() {
  return api("/api/advanced/swap-providers");
}

export async function estimateSwapFee(params: any) {
  return api("/api/advanced/estimate-fee", { method: "POST", body: JSON.stringify(params) });
}

export async function getConfidentialInfo() {
  return api("/api/confidential/info");
}

export async function getConfidentialBalance(tokenSymbol: string) {
  return api("/api/confidential/balance", { method: "POST", body: JSON.stringify({ tokenSymbol }) });
}

export async function getMyTongoId() {
  return api("/api/confidential/my-id");
}

export async function getTokenList(): Promise<{ tokens: any[]; count: number }> {
  return api("/api/tokens");
}

export async function getHistory(type?: string) {
  return api(`/api/history${type ? `?type=${type}` : ""}`);
}
