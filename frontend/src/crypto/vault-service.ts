// ===================
// CryptLink Cryptographic Engine
// vault-service.ts - Defense-Grade Zero-Knowledge File & Secret Transfer
// ===================

import { base64ToBytes, bytesToBase64 } from "./primitives";

export interface EncryptedFileMetadata {
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256: string;
}

export interface DecryptedVaultFile {
  blob: Blob;
  fileName: string;
  mimeType: string;
  fileSize: number;
  verified: boolean;
  url: string;
}

export interface DecryptedSecretNote {
  title: string;
  content: string;
  verified: boolean;
}

const VAULT_PREFIX = "[CRYPTLINK_VAULT:v2:";
const LEGACY_VAULT_PREFIX = "[CRYPTLINK_VAULT:v1:";
const SECRET_PREFIX = "[CRYPTLINK_SECRET:v1:";

// Disallow executable, script, or binary loader file extensions
const DANGEROUS_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".scr",
  ".vbs",
  ".js",
  ".msi",
  ".dll",
  ".com",
  ".hta",
  ".cpl",
  ".pif",
  ".jar",
  ".apk",
  ".bin",
];

export const MAX_VAULT_FILE_SIZE = 512 * 1024; // 512 KB safe ceiling for zero-knowledge WebSocket frames

export function sanitizeFileName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
  const extIndex = clean.lastIndexOf(".");
  if (extIndex !== -1) {
    const ext = clean.slice(extIndex).toLowerCase();
    if (DANGEROUS_EXTENSIONS.includes(ext)) {
      throw new Error(`SECURITY RESTRICTION: File type "${ext}" is prohibited.`);
    }
  }
  return clean || "secure_payload.dat";
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

/**
 * Encrypt a file with authenticated AES-256-GCM and SHA-256 integrity validation
 */
export async function encryptVaultFile(
  file: File
): Promise<{ payload: string; metadata: EncryptedFileMetadata }> {
  if (file.size > MAX_VAULT_FILE_SIZE) {
    throw new Error("FILE EXCEEDS MAXIMUM ZERO-KNOWLEDGE PAYLOAD SIZE (512 KB)");
  }

  const safeName = sanitizeFileName(file.name);
  const fileBytes = await file.arrayBuffer();

  // 1. Compute SHA-256 integrity hash of plaintext
  const hashBuffer = await crypto.subtle.digest("SHA-256", fileBytes);
  const sha256 = arrayBufferToHex(hashBuffer);

  // 2. Generate random 256-bit AES-GCM encryption key
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);

  // 3. Generate 96-bit random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 4. Encrypt file with AES-GCM
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    fileBytes
  );

  // 5. Export key
  const rawKey = await crypto.subtle.exportKey("raw", key);

  const keyB64 = bytesToBase64(new Uint8Array(rawKey));
  const ivB64 = bytesToBase64(iv);
  const ciphertextB64 = bytesToBase64(new Uint8Array(ciphertextBuffer));
  const safeMimeType = encodeURIComponent(file.type || "application/octet-stream");

  // Pack into structured token
  const payload = `${VAULT_PREFIX}${encodeURIComponent(safeName)}:${safeMimeType}:${file.size}:${sha256}:${keyB64}:${ivB64}:${ciphertextB64}]`;

  return {
    payload,
    metadata: {
      fileName: safeName,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      sha256,
    },
  };
}

/**
 * Check if a message is an encrypted vault file
 */
export function isVaultFile(content: string): boolean {
  return (
    (content.startsWith(VAULT_PREFIX) || content.startsWith(LEGACY_VAULT_PREFIX)) &&
    content.endsWith("]")
  );
}

/**
 * Check if a message is an encrypted secret note
 */
export function isSecretNote(content: string): boolean {
  return content.startsWith(SECRET_PREFIX) && content.endsWith("]");
}

/**
 * Decrypt a vault file message and verify SHA-256 integrity
 */
export async function decryptVaultFile(payload: string): Promise<DecryptedVaultFile | null> {
  if (!isVaultFile(payload)) return null;

  try {
    const isV2 = payload.startsWith(VAULT_PREFIX);
    const prefix = isV2 ? VAULT_PREFIX : LEGACY_VAULT_PREFIX;
    const raw = payload.slice(prefix.length, -1);
    const parts = raw.split(":");
    if (parts.length < 7) return null;

    const [safeFileName, safeMimeType, sizeStr, sha256, keyB64, ivB64, ciphertextB64] = parts;

    const fileName = sanitizeFileName(decodeURIComponent(safeFileName));
    const mimeType = decodeURIComponent(safeMimeType);
    const fileSize = parseInt(sizeStr, 10);

    const rawKey = base64ToBytes(keyB64);
    const iv = base64ToBytes(ivB64);
    const ciphertext = base64ToBytes(ciphertextB64);

    const key = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(rawKey),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );

    // Verify SHA-256 integrity
    const hashBuffer = await crypto.subtle.digest("SHA-256", decryptedBuffer);
    const computedHash = arrayBufferToHex(hashBuffer);
    const verified = computedHash.toLowerCase() === sha256.toLowerCase();

    if (!verified) {
      console.error("[SECURITY ALERT] Vault file SHA-256 hash mismatch! Possible tampering.");
      return null;
    }

    const blob = new Blob([decryptedBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);

    return {
      blob,
      fileName,
      mimeType,
      fileSize,
      verified,
      url,
    };
  } catch (err) {
    console.error("Vault decryption error:", err);
    return null;
  }
}

/**
 * Encrypt a confidential secret note
 */
export async function encryptSecretNote(title: string, content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify({ title, content }));

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    data
  );
  const rawKey = await crypto.subtle.exportKey("raw", key);

  const keyB64 = bytesToBase64(new Uint8Array(rawKey));
  const ivB64 = bytesToBase64(iv);
  const ciphertextB64 = bytesToBase64(new Uint8Array(ciphertext));

  return `${SECRET_PREFIX}${encodeURIComponent(title)}:${keyB64}:${ivB64}:${ciphertextB64}]`;
}

/**
 * Decrypt a confidential secret note
 */
export async function decryptSecretNote(payload: string): Promise<DecryptedSecretNote | null> {
  if (!isSecretNote(payload)) return null;

  try {
    const raw = payload.slice(SECRET_PREFIX.length, -1);
    const [safeTitle, keyB64, ivB64, ciphertextB64] = raw.split(":");
    const title = decodeURIComponent(safeTitle);

    const rawKey = base64ToBytes(keyB64);
    const iv = base64ToBytes(ivB64);
    const ciphertext = base64ToBytes(ciphertextB64);

    const key = await crypto.subtle.importKey(
      "raw",
      toArrayBuffer(rawKey),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    const parsed = JSON.parse(decoded) as { title: string; content: string };

    return {
      title: parsed.title || title,
      content: parsed.content,
      verified: true,
    };
  } catch {
    return null;
  }
}
