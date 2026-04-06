import { createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { Context, Next } from "hono";
import { getUserByTelegramId, createUser, updateUserAddress, type DbUser } from "../services/db.js";
import { log } from "../utils/logger.js";

const usedInitDataHashes = new Map<string, number>();
const INIT_DATA_MAX_AGE_SEC = 300;

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [hash, expiry] of usedInitDataHashes) {
    if (now > expiry) usedInitDataHashes.delete(hash);
  }
}, 60_000).unref();

function markInitDataUsed(hash: string): boolean {
  if (usedInitDataHashes.has(hash)) return false;
  usedInitDataHashes.set(hash, Math.floor(Date.now() / 1000) + INIT_DATA_MAX_AGE_SEC + 30);
  return true;
}

const JWT_SECRET_KEY = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is required");
  return new TextEncoder().encode(secret);
};

export function validateInitData(initData: string, botToken: string): { valid: boolean; user?: any } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };

    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (calculatedHash !== hash) return { valid: false };

    const authDate = parseInt(params.get("auth_date") || "0");
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 300) return { valid: false };

    const userStr = params.get("user");
    return { valid: true, user: userStr ? JSON.parse(userStr) : null };
  } catch {
    return { valid: false };
  }
}

export async function issueJwt(telegramId: number): Promise<string> {
  return new SignJWT({ telegramId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET_KEY());
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized", message: "Missing auth token" }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY());
    const telegramId = payload.telegramId as number;

    const user = getUserByTelegramId(telegramId);
    if (!user) {
      return c.json({ error: "unauthorized", message: "User not found" }, 401);
    }

    c.set("user", user);
    await next();
  } catch {
    return c.json({ error: "unauthorized", message: "Invalid or expired token" }, 401);
  }
}

export async function handleAuth(c: Context) {
  const body = await c.req.json<{ initData: string; walletAddress?: string }>();
  const { initData, walletAddress } = body;
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    return c.json({ error: "config", message: "Bot token not configured" }, 500);
  }

  let telegramUser: any;

  if (initData.startsWith("bot-hmac:")) {
    const parts = initData.split(":");
    if (parts.length !== 4) {
      return c.json({ error: "unauthorized", message: "Malformed bot-hmac auth" }, 401);
    }
    const [, tgIdStr, timestampStr, signature] = parts;
    const tgId = parseInt(tgIdStr);
    const timestamp = parseInt(timestampStr);

    const now = Math.floor(Date.now() / 1000);
    if (isNaN(tgId) || isNaN(timestamp) || Math.abs(now - timestamp) > 60) {
      return c.json({ error: "unauthorized", message: "Expired or invalid bot auth" }, 401);
    }

    const expectedMessage = `${tgId}:${timestampStr}`;
    const expectedSig = createHmac("sha256", botToken).update(expectedMessage).digest("hex");
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return c.json({ error: "unauthorized", message: "Invalid bot signature" }, 401);
    }

    if (!markInitDataUsed(`bot-hmac:${tgId}:${timestamp}`)) {
      return c.json({ error: "unauthorized", message: "Bot auth request already used" }, 401);
    }

    const existingUser = getUserByTelegramId(tgId);
    if (existingUser) {
      telegramUser = { id: tgId, username: existingUser.username };
    } else {
      return c.json({ error: "unauthorized", message: "User not found. Open the Mini App first." }, 401);
    }
  } else {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (hash && !markInitDataUsed(hash)) {
      return c.json({ error: "unauthorized", message: "initData already used (replay)" }, 401);
    }

    const result = validateInitData(initData, botToken);
    if (!result.valid || !result.user) {
      return c.json({ error: "unauthorized", message: "Invalid initData" }, 401);
    }
    telegramUser = result.user;
  }

  let user: DbUser | undefined = getUserByTelegramId(telegramUser.id);

  if (!user) {
    if (!walletAddress) {
      return c.json({ error: "no_wallet", message: "Wallet address required for new users" }, 400);
    }
    user = createUser(telegramUser.id, telegramUser.username ?? null, walletAddress);
    log.info("auth", `New user ${telegramUser.id} -> ${walletAddress}`);
  }

  if (walletAddress && walletAddress !== user.wallet_address) {
    updateUserAddress(telegramUser.id, walletAddress);
    user.wallet_address = walletAddress;
  }

  const jwt = await issueJwt(telegramUser.id);

  return c.json({
    token: jwt,
    user: {
      id: user.id,
      telegramId: user.telegram_id,
      username: user.username,
      walletAddress: user.wallet_address,
      createdAt: user.created_at,
    },
  });
}
