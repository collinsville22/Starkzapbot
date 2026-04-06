export interface Token {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  logoUrl?: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface UserProfile {
  id: number;
  telegramId: number;
  username: string | null;
  walletAddress: string;
  createdAt: string;
}

export interface TokenBalance {
  token: Token;
  balance: string;
  balanceRaw: string;
  price?: number;
  usdValue?: number;
}

export interface PortfolioResponse {
  walletAddress: string;
  balances: TokenBalance[];
}

export interface SwapQuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippageBps?: number;
  provider?: "avnu" | "ekubo";
}

export interface SwapQuoteResponse {
  amountIn: string;
  amountOut: string;
  priceImpactBps: string | null;
  provider: string;
  tokenIn: Token;
  tokenOut: Token;
}

export interface SwapExecuteRequest extends SwapQuoteRequest {}

export interface StakeRequest {
  poolAddress: string;
  amount: string;
  tokenSymbol: string;
}

export interface StakePositionResponse {
  poolAddress: string;
  token: Token;
  staked: string;
  rewards: string;
  commission: number;
  unpoolTime: string | null;
}

export interface LendDepositRequest {
  tokenSymbol: string;
  amount: string;
  poolAddress?: string;
}

export interface LendBorrowRequest {
  collateralTokenSymbol: string;
  debtTokenSymbol: string;
  amount: string;
  poolAddress?: string;
}

export interface LendRepayRequest extends LendBorrowRequest {}

export interface LendHealthResponse {
  isCollateralized: boolean;
  collateralValue: string;
  debtValue: string;
}

export interface LendPositionResponse {
  collateralShares: string;
  nominalDebt: string;
  collateralValue: string;
  debtValue: string;
  isCollateralized: boolean;
}

export interface DcaCreateRequest {
  sellTokenSymbol: string;
  buyTokenSymbol: string;
  totalAmount: string;
  amountPerCycle: string;
  frequency: string;
  provider?: "avnu" | "ekubo";
}

export interface DcaOrderResponse {
  id: string;
  providerId: string;
  sellToken: string;
  buyToken: string;
  frequency: string;
  status: string;
  amountSold: string;
  amountBought: string;
  executedTrades: number;
  startDate: string;
  endDate: string;
}

export interface BridgeTokenResponse {
  symbol: string;
  chain: string;
  protocol: string;
  address: string;
}

export interface BridgeEstimateRequest {
  tokenSymbol: string;
  chain: string;
  amount: string;
}

export interface BridgeEstimateResponse {
  fee: string;
  estimatedTime: string;
}

export interface ConfidentialFundRequest {
  tokenSymbol: string;
  amount: string;
}

export interface ConfidentialSendRequest {
  tokenSymbol: string;
  amount: string;
  recipientId: string;
}

export interface ConfidentialStateResponse {
  active: string;
  pending: string;
}

export interface TransactionRecord {
  id: number;
  type: "swap" | "transfer" | "stake" | "lend" | "dca" | "bridge" | "confidential";
  status: "pending" | "confirmed" | "failed";
  txHash: string | null;
  details: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  message: string;
}
