import { describe, expect, it } from "vitest";
import {
  computeFingerprint,
  computeSafetyNumber,
  generateSecurityVisualMatrix,
} from "./safety-number";
import { generateIdentityKeyPair } from "./x3dh";

describe("Safety Number & MitM Defense", () => {
  it("computes deterministic 60-digit safety numbers regardless of order", async () => {
    const aliceKeys = await generateIdentityKeyPair();
    const bobKeys = await generateIdentityKeyPair();

    const snAliceToBob = await computeSafetyNumber(
      aliceKeys.x25519_public,
      bobKeys.x25519_public
    );

    const snBobToAlice = await computeSafetyNumber(
      bobKeys.x25519_public,
      aliceKeys.x25519_public
    );

    // Both parties MUST compute the exact same safety number
    expect(snAliceToBob).toBe(snBobToAlice);

    // Formatted in 12 groups of 5 decimal digits
    const groups = snAliceToBob.split(" ");
    expect(groups.length).toBe(12);
    for (const group of groups) {
      expect(group.length).toBe(5);
      expect(/^\d{5}$/.test(group)).toBe(true);
    }
  });

  it("detects MitM substitution: different keys produce completely different safety numbers", async () => {
    const aliceKeys = await generateIdentityKeyPair();
    const bobKeys = await generateIdentityKeyPair();
    const malloryMitMKeys = await generateIdentityKeyPair();

    const realSafetyNumber = await computeSafetyNumber(
      aliceKeys.x25519_public,
      bobKeys.x25519_public
    );

    const compromisedSafetyNumber = await computeSafetyNumber(
      aliceKeys.x25519_public,
      malloryMitMKeys.x25519_public
    );

    expect(realSafetyNumber).not.toBe(compromisedSafetyNumber);
  });

  it("computes visual fingerprint and 16x16 pixel matrix", async () => {
    const keys = await generateIdentityKeyPair();
    const fp = await computeFingerprint(keys.x25519_public);

    expect(fp.split(" ").length).toBe(8);

    const matrix = generateSecurityVisualMatrix("12345 67890 12345 67890");
    expect(matrix.length).toBe(16);
    expect(matrix[0].length).toBe(16);
  });
});
