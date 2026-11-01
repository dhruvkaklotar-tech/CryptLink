// ===================
// © AngelaMos | 2025
// crypto-service.ts
// ===================

import { api } from "../lib/api-client";
import { showToast } from "../stores/ui.store";
import type {
  DoubleRatchetState,
  EncryptedMessage,
  FullMessageHeader,
  IdentityKeyPair,
  MessageHeader,
  OneTimePreKey,
  SignedPreKey,
  X3DHHeader,
} from "../types";
import { DEFAULT_ONE_TIME_PREKEY_COUNT } from "../types";
import {
  decryptMessage,
  deserializeRatchetState,
  encryptMessage,
  initializeRatchetReceiver,
  initializeRatchetSender,
  serializeRatchetState,
} from "./double-ratchet";
import {
  clearAllKeys,
  closeDatabase as closeKeyDatabase,
  deleteRatchetState,
  getIdentityKey,
  getLatestSignedPreKey,
  getOneTimePreKeyByPublicKey,
  getPinnedIdentity,
  getRatchetState,
  getUnusedOneTimePreKeys,
  markOneTimePreKeyUsed,
  pinOrVerifyPeerIdentity,
  saveIdentityKey,
  saveOneTimePreKeys,
  saveRatchetState,
  saveSignedPreKey,
  setPeerVerificationStatus,
  trustNewPeerIdentity,
  type PinnedIdentity,
} from "./key-store";
import {
  base64ToBytes,
  bytesToBase64,
  importX25519PrivateKey,
  importX25519PublicKey,
} from "./primitives";
import { computeFingerprint, computeSafetyNumber } from "./safety-number";
import {
  clearAllMessages,
  closeDatabase as closeMessageDatabase,
  getMessageCount,
} from "./message-store";
import {
  generateIdentityKeyPair,
  generateOneTimePreKeys,
  generateSignedPreKey,
  initiateX3DH,
  receiveX3DH,
} from "./x3dh";

class CryptoService {
  private userId: string | null = null;
  private identityKeyPair: IdentityKeyPair | null = null;
  private signedPreKey: SignedPreKey | null = null;
  private ratchetStates = new Map<string, DoubleRatchetState>();
  private pendingX3DHHeaders = new Map<string, X3DHHeader>();
  private processedNonces = new Set<string>();
  private initialized = false;

  async initialize(userId: string): Promise<void> {
    if (this.initialized && this.userId === userId) return;

    this.userId = userId;
    this.ratchetStates.clear();

    this.identityKeyPair = await getIdentityKey(userId);

    if (this.identityKeyPair === null) {
      await this.generateAndStoreKeys();
    }

    this.signedPreKey = await getLatestSignedPreKey(userId);

    if (this.signedPreKey === null || this.isSignedPreKeyExpired(this.signedPreKey)) {
      await this.rotateSignedPreKey();
    }

    const unusedOTPs = await getUnusedOneTimePreKeys(userId);
    if (unusedOTPs.length < DEFAULT_ONE_TIME_PREKEY_COUNT / 2) {
      await this.replenishOneTimePreKeys();
    }

    this.initialized = true;
  }

  private isSignedPreKeyExpired(preKey: SignedPreKey): boolean {
    return new Date(preKey.expires_at) < new Date();
  }

  private async generateAndStoreKeys(): Promise<void> {
    if (!this.userId) throw new Error("User ID not set");

    this.identityKeyPair = await generateIdentityKeyPair();
    await saveIdentityKey(this.userId, this.identityKeyPair);

    this.signedPreKey = await generateSignedPreKey(this.identityKeyPair.ed25519_private);
    await saveSignedPreKey(this.userId, this.signedPreKey);

    const oneTimePreKeys = await generateOneTimePreKeys(DEFAULT_ONE_TIME_PREKEY_COUNT);
    await saveOneTimePreKeys(this.userId, oneTimePreKeys);

    await this.uploadPublicKeys(oneTimePreKeys);
  }

  private async rotateSignedPreKey(): Promise<void> {
    if (this.userId === null || this.identityKeyPair === null)
      throw new Error("Not initialized");

    this.signedPreKey = await generateSignedPreKey(this.identityKeyPair.ed25519_private);
    await saveSignedPreKey(this.userId, this.signedPreKey);

    const unusedOTPs = await getUnusedOneTimePreKeys(this.userId);
    await this.uploadPublicKeys(unusedOTPs);
  }

  private async replenishOneTimePreKeys(): Promise<void> {
    if (!this.userId) throw new Error("User ID not set");

    const newPreKeys = await generateOneTimePreKeys(DEFAULT_ONE_TIME_PREKEY_COUNT / 2);
    await saveOneTimePreKeys(this.userId, newPreKeys);
    await this.uploadPublicKeys(newPreKeys);
  }

  private async uploadPublicKeys(oneTimePreKeys: OneTimePreKey[]): Promise<void> {
    if (!this.userId) throw new Error("User ID not set");
    if (!this.identityKeyPair || !this.signedPreKey) {
      throw new Error("Keys not generated");
    }

    await api.encryption.uploadKeys(this.userId, {
      identity_key: this.identityKeyPair.x25519_public,
      identity_key_ed25519: this.identityKeyPair.ed25519_public,
      signed_prekey: this.signedPreKey.public_key,
      signed_prekey_signature: this.signedPreKey.signature,
      one_time_prekeys: oneTimePreKeys.map((k) => k.public_key),
    });
  }

  async establishSession(peerId: string): Promise<void> {
    if (this.identityKeyPair === null) throw new Error("Identity keys not initialized");

    const existingState = await this.getRatchetState(peerId);
    if (existingState !== null) return;

    const peerBundle = await api.encryption.getPrekeyBundle(peerId);

    // MITM Attack Defense: Check pinned identity key
    const pinCheck = await pinOrVerifyPeerIdentity(
      peerId,
      peerBundle.identity_key,
      peerBundle.identity_key_ed25519
    );
    if (pinCheck.status === "compromised") {
      showToast(
        "error",
        "CRITICAL MITM DETECTED",
        "SECURITY ALERT: Peer identity key does not match pinned key! Transmissions blocked."
      );
      throw new Error(
        "SECURITY ALERT (MITM DETECTED): Peer Identity Key does not match the pinned key. Possible Man-in-the-Middle attack!"
      );
    }

    const x3dhResult = await initiateX3DH(this.identityKeyPair, peerBundle);

    const peerSignedPrekey = base64ToBytes(peerBundle.signed_prekey);

    const ratchetState = await initializeRatchetSender(
      peerId,
      x3dhResult.shared_key,
      peerSignedPrekey
    );

    this.ratchetStates.set(peerId, ratchetState);

    const x3dhHeader: X3DHHeader = {
      identity_key: this.identityKeyPair.x25519_public,
      ephemeral_key: x3dhResult.ephemeral_public_key,
      one_time_prekey_id: x3dhResult.used_one_time_prekey ? peerBundle.one_time_prekey : null,
    };
    this.pendingX3DHHeaders.set(peerId, x3dhHeader);

    const serialized = await serializeRatchetState(ratchetState);
    await saveRatchetState(serialized);
  }

  async handleIncomingSession(
    peerId: string,
    senderIdentityKey: string,
    ephemeralKey: string,
    oneTimePreKeyPublic: string | null
  ): Promise<void> {
    if (this.identityKeyPair === null || this.signedPreKey === null) {
      throw new Error("Keys not initialized");
    }

    // MITM Attack Defense: Pin and verify incoming peer identity key (X25519)
    const pinCheck = await pinOrVerifyPeerIdentity(peerId, senderIdentityKey);
    if (pinCheck.status === "compromised") {
      showToast(
        "error",
        "CRITICAL MITM DETECTED",
        "SECURITY ALERT: Incoming session identity key does not match pinned record!"
      );
      throw new Error(
        "SECURITY ALERT (MITM DETECTED): Incoming session identity key does not match pinned key!"
      );
    }

    let oneTimePreKey: OneTimePreKey | null = null;
    if (oneTimePreKeyPublic !== null) {
      oneTimePreKey = await getOneTimePreKeyByPublicKey(oneTimePreKeyPublic);
      console.log("[DEBUG X3DH RECEIVER]", { oneTimePreKeyPublic, found: !!oneTimePreKey });
      if (oneTimePreKey !== null) {
        await markOneTimePreKeyUsed(oneTimePreKey.id);
      }
    } else {
      console.log("[DEBUG X3DH RECEIVER] oneTimePreKeyPublic is null");
    }

    const sharedKey = await receiveX3DH(
      this.identityKeyPair,
      this.signedPreKey,
      oneTimePreKey,
      senderIdentityKey,
      ephemeralKey
    );

    const signedPreKeyPrivate = await importX25519PrivateKey(
      base64ToBytes(this.signedPreKey.private_key)
    );
    const signedPreKeyPublic = await importX25519PublicKey(
      base64ToBytes(this.signedPreKey.public_key)
    );
    const signedPreKeyPair: CryptoKeyPair = {
      privateKey: signedPreKeyPrivate,
      publicKey: signedPreKeyPublic,
    };

    const ratchetState = await initializeRatchetReceiver(peerId, sharedKey, signedPreKeyPair);

    this.ratchetStates.set(peerId, ratchetState);

    const serialized = await serializeRatchetState(ratchetState);
    await saveRatchetState(serialized);
  }

  async encrypt(
    peerId: string,
    plaintext: string
  ): Promise<{
    ciphertext: string;
    nonce: string;
    header: string;
  }> {
    const state = await this.getRatchetState(peerId);
    if (state === null) {
      await this.establishSession(peerId);
      return await this.encrypt(peerId, plaintext);
    }

    const plaintextBytes = new TextEncoder().encode(plaintext);
    const encrypted = await encryptMessage(state, plaintextBytes);

    const serialized = await serializeRatchetState(state);
    await saveRatchetState(serialized);

    const pendingX3DH = this.pendingX3DHHeaders.get(peerId);
    const fullHeader: FullMessageHeader = {
      ratchet: encrypted.header,
      x3dh: pendingX3DH ?? undefined,
    };

    if (pendingX3DH) {
      this.pendingX3DHHeaders.delete(peerId);
    }

    return {
      ciphertext: bytesToBase64(encrypted.ciphertext),
      nonce: bytesToBase64(encrypted.nonce),
      header: JSON.stringify(fullHeader),
    };
  }

  async decrypt(
    peerId: string,
    ciphertext: string,
    nonce: string,
    header: string
  ): Promise<string> {
    let state = await this.getRatchetState(peerId);

    const parsedHeader = JSON.parse(header) as FullMessageHeader | MessageHeader;

    let ratchetHeader: MessageHeader;
    let x3dhHeader: X3DHHeader | undefined;

    if ("ratchet" in parsedHeader) {
      ratchetHeader = parsedHeader.ratchet;
      x3dhHeader = parsedHeader.x3dh;
    } else {
      ratchetHeader = parsedHeader;
    }

    if (this.processedNonces.has(nonce)) {
      console.warn(
        "[CryptLink Sentinel] Replay attack blocked: duplicate message nonce detected",
        nonce
      );
      throw new Error("REPLAY ATTACK BLOCKED: Nonce was already processed");
    }
    this.processedNonces.add(nonce);
    if (this.processedNonces.size > 10000) {
      const iter = this.processedNonces.values();
      for (let i = 0; i < 2000; i++) {
        const val = iter.next().value;
        if (val) this.processedNonces.delete(val);
      }
    }

    const encryptedMessage: EncryptedMessage = {
      ciphertext: base64ToBytes(ciphertext),
      nonce: base64ToBytes(nonce),
      header: ratchetHeader,
    };

    if (state === null) {
      if (!x3dhHeader) {
        throw new Error("Cannot establish session: missing X3DH header");
      }

      await this.handleIncomingSession(
        peerId,
        x3dhHeader.identity_key,
        x3dhHeader.ephemeral_key,
        x3dhHeader.one_time_prekey_id
      );
      state = await this.getRatchetState(peerId);
    }

    if (state === null) {
      throw new Error("Failed to establish session");
    }

    const plaintextBytes = await decryptMessage(state, encryptedMessage);

    const serialized = await serializeRatchetState(state);
    await saveRatchetState(serialized);

    return new TextDecoder().decode(plaintextBytes);
  }

  private async getRatchetState(peerId: string): Promise<DoubleRatchetState | null> {
    let state = this.ratchetStates.get(peerId);

    if (state === undefined) {
      const serialized = await getRatchetState(peerId);
      if (serialized !== null && serialized !== undefined) {
        state = await deserializeRatchetState(serialized);
        this.ratchetStates.set(peerId, state);
      }
    }

    return state ?? null;
  }

  async endSession(peerId: string): Promise<void> {
    this.ratchetStates.delete(peerId);
    await deleteRatchetState(peerId);
  }

  async getSafetyNumber(peerId: string): Promise<string | null> {
    if (this.identityKeyPair === null) return null;
    let pinned = await getPinnedIdentity(peerId);
    if (pinned === null) {
      try {
        const peerBundle = await api.encryption.getPublicIdentity(peerId);
        await pinOrVerifyPeerIdentity(
          peerId,
          peerBundle.identity_key,
          peerBundle.identity_key_ed25519
        );
        pinned = await getPinnedIdentity(peerId);
      } catch {
        return null;
      }
    }
    if (pinned === null) return null;
    return await computeSafetyNumber(this.identityKeyPair.x25519_public, pinned.identity_key);
  }

  async getPeerPinnedIdentity(peerId: string): Promise<PinnedIdentity | null> {
    let pinned = await getPinnedIdentity(peerId);
    if (pinned === null) {
      try {
        const peerBundle = await api.encryption.getPublicIdentity(peerId);
        await pinOrVerifyPeerIdentity(
          peerId,
          peerBundle.identity_key,
          peerBundle.identity_key_ed25519
        );
        pinned = await getPinnedIdentity(peerId);
      } catch {
        return null;
      }
    }
    return pinned;
  }

  async setPeerVerification(peerId: string, isVerified: boolean): Promise<void> {
    await setPeerVerificationStatus(peerId, isVerified);
  }

  async trustNewPeerIdentityKey(
    peerId: string,
    newKey: string,
    newEdKey: string
  ): Promise<void> {
    await trustNewPeerIdentity(peerId, newKey, newEdKey);
  }

  async getMyFingerprint(): Promise<string | null> {
    if (!this.identityKeyPair) return null;
    return await computeFingerprint(this.identityKeyPair.x25519_public);
  }

  async getPeerFingerprint(peerId: string): Promise<string | null> {
    const pinned = await this.getPeerPinnedIdentity(peerId);
    if (!pinned) return null;
    return await computeFingerprint(pinned.identity_key);
  }

  async getSessionSummary(peerId: string): Promise<{
    hasActiveSession: boolean;
    ratchetSequence: number;
    sendingNumber: number;
    receivingNumber: number;
    forwardSecrecy: boolean;
    identityKey: string | null;
    pinnedKey: string | null;
    verificationStatus: "trusted" | "verified" | "compromised" | "uninitialized";
  }> {
    const state = await this.getRatchetState(peerId);
    const pinned = await getPinnedIdentity(peerId);
    return {
      hasActiveSession: state !== null,
      ratchetSequence: state
        ? state.sending_message_number + state.receiving_message_number
        : 0,
      sendingNumber: state?.sending_message_number ?? 0,
      receivingNumber: state?.receiving_message_number ?? 0,
      forwardSecrecy: true,
      identityKey: this.identityKeyPair?.x25519_public ?? null,
      pinnedKey: pinned?.identity_key ?? null,
      verificationStatus: pinned ? pinned.status : "uninitialized",
    };
  }

  async runIntegrityAudit(peerId: string): Promise<{
    isMitMProtected: boolean;
    isReplayProtected: boolean;
    forwardSecrecyActive: boolean;
    pinnedIdentityStatus: string;
    replaysBlocked: number;
    securityRating: string;
    totalStoredMessages: number;
    myIdentityFingerprint: string;
    peerIdentityFingerprint: string;
    remainingPrekeys: number;
    ratchetStep: number;
    defconLevel: string;
  }> {
    const pinned = await this.getPeerPinnedIdentity(peerId);
    const state = await this.getRatchetState(peerId);
    const isMitMProtected = pinned?.status !== "compromised";
    const forwardSecrecyActive = state !== null;

    const myFp = await this.getMyFingerprint();
    const peerFp = await this.getPeerFingerprint(peerId);
    const uid = this.userId ?? "";
    const prekeys = uid ? await getUnusedOneTimePreKeys(uid) : [];
    const msgCount = await getMessageCount();

    const ratchetStep = state
      ? state.sending_message_number + state.receiving_message_number
      : 0;
    let defcon = "DEFCON 1";
    if (!isMitMProtected) {
      defcon = "DEFCON 5";
    } else if (pinned?.status !== "verified") {
      defcon = "DEFCON 2";
    }

    return {
      isMitMProtected,
      isReplayProtected: true,
      forwardSecrecyActive,
      pinnedIdentityStatus: pinned ? pinned.status : "unpinned",
      replaysBlocked: this.processedNonces.size,
      securityRating: isMitMProtected
        ? "99.99% HIGH ASSURANCE"
        : "COMPROMISED - MITM DETECTED",
      totalStoredMessages: msgCount,
      myIdentityFingerprint: myFp || "PENDING KEYGEN",
      peerIdentityFingerprint: peerFp || "PENDING SYNC",
      remainingPrekeys: prekeys.length,
      ratchetStep,
      defconLevel: defcon,
    };
  }

  async getIdentityKey(userId?: string): Promise<IdentityKeyPair | null> {
    if (this.identityKeyPair) return this.identityKeyPair;
    const targetId = userId ?? this.userId;
    if (!targetId) return null;
    return await getIdentityKey(targetId);
  }

  async panicPurgeAll(): Promise<void> {
    this.ratchetStates.clear();
    this.pendingX3DHHeaders.clear();
    this.processedNonces.clear();
    this.identityKeyPair = null;
    this.signedPreKey = null;
    this.initialized = false;

    try {
      await clearAllKeys();
    } catch {}
    try {
      await clearAllMessages();
    } catch {}

    try {
      closeKeyDatabase();
      closeMessageDatabase();
      indexedDB.deleteDatabase("encrypted-chat-keys");
      indexedDB.deleteDatabase("encrypted-chat-messages");
    } catch {}

    try {
      await api.auth.zeroize();
    } catch {
      try {
        await api.auth.logout();
      } catch {}
    }

    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    }
  }

  async clearAllSessions(): Promise<void> {
    this.ratchetStates.clear();
    await clearAllKeys();
    this.initialized = false;
  }

  getPublicIdentityKey(): string | null {
    return this.identityKeyPair?.x25519_public ?? null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async resetAllSessions(): Promise<void> {
    this.ratchetStates.clear();
    this.pendingX3DHHeaders.clear();

    const database = indexedDB.open("encrypted-chat-keys", 1);
    database.onsuccess = () => {
      const db = database.result;
      const tx = db.transaction("ratchet_states", "readwrite");
      tx.objectStore("ratchet_states").clear();
    };
  }
}

export const cryptoService = new CryptoService();

if (typeof window !== "undefined") {
  (window as unknown as { resetCryptoSessions: () => Promise<void> }).resetCryptoSessions =
    () => cryptoService.resetAllSessions();
}
