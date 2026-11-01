// ===================
// CryptLink Engineering | 2026
// verify-and-chat-flow.test.ts
// ===================

import { beforeAll, describe, expect, it } from "vitest";

// Lightweight in-memory IndexedDB mock for Vitest Node.js runtime
beforeAll(() => {
  const memoryStore: Record<string, Map<string, unknown>> = {};

  const getStore = (name: string) => {
    if (!memoryStore[name]) memoryStore[name] = new Map();
    return memoryStore[name];
  };

  const fakeDb = {
    transaction: (storeName: string) => ({
      objectStore: () => ({
        get: (key: string) => {
          const req: { onsuccess?: () => void; onerror?: () => void; result?: unknown } = {};
          queueMicrotask(() => {
            req.result = getStore(storeName).get(key);
            req.onsuccess?.();
          });
          return req;
        },
        put: (val: Record<string, unknown>) => {
          const key = (val.peer_id || val.id || val.userId || JSON.stringify(val)) as string;
          getStore(storeName).set(key, val);
          const req: { onsuccess?: () => void; onerror?: () => void; result?: unknown } = {};
          queueMicrotask(() => {
            req.result = key;
            req.onsuccess?.();
          });
          return req;
        },
        delete: (key: string) => {
          getStore(storeName).delete(key);
          const req: { onsuccess?: () => void; onerror?: () => void } = {};
          queueMicrotask(() => {
            req.onsuccess?.();
          });
          return req;
        },
      }),
    }),
  };

  (globalThis as unknown as Record<string, unknown>).indexedDB = {
    open: () => {
      const req: {
        onsuccess?: () => void;
        onerror?: () => void;
        result?: unknown;
      } = {
        result: fakeDb,
      };
      queueMicrotask(() => {
        req.onsuccess?.();
      });
      return req;
    },
  };
});

import {
  pinOrVerifyPeerIdentity,
  getPinnedIdentity,
  setPeerVerificationStatus,
} from "./key-store";
import {
  generateIdentityKeyPair,
  generateSignedPreKey,
  generateOneTimePreKeys,
  initiateX3DH,
  receiveX3DH,
} from "./x3dh";
import {
  initializeRatchetSender,
  initializeRatchetReceiver,
  encryptMessage,
  decryptMessage,
} from "./double-ratchet";
import {
  base64ToBytes,
  bytesToBase64,
  importX25519PrivateKey,
  importX25519PublicKey,
} from "./primitives";
import type { PreKeyBundle } from "../types";

describe("Peer Verification and E2EE Chat Flow Integration", () => {
  it("should successfully verify peer, exchange X3DH, and decrypt messages without false MitM error", async () => {
    // 1. Generate keys for Alice and Bob
    const aliceId = "alice-uuid-001";
    const bobId = "bob-uuid-002";

    const aliceIdentity = await generateIdentityKeyPair();
    const bobIdentity = await generateIdentityKeyPair();

    const bobSignedPreKey = await generateSignedPreKey(bobIdentity.ed25519_private);
    const [bobOPK] = await generateOneTimePreKeys(1);

    const bobBundle: PreKeyBundle = {
      identity_key: bobIdentity.x25519_public,
      identity_key_ed25519: bobIdentity.ed25519_public,
      signed_prekey: bobSignedPreKey.public_key,
      signed_prekey_signature: bobSignedPreKey.signature,
      one_time_prekey: bobOPK.public_key,
    };

    // 2. Alice inspects Bob's public identity (e.g. opens SAS modal or audit tab)
    const alicePinResult = await pinOrVerifyPeerIdentity(
      bobId,
      bobBundle.identity_key,
      bobBundle.identity_key_ed25519
    );
    expect(alicePinResult.status).toBe("trusted");

    // 3. Alice clicks 'MARK AS VERIFIED' for Bob
    await setPeerVerificationStatus(bobId, true);
    const alicePinnedBob = await getPinnedIdentity(bobId);
    expect(alicePinnedBob?.status).toBe("verified");
    expect(alicePinnedBob?.is_verified).toBe(true);

    // 4. Bob receives 'identity_verified' notification and pins/verifies Alice
    const bobPinResult = await pinOrVerifyPeerIdentity(
      aliceId,
      aliceIdentity.x25519_public,
      aliceIdentity.ed25519_public
    );
    expect(bobPinResult.status).toBe("trusted");
    await setPeerVerificationStatus(aliceId, true);
    const bobPinnedAlice = await getPinnedIdentity(aliceId);
    expect(bobPinnedAlice?.status).toBe("verified");

    // 5. Alice initiates X3DH and encrypts first message to Bob
    const aliceX3DH = await initiateX3DH(aliceIdentity, bobBundle);
    const peerSignedPrekeyBytes = base64ToBytes(bobBundle.signed_prekey);

    const aliceRatchet = await initializeRatchetSender(
      bobId,
      aliceX3DH.shared_key,
      peerSignedPrekeyBytes
    );

    const messageText = "Top Secret: CryptLink Operational Alpha";
    const plaintextBytes = new TextEncoder().encode(messageText);
    const encryptedByAlice = await encryptMessage(aliceRatchet, plaintextBytes);

    // 6. Bob receives the message with X3DH header
    // Bob verifies incoming sender identity key (X25519 only, as provided by X3DH header)
    const bobIncomingPinCheck = await pinOrVerifyPeerIdentity(
      aliceId,
      aliceIdentity.x25519_public
    );
    // MUST NOT be marked compromised! Must retain 'verified' status!
    expect(bobIncomingPinCheck.status).toBe("verified");

    // Bob completes X3DH
    const bobSharedKey = await receiveX3DH(
      bobIdentity,
      bobSignedPreKey,
      bobOPK,
      aliceIdentity.x25519_public,
      aliceX3DH.ephemeral_public_key
    );

    // Bob initializes receiver ratchet
    const signedPreKeyPrivate = await importX25519PrivateKey(
      base64ToBytes(bobSignedPreKey.private_key)
    );
    const signedPreKeyPublic = await importX25519PublicKey(
      base64ToBytes(bobSignedPreKey.public_key)
    );
    const signedPreKeyPair: CryptoKeyPair = {
      privateKey: signedPreKeyPrivate,
      publicKey: signedPreKeyPublic,
    };

    const bobRatchet = await initializeRatchetReceiver(
      aliceId,
      bobSharedKey,
      signedPreKeyPair
    );

    // Bob decrypts Alice's message
    const bobDecryptedBytes = await decryptMessage(bobRatchet, encryptedByAlice);
    const bobDecryptedText = new TextDecoder().decode(bobDecryptedBytes);
    expect(bobDecryptedText).toBe(messageText);

    // 7. Bob replies to Alice using Double Ratchet
    const replyText = "Acknowledged Alpha: Decryption 100% Successful";
    const replyPlaintextBytes = new TextEncoder().encode(replyText);
    const encryptedByBob = await encryptMessage(bobRatchet, replyPlaintextBytes);

    // Alice decrypts Bob's reply
    const aliceDecryptedBytes = await decryptMessage(aliceRatchet, encryptedByBob);
    const aliceDecryptedText = new TextDecoder().decode(aliceDecryptedBytes);
    expect(aliceDecryptedText).toBe(replyText);

    // 8. Test True MitM Detection: If an attacker substitutes an identity key
    const attackerFakeKey = bytesToBase64(new Uint8Array(32).fill(0xee));
    const mitmCheck = await pinOrVerifyPeerIdentity(bobId, attackerFakeKey);
    expect(mitmCheck.status).toBe("compromised");
  });
});
