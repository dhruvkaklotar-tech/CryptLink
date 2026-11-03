// ===================
// CryptLink Engineering | 2026
// primitives.ts - Core Cryptographic Primitives
// ===================
import { base64UrlDecode, base64UrlEncode } from "../lib/base64";
import {
  AES_GCM_KEY_SIZE,
  AES_GCM_NONCE_SIZE,
  HKDF_OUTPUT_SIZE,
  X25519_KEY_SIZE,
} from "../types";

const crypto = globalThis.crypto;
const subtle = crypto.subtle;

/**
 * Safely extracts an independent ArrayBuffer view copy from a Uint8Array.
 * Prevents SubtleCrypto buffer slice/offset corruption when dealing with
 * sliced views, HKDF keys, or concatenated buffers.
 */
export function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buf).set(arr);
  return buf;
}

export async function generateX25519KeyPair(): Promise<CryptoKeyPair> {
  const keyPair = (await subtle.generateKey(
    {
      name: "X25519",
    },
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;
  return keyPair;
}

export async function x25519DeriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<Uint8Array> {
  const sharedBits = await subtle.deriveBits(
    {
      name: "X25519",
      public: publicKey,
    },
    privateKey,
    X25519_KEY_SIZE * 8
  );
  return new Uint8Array(sharedBits);
}

export async function importX25519PublicKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  if (keyBytes.length === 32) {
    return await subtle.importKey(
      "raw",
      toArrayBuffer(keyBytes),
      { name: "X25519" },
      true,
      []
    );
  }
  return await subtle.importKey(
    "spki",
    toArrayBuffer(keyBytes),
    { name: "X25519" },
    true,
    []
  );
}

export async function importX25519PrivateKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  if (keyBytes.length === 32) {
    return await subtle.importKey(
      "raw",
      toArrayBuffer(keyBytes),
      { name: "X25519" },
      true,
      ["deriveBits"]
    );
  }
  return await subtle.importKey(
    "pkcs8",
    toArrayBuffer(keyBytes),
    { name: "X25519" },
    true,
    ["deriveBits"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await subtle.exportKey("spki", key);
  return new Uint8Array(exported);
}

export async function exportPrivateKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await subtle.exportKey("pkcs8", key);
  return new Uint8Array(exported);
}

export async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  return await subtle.generateKey(
    {
      name: "Ed25519",
    },
    true,
    ["sign", "verify"]
  );
}

export async function ed25519Sign(
  privateKey: CryptoKey,
  data: Uint8Array
): Promise<Uint8Array> {
  const signature = await subtle.sign(
    {
      name: "Ed25519",
    },
    privateKey,
    toArrayBuffer(data)
  );
  return new Uint8Array(signature);
}

export async function ed25519Verify(
  publicKey: CryptoKey,
  signature: Uint8Array,
  data: Uint8Array
): Promise<boolean> {
  return await subtle.verify(
    {
      name: "Ed25519",
    },
    publicKey,
    toArrayBuffer(signature),
    toArrayBuffer(data)
  );
}

export async function importEd25519PublicKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  if (keyBytes.length === 32) {
    return await subtle.importKey(
      "raw",
      toArrayBuffer(keyBytes),
      { name: "Ed25519" },
      true,
      ["verify"]
    );
  }
  return await subtle.importKey(
    "spki",
    toArrayBuffer(keyBytes),
    { name: "Ed25519" },
    true,
    ["verify"]
  );
}

export async function importEd25519PrivateKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  if (keyBytes.length === 32) {
    return await subtle.importKey(
      "raw",
      toArrayBuffer(keyBytes),
      { name: "Ed25519" },
      true,
      ["sign"]
    );
  }
  return await subtle.importKey(
    "pkcs8",
    toArrayBuffer(keyBytes),
    { name: "Ed25519" },
    true,
    ["sign"]
  );
}

export async function hkdfDerive(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  outputLength: number = HKDF_OUTPUT_SIZE
): Promise<Uint8Array> {
  const baseKey = await subtle.importKey(
    "raw",
    toArrayBuffer(inputKeyMaterial),
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(info),
    },
    baseKey,
    outputLength * 8
  );

  return new Uint8Array(derivedBits);
}

export async function hkdfDeriveKey(
  inputKeyMaterial: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await subtle.importKey(
    "raw",
    toArrayBuffer(inputKeyMaterial),
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );

  return await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(info),
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: AES_GCM_KEY_SIZE * 8,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function aesGcmEncrypt(
  key: CryptoKey | Uint8Array,
  plaintext: Uint8Array,
  associatedData?: Uint8Array
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  let cryptoKey: CryptoKey;

  if (key instanceof Uint8Array) {
    cryptoKey = await subtle.importKey(
      "raw",
      toArrayBuffer(key),
      { name: "AES-GCM", length: AES_GCM_KEY_SIZE * 8 },
      false,
      ["encrypt"]
    );
  } else {
    cryptoKey = key;
  }

  const nonce = generateRandomBytes(AES_GCM_NONCE_SIZE);

  const ciphertext = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: associatedData ? toArrayBuffer(associatedData) : undefined,
    },
    cryptoKey,
    toArrayBuffer(plaintext)
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    nonce,
  };
}

export async function aesGcmDecrypt(
  key: CryptoKey | Uint8Array,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  associatedData?: Uint8Array
): Promise<Uint8Array> {
  let cryptoKey: CryptoKey;

  if (key instanceof Uint8Array) {
    cryptoKey = await subtle.importKey(
      "raw",
      toArrayBuffer(key),
      { name: "AES-GCM", length: AES_GCM_KEY_SIZE * 8 },
      false,
      ["decrypt"]
    );
  } else {
    cryptoKey = key;
  }

  const plaintext = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(nonce),
      additionalData: associatedData ? toArrayBuffer(associatedData) : undefined,
    },
    cryptoKey,
    toArrayBuffer(ciphertext)
  );

  return new Uint8Array(plaintext);
}

export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await subtle.digest("SHA-256", toArrayBuffer(data));
  return new Uint8Array(hash);
}

export async function sha512(data: Uint8Array): Promise<Uint8Array> {
  const hash = await subtle.digest("SHA-512", toArrayBuffer(data));
  return new Uint8Array(hash);
}

export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await subtle.importKey(
    "raw",
    toArrayBuffer(key),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await subtle.sign("HMAC", cryptoKey, toArrayBuffer(data));
  return new Uint8Array(signature);
}

export async function hmacSha256Verify(
  key: Uint8Array,
  signature: Uint8Array,
  data: Uint8Array
): Promise<boolean> {
  const cryptoKey = await subtle.importKey(
    "raw",
    toArrayBuffer(key),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["verify"]
  );

  return await subtle.verify(
    "HMAC",
    cryptoKey,
    toArrayBuffer(signature),
    toArrayBuffer(data)
  );
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return base64UrlEncode(bytes);
}

export function base64ToBytes(base64: string): Uint8Array {
  return base64UrlDecode(base64);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}
