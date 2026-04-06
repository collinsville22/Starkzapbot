const BACKEND_URL = "";

let authToken: string | null = null;
let lastInitData: string | null = null;
let refreshing: Promise<void> | null = null;

export function setAuthToken(token: string) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
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

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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

export async function executeSwap(params: any) {
  return api("/api/swap/execute", { method: "POST", body: JSON.stringify(params) });
}

export async function getStakingTokens() {
  return api("/api/staking/tokens");
}

export async function getValidators() {
  return api("/api/staking/validators");
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

export async function getStakePosition(poolAddress: string) {
  return api(`/api/staking/position/${poolAddress}`);
}

export async function stakeTokens(params: any) {
  return api("/api/staking/stake", { method: "POST", body: JSON.stringify(params) });
}

export async function claimRewards(poolAddress: string) {
  return api("/api/staking/claim", { method: "POST", body: JSON.stringify({ poolAddress }) });
}

export async function getLendingMarkets() {
  return api("/api/lending/markets");
}

export async function getLendingPositions() {
  return api("/api/lending/positions");
}

export async function lendDeposit(params: any) {
  return api("/api/lending/deposit", { method: "POST", body: JSON.stringify(params) });
}

export async function lendBorrow(params: any) {
  return api("/api/lending/borrow", { method: "POST", body: JSON.stringify(params) });
}

export async function lendRepay(params: any) {
  return api("/api/lending/repay", { method: "POST", body: JSON.stringify(params) });
}

export async function lendWithdraw(params: any) {
  return api("/api/lending/withdraw", { method: "POST", body: JSON.stringify(params) });
}

export async function getLendingHealth(params: any) {
  return api("/api/lending/health", { method: "POST", body: JSON.stringify(params) });
}

export async function lendWithdrawMax(params: any) {
  return api("/api/lending/withdraw-max", { method: "POST", body: JSON.stringify(params) });
}

export async function getMaxBorrow(params: any) {
  return api("/api/lending/max-borrow", { method: "POST", body: JSON.stringify(params) });
}

export async function estimateMaxBorrow(params: any) {
  return api("/api/lending/estimate-max-borrow", { method: "POST", body: JSON.stringify(params) });
}

export async function getDcaOrders() {
  return api("/api/dca/orders");
}

export async function createDcaOrder(params: any) {
  return api("/api/dca/create", { method: "POST", body: JSON.stringify(params) });
}

export async function cancelDcaOrder(params: any) {
  return api("/api/dca/cancel", { method: "POST", body: JSON.stringify(params) });
}

export async function previewDcaCycle(params: any) {
  return api("/api/dca/preview", { method: "POST", body: JSON.stringify(params) });
}

export async function getBridgeTokens(chain?: string) {
  return api(`/api/bridge/tokens${chain ? `?chain=${chain}` : ""}`);
}

export async function getStakingPosition(poolAddress: string) {
  return api("/api/staking-manage/position", { method: "POST", body: JSON.stringify({ poolAddress }) });
}

export async function claimStakingRewards(poolAddress: string) {
  return api("/api/staking-manage/claim-rewards", { method: "POST", body: JSON.stringify({ poolAddress }) });
}

export async function exitStakingIntent(poolAddress: string, amount: string, tokenSymbol: string) {
  return api("/api/staking-manage/exit-intent", { method: "POST", body: JSON.stringify({ poolAddress, amount, tokenSymbol }) });
}

export async function exitStaking(poolAddress: string) {
  return api("/api/staking-manage/exit", { method: "POST", body: JSON.stringify({ poolAddress }) });
}

export async function getDeployStatus() {
  return api("/api/advanced/deploy-status");
}

export async function deployAccount() {
  return api("/api/advanced/deploy", { method: "POST" });
}

export async function estimateSwapFee(params: any) {
  return api("/api/advanced/estimate-fee", { method: "POST", body: JSON.stringify(params) });
}

export async function preflightSwap(params: any) {
  return api("/api/advanced/preflight", { method: "POST", body: JSON.stringify(params) });
}

export async function signMessage(typedData: any) {
  return api("/api/advanced/sign-message", { method: "POST", body: JSON.stringify({ typedData }) });
}

export async function batchTransfer(tokenSymbol: string, transfers: Array<{ to: string; amount: string }>) {
  return api("/api/advanced/batch-transfer", { method: "POST", body: JSON.stringify({ tokenSymbol, transfers }) });
}

export async function advancedSwap(params: any) {
  return api("/api/advanced/swap", { method: "POST", body: JSON.stringify(params) });
}

export async function advancedQuote(params: any) {
  return api("/api/advanced/quote", { method: "POST", body: JSON.stringify(params) });
}

export async function getSwapProviders() {
  return api("/api/advanced/swap-providers");
}

export async function quoteLendingHealth(params: any) {
  return api("/api/advanced/lending-health-quote", { method: "POST", body: JSON.stringify(params) });
}

export async function getConfidentialInfo() {
  return api("/api/confidential/info");
}

export async function getConfidentialBalance(tokenSymbol: string) {
  return api("/api/confidential/balance", { method: "POST", body: JSON.stringify({ tokenSymbol }) });
}

export async function confidentialFund(params: { tokenSymbol: string; amount: string }) {
  return api("/api/confidential/fund", { method: "POST", body: JSON.stringify(params) });
}

export async function confidentialTransfer(params: { tokenSymbol: string; amount: string; recipientAddress?: string; recipientX?: string; recipientY?: string }) {
  return api("/api/confidential/transfer", { method: "POST", body: JSON.stringify(params) });
}

export async function getMyTongoId() {
  return api("/api/confidential/my-id");
}

export async function confidentialWithdraw(params: { tokenSymbol: string; amount: string; toAddress?: string }) {
  return api("/api/confidential/withdraw", { method: "POST", body: JSON.stringify(params) });
}

export async function getTokenPrices(): Promise<{ prices: Record<string, number> }> {
  return api("/api/prices");
}

export async function getTokenList(): Promise<{ tokens: any[]; count: number }> {
  return api("/api/tokens");
}

export async function sendTokens(params: { tokenSymbol: string; amount: string; recipient: string }) {
  return api("/api/transfer/send", { method: "POST", body: JSON.stringify(params) });
}

export async function getHistory(type?: string) {
  return api(`/api/history${type ? `?type=${type}` : ""}`);
}

export async function waitForTx(
  txHash: string,
  onStatus: (status: "pending" | "confirmed" | "failed") => void,
  maxAttempts = 30
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 4000)); // poll every 4s
    try {
      const res = await getHistory();
      const tx = res.transactions?.find((t: any) => t.txHash === txHash);
      if (tx?.status === "confirmed") { onStatus("confirmed"); return; }
      if (tx?.status === "failed") { onStatus("failed"); return; }
    } catch {}
  }
  onStatus("pending");
}
