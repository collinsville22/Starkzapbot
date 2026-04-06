import "dotenv/config";
import Database from "better-sqlite3";
import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../packages/backend/starkzap.db");

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex || keyHex.length < 64) throw new Error("ENCRYPTION_KEY required (64-char hex)");
  return Buffer.from(keyHex.slice(0, 64), "hex");
}

function decryptLegacy(stored: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encHex] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")) + decipher.final("utf8");
}

function deriveUserKey(telegramId: number): Buffer {
  const salt = Buffer.from(`starkzap-user-${telegramId}`, "utf8");
  const info = Buffer.from("starkzap-wallet-key", "utf8");
  return Buffer.from(hkdfSync("sha256", getKey(), salt, info, 32));
}

function encryptWithHKDF(plaintext: string, telegramId: number): string {
  const key = deriveUserKey(telegramId);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc.toString("hex")}`;
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

interface UserRow { id: number; telegram_id: number; encrypted_private_key: string; }

const users = db.prepare("SELECT id, telegram_id, encrypted_private_key FROM users").all() as UserRow[];
process.stdout.write(`Found ${users.length} users to migrate.\n`);

if (users.length === 0) { db.close(); process.exit(0); }

const update = db.prepare("UPDATE users SET encrypted_private_key = ? WHERE id = ?");

const migrate = db.transaction(() => {
  let ok = 0, skip = 0;
  for (const u of users) {
    try {
      const pk = decryptLegacy(u.encrypted_private_key);
      const reenc = encryptWithHKDF(pk, u.telegram_id);
      update.run(reenc, u.id);
      ok++;
      process.stdout.write(`  [OK] user ${u.telegram_id}\n`);
    } catch (err: any) {
      skip++;
      process.stderr.write(`  [SKIP] user ${u.telegram_id}: ${err.message}\n`);
    }
  }
  process.stdout.write(`\nDone: ${ok} migrated, ${skip} skipped.\n`);
});

migrate();
db.close();
