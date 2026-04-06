import {
  StarkZap,
  type Wallet,
  AvnuSwapProvider,
  EkuboSwapProvider,
  AvnuDcaProvider,
  EkuboDcaProvider,
} from "starkzap";
import { log } from "../utils/logger.js";

let sdk: StarkZap | null = null;

export function getSdk(): StarkZap {
  if (!sdk) {
    const network = (process.env.STARKNET_NETWORK || "mainnet") as "mainnet" | "sepolia";
    const rpcUrl = process.env.STARKNET_RPC_URL;
    log.info("starkzap", `Initializing SDK on ${network}`);
    sdk = new StarkZap({
      network,
      ...(rpcUrl ? { rpcUrl } : {}),
      paymaster: {
        nodeUrl: network === "mainnet"
          ? "https://starknet.paymaster.avnu.fi"
          : "https://sepolia.paymaster.avnu.fi",
      },
    });
  }
  return sdk;
}

const readOnlyCache = new Map<string, Wallet>();

export async function getReadOnlyWallet(walletAddress: string): Promise<Wallet> {
  const cached = readOnlyCache.get(walletAddress);
  if (cached) return cached;

  const dummySigner = {
    async getPubKey() { return "0x0"; },
    async signRaw(): Promise<[string, string]> { throw new Error("read-only wallet"); },
  };

  const wallet = await getSdk().connectWallet({
    account: { signer: dummySigner as any },
    accountAddress: walletAddress as any,
    feeMode: "user_pays",
    swapProviders: [new AvnuSwapProvider(), new EkuboSwapProvider()],
    dcaProviders: [new AvnuDcaProvider(), new EkuboDcaProvider()],
  });

  readOnlyCache.set(walletAddress, wallet);
  return wallet;
}
