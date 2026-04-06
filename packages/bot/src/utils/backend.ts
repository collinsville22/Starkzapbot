import { createHmac } from "node:crypto";

function getBackendUrl() {
  return process.env.BACKEND_URL || "http://localhost:3001";
}

function getBotToken() {
  const token = process.env.BOT_TOKEN || "";
  if (!token) return "";
  return token;
}

/**
 * Sign a bot auth request with HMAC-SHA256 instead of sending the raw token.
 * The signature proves possession of the bot token without transmitting it.
 */
function signBotAuth(telegramId: number, timestamp: number): string {
  const botToken = getBotToken();
  const message = `bot:${telegramId}:${timestamp}`;
  return createHmac("sha256", botToken).update(message).digest("hex");
}

export async function botAuth(telegramId: number): Promise<string | null> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signBotAuth(telegramId, timestamp);
    const initData = `bot-hmac:${telegramId}:${timestamp}:${signature}`;
    const res = await fetch(`${getBackendUrl()}/auth/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.token;
  } catch {
    return null;
  }
}

export async function botApi(token: string, path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${getBackendUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> || {}),
    },
  });
  return res.json();
}

export async function botPublicApi(path: string): Promise<any> {
  const res = await fetch(`${getBackendUrl()}${path}`);
  return res.json();
}
