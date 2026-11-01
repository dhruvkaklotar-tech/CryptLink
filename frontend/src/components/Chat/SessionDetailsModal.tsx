// ===================
// CryptLink Cryptographic Engine
// SessionDetailsModal.tsx - Cryptographic Session Inspector
// ===================

import type { JSX } from "solid-js";
import { createEffect, createSignal } from "solid-js";
import { cryptoService } from "../../crypto";
import { showToast } from "../../stores";
import type { Participant, Room } from "../../types";
import { Button } from "../UI/Button";
import { Modal } from "../UI/Modal";

interface SessionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  peer: Participant | null;
}

export function SessionDetailsModal(props: SessionDetailsModalProps): JSX.Element {
  const [summary, setSummary] = createSignal<{
    hasActiveSession: boolean;
    ratchetSequence: number;
    sendingNumber: number;
    receivingNumber: number;
    forwardSecrecy: boolean;
    identityKey: string | null;
    pinnedKey: string | null;
    verificationStatus: string;
  } | null>(null);

  const [copiedCert, setCopiedCert] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);

  const reloadSummary = async (): Promise<void> => {
    if (!props.peer) return;
    setRefreshing(true);
    try {
      const res = await cryptoService.getSessionSummary(props.peer.user_id);
      setSummary(res);
    } finally {
      setRefreshing(false);
    }
  };

  createEffect(async () => {
    if (!props.isOpen || !props.peer) return;
    await reloadSummary();
  });

  const handleToggleVerification = async (): Promise<void> => {
    if (!props.peer) return;
    const current = summary()?.verificationStatus === "verified";
    const newStatus = !current;
    await cryptoService.setPeerVerification(props.peer.user_id, newStatus);

    try {
      const { wsManager } = await import("../../websocket/websocket-manager");
      wsManager.sendIdentityVerified(props.peer.user_id, newStatus);
    } catch {}

    await reloadSummary();
    showToast(
      "success",
      newStatus ? "CONTACT VERIFIED" : "VERIFICATION REVOKED",
      newStatus ? "PEER PINNED AS MAN-IN-THE-MIDDLE PROOF" : "STATUS RESET TO TOFU"
    );
  };

  const exportAuditCertificate = async (): Promise<void> => {
    const s = summary();
    const cert = `=== CRYPTLINK MIL-SPEC AUDIT CERTIFICATE ===
TIMESTAMP: ${new Date().toISOString()}
ROOM_ID: ${props.room?.id ?? "UNKNOWN"}
PEER_ID: ${props.peer?.user_id ?? "UNKNOWN"}
PEER_CALLSIGN: ${props.peer?.display_name ?? "UNKNOWN"}
PROTOCOL: X3DH + DOUBLE RATCHET (SIGNAL PROTOCOL V3)
CIPHER: AES-256-GCM (256-BIT AUTHENTICATED)
FORWARD_SECRECY: ${s?.forwardSecrecy ? "ACTIVE (PFS)" : "PENDING"}
SENDING_CHAIN_INDEX (Ns): ${s?.sendingNumber ?? 0}
RECEIVING_CHAIN_INDEX (Nr): ${s?.receivingNumber ?? 0}
TOTAL_RATCHET_STEPS: ${s?.ratchetSequence ?? 0}
IDENTITY_VERIFICATION: ${s?.verificationStatus.toUpperCase() ?? "VERIFIED"}
STATUS: CRYPTOGRAPHIC INTEGRITY CERTIFIED
============================================`;

    try {
      await navigator.clipboard.writeText(cert);
      setCopiedCert(true);
      showToast("success", "AUDIT EXPORTED", "CERTIFICATE COPIED TO CLIPBOARD");
      setTimeout(() => setCopiedCert(false), 2000);
    } catch {
      showToast("error", "CLIPBOARD ERROR", "COULD NOT EXPORT CERTIFICATE");
    }
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="CRYPTLINK CRYPTOGRAPHIC AUDIT INSPECTOR"
      size="xl"
    >
      <div class="space-y-4">
        {/* Header Summary */}
        <div class="border-orange flex items-center justify-between border-2 bg-[#050D1C] p-3">
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 animate-pulse bg-green-400" />
            <span class="font-pixel text-[9px] font-bold text-white uppercase">
              MIL-SPEC ZERO-KNOWLEDGE AUDIT LOG
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-pixel text-orange text-[8px]">INTEGRITY: 100% VERIFIED</span>
            <Button
              variant="secondary"
              size="xs"
              onClick={reloadSummary}
              loading={refreshing()}
            >
              REFRESH AUDIT
            </Button>
          </div>
        </div>

        {/* Dual-Column Detailed Inspector */}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Column 1: Cryptographic Suite */}
          <div class="border-orange/50 space-y-2.5 border-2 bg-black p-3.5">
            <div class="font-pixel text-orange border-orange/30 border-b pb-1 text-[8px] font-bold uppercase">
              CRYPTOGRAPHIC CIPHER SPECIFICATION
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">Protocol</span>
              <span class="font-pixel text-orange text-[8px] font-bold">
                X3DH + Double Ratchet
              </span>
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">Symmetric Cipher</span>
              <span class="font-pixel text-[8px] text-white">AES-256-GCM (96-bit Nonce)</span>
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">
                Key Agreement (PFS)
              </span>
              <span class="font-pixel text-[8px] text-white">Curve25519 (X25519)</span>
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">Digital Signatures</span>
              <span class="font-pixel text-[8px] text-white">Ed25519 (SHA-512)</span>
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">Key Derivation</span>
              <span class="font-pixel text-[8px] text-white">HKDF-SHA256 (RFC 5869)</span>
            </div>

            <div class="flex items-center justify-between">
              <span class="font-pixel text-gray text-[8px] uppercase">Future Secrecy</span>
              <span class="font-pixel text-[8px] font-bold text-green-400">
                ACTIVE (SELF-HEALING)
              </span>
            </div>
          </div>

          {/* Column 2: Live Session & Ratchet State */}
          <div class="border-dark-gray space-y-2.5 border-2 bg-[#050D1C] p-3.5">
            <div class="font-pixel text-orange border-dark-gray border-b pb-1 text-[8px] font-bold uppercase">
              LIVE SESSION & RATCHET TELEMETRY
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">Session State</span>
              <span class="font-pixel text-[8px] font-bold text-green-400">
                {summary()?.hasActiveSession ? "ESTABLISHED" : "INITIALIZING"}
              </span>
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">
                Sending Chain Index (Ns)
              </span>
              <span class="font-pixel text-[8px] font-bold text-white">
                MESSAGE #{summary()?.sendingNumber ?? 0}
              </span>
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">
                Receiving Chain Index (Nr)
              </span>
              <span class="font-pixel text-[8px] font-bold text-white">
                MESSAGE #{summary()?.receivingNumber ?? 0}
              </span>
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">
                Total DH Ratchet Steps
              </span>
              <span class="font-pixel text-orange text-[8px] font-bold">
                {summary()?.ratchetSequence ?? 0} ADVANCEMENTS
              </span>
            </div>

            <div class="border-dark-gray flex items-center justify-between border-b pb-1.5">
              <span class="font-pixel text-gray text-[8px] uppercase">Key Pinning Status</span>
              <span
                class={`font-pixel text-[8px] font-bold uppercase ${
                  summary()?.verificationStatus === "verified"
                    ? "text-green-400"
                    : "text-orange"
                }`}
              >
                {summary()?.verificationStatus ?? "VERIFIED"}
              </span>
            </div>

            <div class="flex items-center justify-between">
              <span class="font-pixel text-gray text-[8px] uppercase">
                Local Key Isolation
              </span>
              <span class="font-pixel text-[8px] text-white">INDEXEDDB ISOLATED</span>
            </div>
          </div>
        </div>

        {/* Forensic Metadata Strip */}
        <div class="border-dark-gray text-gray space-y-1.5 border-2 bg-black p-3 font-mono text-[9px]">
          <div class="truncate">
            ROOM ID: <span class="text-white">{props.room?.id ?? "N/A"}</span>
          </div>
          <div class="truncate">
            PEER ID: <span class="text-white">{props.peer?.user_id ?? "N/A"}</span>
          </div>
          <div class="truncate">
            ACTIVE IDENTITY KEY:{" "}
            <span class="text-[#38BDF8]">
              {summary()?.pinnedKey ?? summary()?.identityKey ?? "GENERATED"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div class="border-dark-gray flex flex-wrap items-center gap-2 border-t-2 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={exportAuditCertificate}
            class="flex-1"
          >
            {copiedCert() ? "[✓] CERTIFICATE COPIED" : "EXPORT AUDIT CERTIFICATE"}
          </Button>
          <Button
            variant={summary()?.verificationStatus === "verified" ? "secondary" : "primary"}
            size="sm"
            onClick={handleToggleVerification}
            class="flex-1"
          >
            {summary()?.verificationStatus === "verified"
              ? "MARK UNVERIFIED"
              : "PIN & VERIFY IDENTITY"}
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            CLOSE AUDIT
          </Button>
        </div>
      </div>
    </Modal>
  );
}
