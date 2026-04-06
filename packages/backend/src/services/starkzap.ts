import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "node:crypto";
import {
  StarkZap,
  StarkSigner,
  type Wallet,
  AvnuSwapProvider,
  EkuboSwapProvider,
  AvnuDcaProvider,
  EkuboDcaProvider,
} from "starkzap";
import { ec } from "starknet";
import { log } from "../utils/logger.js";
let sdk: StarkZap | null = null;

export function getSdk(): StarkZap {
  if (!sdk) {
    const network = (process.env.STARKNET_NETWORK || "mainnet") as "mainnet" | "sepolia";
    const rpcUrl = process.env.STARKNET_RPC_URL;
    log.info("starkzap", `Initializing SDK on ${network}${rpcUrl ? ` with RPC: ${rpcUrl}` : ""}`);
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

const walletCache = new Map<number, Wallet>();

export async function getWalletForUser(
  telegramId: number,
  encryptedKey: string
): Promise<Wallet> {
  const cached = walletCache.get(telegramId);
  if (cached) return cached;

  const privateKey = decryptPrivateKey(encryptedKey, telegramId);
  log.info("starkzap", `Connecting wallet for telegram user ${telegramId}`);

  const wallet = await getSdk().connectWallet({
    account: {
      signer: new StarkSigner(privateKey),
    },
    feeMode: "user_pays",
    swapProviders: [new AvnuSwapProvider(), new EkuboSwapProvider()],
    dcaProviders: [new AvnuDcaProvider(), new EkuboDcaProvider()],
  });

  log.info("starkzap", `Wallet address: ${wallet.address}`);

  try {
    await wallet.ensureReady({ deploy: "if_needed" });
    log.info("starkzap", "Wallet ready");
  } catch (err: any) {
    log.warn("starkzap", `ensureReady failed: ${err.message}`);
  }

  walletCache.set(telegramId, wallet);
  return wallet;
}

export function clearWalletCache(telegramId: number) {
  walletCache.delete(telegramId);
}

export async function resolveWalletAddress(encryptedKey: string, telegramId: number): Promise<string> {
  const privateKey = decryptPrivateKey(encryptedKey, telegramId);
  const wallet = await getSdk().connectWallet({
    account: { signer: new StarkSigner(privateKey) },
  });
  return wallet.address as string;
}

export async function createWalletForUser(telegramId: number): Promise<{
  address: string;
  encryptedKey: string;
}> {
  const privateKey = "0x" + randomBytes(31).toString("hex");
  const encryptedKey = encryptPrivateKey(privateKey, telegramId);

  try {
    const wallet = await getSdk().connectWallet({
      account: { signer: new StarkSigner(privateKey) },
    });
    const address = wallet.address as string;
    log.info("starkzap", `Created wallet with address: ${address}`);
    return { address, encryptedKey };
  } catch (err: any) {
    log.warn("starkzap", `Could not compute address, using pubkey: ${err.message}`);
    const publicKey = ec.starkCurve.getStarkKey(privateKey);
    return { address: publicKey, encryptedKey };
  }
}

function getMasterKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 64) {
    throw new Error("ENCRYPTION_KEY environment variable must be a 64-char hex string");
  }
  return Buffer.from(keyHex.slice(0, 64), "hex");
}

/**
 * Derive a per-user AES-256 key using HKDF with the master key + user-specific salt.
 */
export function deriveUserKey(telegramId: number): Buffer {
  const masterKey = getMasterKey();
  const salt = `starkzap-user-${telegramId}`;
  return Buffer.from(
    hkdfSync("sha256", masterKey, salt, "starkzap-wallet-key", 32)
  );
}

/**
 * @deprecated Use the overload with telegramId for per-user key derivation.
 * Kept only for migration: decrypt with the old global key.
 */
export function decryptPrivateKeyLegacy(stored: string): string {
  const key = getMasterKey();
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

export function encryptPrivateKey(privateKey: string, telegramId: number): string {
  const key = deriveUserKey(telegramId);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPrivateKey(stored: string, telegramId: number): string {
  const key = deriveUserKey(telegramId);
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
