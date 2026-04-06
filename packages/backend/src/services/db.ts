import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH || join(__dirname, "../../starkzap.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    const schema = readFileSync(join(__dirname, "../db/schema.sql"), "utf-8");
    db.exec(schema);
  }
  return db;
}

export interface DbUser {
  id: number;
  telegram_id: number;
  username: string | null;
  wallet_address: string;
  encrypted_private_key: string;
  created_at: string;
}

export function getUserByTelegramId(telegramId: number): DbUser | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .get(telegramId) as DbUser | undefined;
}

export function updateUserAddress(telegramId: number, walletAddress: string) {
  getDb()
    .prepare("UPDATE users SET wallet_address = ? WHERE telegram_id = ?")
    .run(walletAddress, telegramId);
}

export function createUser(
  telegramId: number,
  username: string | null,
  walletAddress: string,
  encryptedKey: string
): DbUser {
  const db = getDb();
  db.prepare(
    "INSERT INTO users (telegram_id, username, wallet_address, encrypted_private_key) VALUES (?, ?, ?, ?)"
  ).run(telegramId, username, walletAddress, encryptedKey);
  return getUserByTelegramId(telegramId)!;
}

export function logTransaction(
  userId: number,
  type: string,
  details: string,
  txHash?: string,
  status = "pending"
) {
  getDb()
    .prepare(
      "INSERT INTO transactions (user_id, type, status, tx_hash, details) VALUES (?, ?, ?, ?, ?)"
    )
    .run(userId, type, status, txHash ?? null, details);
}

export function updateTransactionStatus(txHash: string, status: string) {
  getDb()
    .prepare("UPDATE transactions SET status = ? WHERE tx_hash = ?")
    .run(status, txHash);
}

export function getTransactions(userId: number, limit = 50) {
  return getDb()
    .prepare(
      "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(userId, limit) as Array<{
    id: number;
    user_id: number;
    type: string;
    status: string;
    tx_hash: string | null;
    details: string;
    created_at: string;
  }>;
}
