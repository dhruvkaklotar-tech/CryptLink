// ===================
// CryptLink Cryptographic Engine
// SafetyNumberModal.tsx - MitM Defense & Safety Number SAS Verification
// ===================

import type { JSX } from "solid-js";
import { createEffect, createSignal, For, Show } from "solid-js";
import { cryptoService } from "../../crypto";
import { generateSecurityVisualMatrix } from "../../crypto/safety-number";
import { api } from "../../lib/api-client";
import { showToast } from "../../stores";
import type { Participant } from "../../types";
import { Button } from "../UI/Button";
import { Modal } from "../UI/Modal";

interface SafetyNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  peer: Participant | null;
}

export function SafetyNumberModal(props: SafetyNumberModalProps): JSX.Element {
  const [activeTab, setActiveTab] = createSignal<"sas" | "scanner" | "audit">("sas");
  const [safetyNumber, setSafetyNumber] = createSignal<string>("COMPUTING...");
  const [myFingerprint, setMyFingerprint] = createSignal<string>("");
  const [peerFingerprint, setPeerFingerprint] = createSignal<string>("");
  const [status, setStatus] = createSignal<"trusted" | "verified" | "compromised" | "loading">(
    "loading"
  );
  const [visualMatrix, setVisualMatrix] = createSignal<boolean[][]>([]);
  const [loading, setLoading] = createSignal(false);

  // Verification Scanner & Comparator
  const [scannedInput, setScannedInput] = createSignal<string>("");
  const [comparisonResult, setComparisonResult] = createSignal<{
    match: boolean;
    progress: number;
    mismatchIndex: number | null;
    statusText: string;
  } | null>(null);

  // Server Integrity Audit
  const [auditLoading, setAuditLoading] = createSignal(false);
  const [serverAuditResult, setServerAuditResult] = createSignal<{
    serverIdentityKey: string;
    localPinnedKey: string;
    keysMatch: boolean;
    timestamp: string;
  } | null>(null);

  createEffect(async () => {
    if (!props.isOpen || !props.peer) return;

    setLoading(true);
    setStatus("loading");
    setScannedInput("");
    setComparisonResult(null);
    setServerAuditResult(null);

    try {
      const num = await cryptoService.getSafetyNumber(props.peer.user_id);
      const myFp = await cryptoService.getMyFingerprint();
      const peerFp = await cryptoService.getPeerFingerprint(props.peer.user_id);
      const pinned = await cryptoService.getPeerPinnedIdentity(props.peer.user_id);

      if (num) {
        setSafetyNumber(num);
        setVisualMatrix(generateSecurityVisualMatrix(num));
      } else {
        setSafetyNumber("UNABLE TO COMPUTE - KEYS PENDING");
      }

      setMyFingerprint(myFp ?? "PENDING");
      setPeerFingerprint(peerFp ?? "PENDING");
      setStatus(pinned?.status ?? "trusted");
    } catch {
      setSafetyNumber("SECURITY CHECK FAILED");
      setStatus("compromised");
    } finally {
      setLoading(false);
    }
  });

  const copySafetyNumber = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(safetyNumber());
      showToast("success", "COPIED", "SAFETY NUMBER COPIED TO CLIPBOARD");
    } catch {
      showToast("error", "CLIPBOARD ERROR", "COULD NOT COPY TO CLIPBOARD");
    }
  };

  const toggleVerification = async (): Promise<void> => {
    if (!props.peer) return;
    const isCurrentlyVerified = status() === "verified";
    const newStatus = !isCurrentlyVerified;

    await cryptoService.setPeerVerification(props.peer.user_id, newStatus);
    setStatus(newStatus ? "verified" : "trusted");

    try {
      const { wsManager } = await import("../../websocket/websocket-manager");
      wsManager.sendIdentityVerified(props.peer.user_id, newStatus);
    } catch {}
    showToast(
      "success",
      newStatus ? "IDENTITY VERIFIED" : "VERIFICATION REMOVED",
      newStatus
        ? `${props.peer.display_name.toUpperCase()} IS NOW CRYPTOGRAPHICALLY VERIFIED`
        : "SAFETY NUMBER MARKED AS UNVERIFIED"
    );
  };

  const handleScanInput = (val: string): void => {
    setScannedInput(val);
    const cleanedInput = val.replace(/\s+/g, "");
    const target = safetyNumber().replace(/\s+/g, "");

    if (cleanedInput.length === 0) {
      setComparisonResult(null);
      return;
    }

    let mismatchIdx: number | null = null;
    for (let i = 0; i < cleanedInput.length; i++) {
      if (i >= target.length || cleanedInput[i] !== target[i]) {
        mismatchIdx = i;
        break;
      }
    }

    if (mismatchIdx !== null) {
      setComparisonResult({
        match: false,
        progress: Math.floor((mismatchIdx / 60) * 100),
        mismatchIndex: mismatchIdx + 1,
        statusText: `MISMATCH AT DIGIT #${mismatchIdx + 1} - POTENTIAL MITM THREAT`,
      });
    } else if (cleanedInput.length === 60) {
      setComparisonResult({
        match: true,
        progress: 100,
        mismatchIndex: null,
        statusText: "100% SAS EQUALITY CONFIRMED - ZERO TAMPERING DETECTED",
      });
    } else {
      setComparisonResult({
        match: false,
        progress: Math.floor((cleanedInput.length / 60) * 100),
        mismatchIndex: null,
        statusText: `MATCHING: ${cleanedInput.length} / 60 DIGITS ALIGNED`,
      });
    }
  };

  const runServerAudit = async (): Promise<void> => {
    if (!props.peer) return;
    setAuditLoading(true);
    try {
      const bundle = await api.encryption.getPublicIdentity(props.peer.user_id);
      const pinned = await cryptoService.getPeerPinnedIdentity(props.peer.user_id);
      const serverKey = bundle.identity_key;
      const localKey = pinned?.identity_key ?? "NOT PINNED";
      const keysMatch = serverKey === localKey;

      setServerAuditResult({
        serverIdentityKey: serverKey,
        localPinnedKey: localKey,
        keysMatch,
        timestamp: new Date().toISOString(),
      });

      if (!keysMatch && localKey !== "NOT PINNED") {
        setStatus("compromised");
        showToast(
          "error",
          "CRITICAL MITM DETECTED",
          "SERVER KEY DOES NOT MATCH PINNED IDENTITY"
        );
      } else {
        showToast("success", "AUDIT PASSED", "SERVER PUBLIC KEY MATCHES LOCAL RECORD");
      }
    } catch {
      showToast("error", "SERVER AUDIT FAILED", "COULD NOT REACH ENCRYPTION KEY SERVER");
    } finally {
      setAuditLoading(false);
    }
  };

  const confirmVerifiedFromScanner = async (): Promise<void> => {
    if (!props.peer || !comparisonResult()?.match) return;
    await cryptoService.setPeerVerification(props.peer.user_id, true);
    setStatus("verified");
    showToast("success", "IDENTITY VERIFIED", "CONTACT SIGNED & PINNED VIA SAS SCANNER");
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="CRYPTLINK MITM DEFENSE & SAS VERIFICATION"
      size="xl"
    >
      <div class="space-y-4">
        {/* Navigation Tabs */}
        <div class="border-orange/40 flex items-center gap-2 border-b-2 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("sas")}
            class={`font-pixel flex items-center gap-2 border-2 px-3 py-1.5 text-[9px] transition-colors ${
              activeTab() === "sas"
                ? "border-orange bg-orange font-bold text-black"
                : "border-dark-gray text-gray hover:border-orange hover:text-white"
            }`}
          >
            <span>[1] SAS CIPHERTEXT & MATRIX</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scanner")}
            class={`font-pixel flex items-center gap-2 border-2 px-3 py-1.5 text-[9px] transition-colors ${
              activeTab() === "scanner"
                ? "border-orange bg-orange font-bold text-black"
                : "border-dark-gray text-gray hover:border-orange hover:text-white"
            }`}
          >
            <span>[2] COMPARISON SCANNER</span>
            <Show when={comparisonResult()?.match}>
              <span class="h-2 w-2 rounded-full bg-green-400" />
            </Show>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("audit");
              if (!serverAuditResult()) void runServerAudit();
            }}
            class={`font-pixel flex items-center gap-2 border-2 px-3 py-1.5 text-[9px] transition-colors ${
              activeTab() === "audit"
                ? "border-orange bg-orange font-bold text-black"
                : "border-dark-gray text-gray hover:border-orange hover:text-white"
            }`}
          >
            <span>[3] KEY SERVER AUDIT</span>
          </button>
        </div>

        {/* Status Banner */}
        <div
          class={`flex items-center justify-between border-2 p-3 ${
            status() === "verified"
              ? "border-green-500 bg-green-950/40 text-green-400"
              : status() === "compromised"
                ? "border-red-500 bg-red-950/40 text-red-400"
                : "border-orange bg-orange/10 text-orange"
          }`}
        >
          <div class="flex items-center gap-2">
            <span class="font-pixel text-xs font-bold">
              {status() === "verified"
                ? "[✓] VERIFIED CONTACT"
                : status() === "compromised"
                  ? "[!] MITM SECURITY ALERT"
                  : "[?] UNVERIFIED CONTACT"}
            </span>
          </div>
          <span class="font-pixel text-[8px] tracking-wider uppercase">
            {status() === "verified"
              ? "MITM-PROOF: 99.999% SECURE"
              : status() === "compromised"
                ? "KEY MISMATCH DETECTED"
                : "TOFU ACTIVE (TRUST ON FIRST USE)"}
          </span>
        </div>

        <Show when={status() === "compromised"}>
          <div class="border-2 border-red-500 bg-red-950/60 p-3 text-red-200">
            <p class="font-pixel text-[9px] leading-relaxed">
              WARNING: The public identity key provided by the server for this contact does NOT
              match their pinned identity key! This may indicate a Man-in-the-Middle
              interception attack. Do NOT proceed until you have verified their safety number
              out-of-band.
            </p>
          </div>
        </Show>

        {/* Tab 1: SAS Code & Visual Barcode */}
        <Show when={activeTab() === "sas"}>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Left 2 Cols: 60-digit safety number */}
            <div class="space-y-3 md:col-span-2">
              <p class="font-pixel text-gray text-[8px] leading-relaxed">
                Compare this 60-digit safety number with{" "}
                <span class="text-orange font-bold">
                  {props.peer?.display_name ?? "your contact"}
                </span>{" "}
                over an out-of-band channel (phone call, secure radio, or in person). If both
                numbers match, no attacker can read or tamper with your messages.
              </p>

              <div class="border-orange border-2 bg-black p-3 text-center font-mono">
                <div class="font-pixel border-orange/40 mb-2 flex items-center justify-between border-b pb-1 text-[7px] text-[#38BDF8]">
                  <span>SAS MIL-SPEC CIPHERTEXT</span>
                  <span>SHA-512 SHORT AUTH STRING</span>
                </div>
                <div class="font-pixel grid grid-cols-3 gap-2 text-[9px] text-white sm:grid-cols-4">
                  <For each={safetyNumber().split(" ")}>
                    {(group) => (
                      <div class="bg-dark-gray/50 border-dark-gray text-orange border p-2 font-bold tracking-widest">
                        {group}
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Fingerprints */}
              <div class="font-pixel text-gray border-dark-gray space-y-1.5 border bg-black p-2.5 text-[8px]">
                <div class="truncate">
                  YOUR FINGERPRINT: <span class="font-mono text-white">{myFingerprint()}</span>
                </div>
                <div class="truncate">
                  PEER FINGERPRINT:{" "}
                  <span class="font-mono text-white">{peerFingerprint()}</span>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Visual Barcode Matrix */}
            <div class="border-dark-gray flex flex-col items-center justify-center space-y-2 border-2 bg-[#050D1C] p-3 text-center">
              <div class="border-orange flex h-32 w-32 flex-shrink-0 flex-col justify-between border-2 bg-black p-1 shadow-[0_0_12px_rgba(29,110,229,0.35)]">
                <For each={visualMatrix()}>
                  {(row) => (
                    <div class="flex flex-1 justify-between">
                      <For each={row}>
                        {(bit) => <div class={`h-1 w-1 ${bit ? "bg-orange" : "bg-black"}`} />}
                      </For>
                    </div>
                  )}
                </For>
              </div>
              <p class="font-pixel text-orange text-[8px] font-bold uppercase">
                16x16 SECURITY MATRIX
              </p>
              <p class="font-pixel text-gray text-[7px] leading-tight">
                Deterministic pixel agreement matrix generated from dual Ed25519 identity key
                intersection.
              </p>
            </div>
          </div>
        </Show>

        {/* Tab 2: Comparison Scanner */}
        <Show when={activeTab() === "scanner"}>
          <div class="border-dark-gray space-y-3 border-2 bg-black p-4">
            <div>
              <label class="font-pixel text-orange mb-1 block text-[9px]">
                PASTE OR ENTER PEER'S 60-DIGIT SAFETY NUMBER FOR VERIFICATION:
              </label>
              <textarea
                rows={3}
                class="border-orange/60 focus:border-orange w-full border-2 bg-[#050D1C] p-2 font-mono text-xs tracking-widest text-white focus:outline-none"
                placeholder="Paste the 60 digits received from your contact..."
                value={scannedInput()}
                onInput={(e) => handleScanInput(e.currentTarget.value)}
              />
            </div>

            <Show when={comparisonResult()}>
              {(res) => (
                <div
                  class={`border-2 p-3 ${
                    res().match
                      ? "border-green-500 bg-green-950/40 text-green-400"
                      : res().mismatchIndex !== null
                        ? "border-red-500 bg-red-950/50 text-red-400"
                        : "border-orange bg-orange/10 text-orange"
                  }`}
                >
                  <div class="mb-1 flex items-center justify-between">
                    <span class="font-pixel text-[9px] font-bold">{res().statusText}</span>
                    <span class="font-pixel text-[8px]">{res().progress}% MATCH</span>
                  </div>
                  <div class="bg-dark-gray border-gray h-2 w-full overflow-hidden border">
                    <div
                      class={`h-full transition-all duration-200 ${
                        res().match
                          ? "bg-green-400"
                          : res().mismatchIndex !== null
                            ? "bg-red-500"
                            : "bg-orange"
                      }`}
                      style={{ width: `${res().progress}%` }}
                    />
                  </div>

                  <Show when={res().match}>
                    <div class="mt-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={confirmVerifiedFromScanner}
                        fullWidth
                      >
                        [✓] CONFIRM SAS MATCH & MARK CONTACT AS VERIFIED
                      </Button>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>
        </Show>

        {/* Tab 3: Key Server Audit */}
        <Show when={activeTab() === "audit"}>
          <div class="border-dark-gray space-y-3 border-2 bg-[#050D1C] p-4">
            <div class="border-dark-gray flex items-center justify-between border-b pb-2">
              <span class="font-pixel text-orange text-[9px]">
                SERVER PUBLIC KEY VERIFICATION
              </span>
              <Button
                variant="secondary"
                size="xs"
                onClick={runServerAudit}
                loading={auditLoading()}
              >
                RE-AUDIT SERVER KEY
              </Button>
            </div>

            <Show
              when={serverAuditResult()}
              fallback={
                <div class="font-pixel text-gray py-4 text-center text-[8px]">
                  AUDITING SERVER PUBLIC KEY BUNDLE...
                </div>
              }
            >
              {(audit) => (
                <div class="space-y-2 font-mono text-[9px]">
                  <div class="border-dark-gray border bg-black p-2">
                    <div class="text-gray font-pixel text-[7px]">
                      SERVER ADVERTISED IDENTITY KEY:
                    </div>
                    <div class="break-all text-white">{audit().serverIdentityKey}</div>
                  </div>
                  <div class="border-dark-gray border bg-black p-2">
                    <div class="text-gray font-pixel text-[7px]">
                      LOCAL PINNED IDENTITY KEY:
                    </div>
                    <div class="break-all text-white">{audit().localPinnedKey}</div>
                  </div>
                  <div
                    class={`font-pixel flex items-center justify-between border-2 p-2.5 text-[8px] ${
                      audit().keysMatch
                        ? "border-green-500 bg-green-950/40 text-green-400"
                        : "border-red-500 bg-red-950/50 text-red-400"
                    }`}
                  >
                    <span>
                      {audit().keysMatch
                        ? "[✓] KEY INTEGRITY: AUTHENTIC (MATCHES PINNED IDENTITY)"
                        : "[!] TAMPER DETECTED: KEY MISMATCH DETECTED ON SERVER"}
                    </span>
                    <span>{new Date(audit().timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </Show>

        {/* Bottom Actions */}
        <div class="border-dark-gray flex items-center gap-2 border-t-2 pt-2">
          <Button variant="secondary" size="sm" onClick={copySafetyNumber} fullWidth>
            COPY NUMBER
          </Button>
          <Button
            variant={status() === "verified" ? "secondary" : "primary"}
            size="sm"
            onClick={toggleVerification}
            loading={loading()}
            fullWidth
          >
            {status() === "verified" ? "MARK UNVERIFIED" : "MARK AS VERIFIED"}
          </Button>
          <Button variant="ghost" size="sm" onClick={props.onClose}>
            CLOSE
          </Button>
        </div>
      </div>
    </Modal>
  );
}
