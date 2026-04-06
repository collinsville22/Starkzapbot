import { ec, encode, hash } from "starknet";

const OZ_CLASS_HASH = "0x01d1777db36cdd06dd62cfde77b1b6ae06412af95d57a13dc40ac77b8a702381";
const PBKDF2_ITERATIONS = 600_000;

async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptWithPin(plaintext: string, pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPin(pin, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return Array.from(result).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function decryptWithPin(hexData: string, pin: string): Promise<string> {
  const data = new Uint8Array(hexData.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const ciphertext = data.slice(28);
  const key = await deriveKeyFromPin(pin, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

export function generateStarkPrivateKey(): string {
  return "0x" + encode.buf2hex(ec.starkCurve.utils.randomPrivateKey());
}

export function getPublicKey(privateKey: string): string {
  return ec.starkCurve.getStarkKey(privateKey);
}

export function computeWalletAddress(publicKey: string): string {
  return hash.calculateContractAddressFromHash(
    publicKey,
    OZ_CLASS_HASH,
    [publicKey],
    0
  );
}
