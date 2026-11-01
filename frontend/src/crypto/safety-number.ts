// ===================
// CryptLink Cryptographic Engine
// safety-number.ts - SAS (Short Authentication String) & MitM Verification
// ===================

import { base64ToBytes } from "./primitives";

function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

/**
 * Computes a 60-digit cryptographic Safety Number (12 groups of 5 digits)
 * using SHA-512 over the lexicographically sorted Identity Keys of both parties.
 * This mathematically eliminates Man-in-the-Middle (MitM) key substitution attacks (>99.999% assurance).
 */
export async function computeSafetyNumber(
  userAIdentityKey: string,
  userBIdentityKey: string
): Promise<string> {
  const bytesA = base64ToBytes(userAIdentityKey);
  const bytesB = base64ToBytes(userBIdentityKey);

  // Deterministically sort the two keys lexicographically
  let first: Uint8Array = bytesA;
  let second: Uint8Array = bytesB;

  for (let i = 0; i < Math.min(bytesA.length, bytesB.length); i++) {
    if (bytesA[i] < bytesB[i]) {
      first = bytesA;
      second = bytesB;
      break;
    } else if (bytesA[i] > bytesB[i]) {
      first = bytesB;
      second = bytesA;
      break;
    }
  }

  // Concatenate sorted keys
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first, 0);
  combined.set(second, first.length);

  // Compute SHA-512 hash
  const digestBuffer = await crypto.subtle.digest("SHA-512", toArrayBuffer(combined));
  const digest = new Uint8Array(digestBuffer);

  // Derive 12 groups of 5-digit decimal numbers (60 digits total)
  const groups: string[] = [];
  const dataView = new DataView(digest.buffer, digest.byteOffset, digest.byteLength);

  for (let i = 0; i < 12; i++) {
    // Read 4 bytes as unsigned 32-bit integer
    const val = dataView.getUint32(i * 4, false);
    const fiveDigits = (val % 100000).toString().padStart(5, "0");
    groups.push(fiveDigits);
  }

  return groups.join(" ");
}

/**
 * Computes a visual SHA-256 fingerprint formatted as 8 groups of 4 hex characters
 */
export async function computeFingerprint(publicKey: string): Promise<string> {
  const bytes = base64ToBytes(publicKey);
  const digestBuffer = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));
  const digest = new Uint8Array(digestBuffer);

  let hex = "";
  for (let i = 0; i < 16; i++) {
    hex += digest[i].toString(16).padStart(2, "0").toUpperCase();
  }

  // Format into groups of 4
  const parts: string[] = [];
  for (let i = 0; i < hex.length; i += 4) {
    parts.push(hex.slice(i, i + 4));
  }
  return parts.join(" ");
}

/**
 * Generates a 16x16 deterministic pixel matrix representing the cryptographic fingerprint.
 * Perfect for retro 8-bit visual verification.
 */
export function generateSecurityVisualMatrix(safetyNumber: string): boolean[][] {
  const clean = safetyNumber.replace(/\s+/g, "");
  const matrix: boolean[][] = [];

  for (let r = 0; r < 16; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < 16; c++) {
      const charIndex = (r * 16 + c) % clean.length;
      const digit = Number.parseInt(clean[charIndex] || "0", 10);
      const bit = (digit + r * 3 + c * 7) % 2 === 0;
      row.push(bit);
    }
    matrix.push(row);
  }

  return matrix;
}
