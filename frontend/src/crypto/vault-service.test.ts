import { describe, expect, it } from "vitest";
import {
  decryptSecretNote,
  decryptVaultFile,
  encryptSecretNote,
  encryptVaultFile,
  isSecretNote,
  isVaultFile,
} from "./vault-service";

describe("VaultService E2EE file & secret encryption", () => {
  it("encrypts and decrypts secret notes with zero knowledge", async () => {
    const title = "CONFIDENTIAL PASSCODE";
    const content = "DELTA-994-TOP-SECRET";

    const payload = await encryptSecretNote(title, content);
    expect(isSecretNote(payload)).toBe(true);

    const decrypted = await decryptSecretNote(payload);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.title).toBe(title);
    expect(decrypted?.content).toBe(content);
    expect(decrypted?.verified).toBe(true);
  });

  it("detects corrupted or tampered secret notes", async () => {
    const payload = await encryptSecretNote("TEST", "SECRET");
    const tampered = `${payload.slice(0, -5)}AAAA]`;
    const decrypted = await decryptSecretNote(tampered);
    expect(decrypted).toBeNull();
  });

  it("encrypts, decrypts and SHA-256 verifies vault files", async () => {
    const fileContent = "TOP SECRET TACTICAL MISSION DISPATCH 2026";
    const encoder = new TextEncoder();
    const fileBytes = encoder.encode(fileContent);
    const file = new File([fileBytes], "mission_plan.txt", { type: "text/plain" });

    const encrypted = await encryptVaultFile(file);
    expect(isVaultFile(encrypted.payload)).toBe(true);
    expect(encrypted.metadata.fileName).toBe("mission_plan.txt");
    expect(encrypted.metadata.sha256).toBeDefined();

    const decrypted = await decryptVaultFile(encrypted.payload);
    expect(decrypted).not.toBeNull();
    expect(decrypted?.fileName).toBe("mission_plan.txt");
    expect(decrypted?.mimeType).toBe("text/plain");
    expect(decrypted?.verified).toBe(true);

    const text = await decrypted?.blob.text();
    expect(text).toBe(fileContent);
  });
});
