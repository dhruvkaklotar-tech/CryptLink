// ===================
// CryptLink Cryptographic Engine
// Settings.tsx - Tactical User Profile & Cryptographic Security Dashboard
// ===================

import { useStore } from "@nanostores/solid";
import { A, useNavigate } from "@solidjs/router";
import type { JSX } from "solid-js";
import { createEffect, createSignal, Show } from "solid-js";
import { AppShell, ProtectedRoute } from "../components/Layout";
import { Button } from "../components/UI/Button";
import { cryptoService } from "../crypto";
import { getUnusedOneTimePreKeys } from "../crypto/key-store";
import { authService } from "../services";
import { $currentUser, $userId, showToast } from "../stores";

export default function Settings(): JSX.Element {
  const currentUser = useStore($currentUser);
  const userId = useStore($userId);
  const navigate = useNavigate();

  const [x25519Key, setX25519Key] = createSignal<string>("LOADING...");
  const [ed25519Key, setEd25519Key] = createSignal<string>("LOADING...");
  const [otpCount, setOtpCount] = createSignal<number>(0);
  const [showPurgeConfirm, setShowPurgeConfirm] = createSignal(false);
  const [purging, setPurging] = createSignal(false);

  createEffect(async () => {
    const uid = userId();
    if (!uid) return;
    try {
      const ik = await cryptoService.getIdentityKey(uid);
      if (ik) {
        setX25519Key(ik.x25519_public);
        setEd25519Key(ik.ed25519_public);
      }
      const otps = await getUnusedOneTimePreKeys(uid);
      setOtpCount(otps.length);
    } catch (e) {
      console.warn("Error loading keys:", e);
    }
  });

  const copyToClipboard = (text: string, label: string): void => {
    navigator.clipboard.writeText(text);
    showToast("info", "COPIED TO CLIPBOARD", `${label} COPIED`);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.logout();
      navigate("/login");
    } catch {
      window.location.href = "/login";
    }
  };

  const handlePanicPurge = async (): Promise<void> => {
    setPurging(true);
    try {
      await cryptoService.panicPurgeAll();
      showToast("error", "ZEROIZE COMPLETED", "ACCOUNT, KEYS & PASSKEYS PERMANENTLY EXPUNGED");
      setTimeout(() => {
        window.location.href = "/register";
      }, 600);
    } finally {
      setPurging(false);
    }
  };

  return (
    <ProtectedRoute>
      <AppShell showSidebar={false}>
        <div class="flex h-full justify-center overflow-y-auto bg-black p-4 text-white sm:p-8">
          <div class="w-full max-w-3xl space-y-6">
            {/* Top Navigation Bar */}
            <div class="border-orange flex items-center justify-between border-b-2 pb-4">
              <div class="flex items-center gap-3">
                <A
                  href="/chat"
                  class="border-orange text-orange font-pixel hover:bg-orange border-2 px-3 py-1.5 text-[9px] transition-colors hover:text-black"
                >
                  &lt; BACK TO CHAT
                </A>
                <h1 class="font-pixel text-xs font-bold tracking-wider text-white sm:text-sm">
                  TACTICAL PROFILE & SECURITY
                </h1>
              </div>

              <span class="border-orange font-pixel border bg-[#0A1938] px-2 py-0.5 text-[7px] text-[#38BDF8]">
                DEFCON 1 // TS-SCI
              </span>
            </div>

            {/* Profile Identity Card */}
            <div class="border-orange space-y-4 border-2 bg-[#050D1C] p-5 shadow-[3px_3px_0_#0C254D]">
              <div class="border-dark-gray flex items-center justify-between border-b pb-2">
                <span class="font-pixel text-orange text-[9px] font-bold uppercase">
                  OPERATIONAL CALLSIGN & IDENTITY
                </span>
                <span class="font-mono text-[9px] text-green-400">STATUS: AUTHENTICATED</span>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="border-dark-gray space-y-1 border bg-black p-3">
                  <div class="font-pixel text-gray text-[7px] uppercase">
                    CALLSIGN / USERNAME
                  </div>
                  <div class="font-pixel text-xs font-bold text-white">
                    {currentUser()?.username.toUpperCase() ?? "OPERATOR"}
                  </div>
                </div>

                <div class="border-dark-gray space-y-1 border bg-black p-3">
                  <div class="font-pixel text-gray text-[7px] uppercase">DISPLAY NAME</div>
                  <div class="font-pixel text-orange text-xs font-bold">
                    {currentUser()?.display_name.toUpperCase() ?? "UNKNOWN"}
                  </div>
                </div>
              </div>

              <div class="border-dark-gray space-y-1 border bg-black p-3">
                <div class="font-pixel text-gray text-[7px] uppercase">INTERNAL USER ID</div>
                <div class="font-mono text-[10px] break-all text-white/80 select-all">
                  {userId() ?? "N/A"}
                </div>
              </div>
            </div>

            {/* Cryptographic Key Architecture */}
            <div class="border-orange space-y-4 border-2 bg-[#050D1C] p-5 shadow-[3px_3px_0_#0C254D]">
              <div class="border-dark-gray flex items-center justify-between border-b pb-2">
                <span class="font-pixel text-orange text-[9px] font-bold uppercase">
                  E2EE PUBLIC KEY FINGERPRINTS
                </span>
                <span class="font-pixel text-[8px] text-[#38BDF8]">
                  REMAINING PREKEYS: {otpCount()}
                </span>
              </div>

              {/* X25519 Key */}
              <div class="border-dark-gray space-y-2 border bg-black p-3">
                <div class="flex items-center justify-between">
                  <span class="font-pixel text-gray text-[7px] uppercase">
                    X25519 IDENTITY KEY (DIFFIE-HELLMAN KEY EXCHANGE)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(x25519Key(), "X25519 PUBLIC KEY")}
                    class="border-orange text-orange font-pixel hover:bg-orange border px-2 py-0.5 text-[7px] transition-colors hover:text-black"
                  >
                    COPY
                  </button>
                </div>
                <div class="border-orange/20 border bg-[#071328] p-2 font-mono text-[9px] break-all text-white/90 select-all">
                  {x25519Key()}
                </div>
              </div>

              {/* Ed25519 Key */}
              <div class="border-dark-gray space-y-2 border bg-black p-3">
                <div class="flex items-center justify-between">
                  <span class="font-pixel text-gray text-[7px] uppercase">
                    ED25519 SIGNING KEY (DIGITAL SIGNATURES & VERIFICATION)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(ed25519Key(), "ED25519 PUBLIC KEY")}
                    class="border-orange text-orange font-pixel hover:bg-orange border px-2 py-0.5 text-[7px] transition-colors hover:text-black"
                  >
                    COPY
                  </button>
                </div>
                <div class="border-orange/20 border bg-[#071328] p-2 font-mono text-[9px] break-all text-white/90 select-all">
                  {ed25519Key()}
                </div>
              </div>
            </div>

            {/* Session Management & Danger Zone */}
            <div class="border-orange space-y-4 border-2 bg-[#050D1C] p-5">
              <div class="font-pixel text-orange border-dark-gray border-b pb-2 text-[9px] font-bold uppercase">
                OPERATIONAL CONTROLS & DURESS PURGE
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <Button variant="secondary" size="sm" onClick={handleLogout}>
                  SECURE LOGOUT
                </Button>

                <Show
                  when={showPurgeConfirm()}
                  fallback={
                    <button
                      type="button"
                      onClick={() => setShowPurgeConfirm(true)}
                      class="border-error text-error font-pixel hover:bg-error border-2 px-4 py-2 text-[8px] transition-colors hover:text-white"
                    >
                      [!] ZEROIZE / PURGE ALL LOCAL KEYS
                    </button>
                  }
                >
                  <div class="border-error flex flex-wrap items-center gap-3 border-2 bg-red-950/60 p-3">
                    <span class="font-pixel text-[8px] text-red-300">
                      CONFIRM TOTAL LOCAL WIPEOUT?
                    </span>
                    <Button
                      variant="danger"
                      size="xs"
                      onClick={handlePanicPurge}
                      loading={purging()}
                    >
                      CONFIRM ZEROIZE
                    </Button>
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => setShowPurgeConfirm(false)}
                    >
                      CANCEL
                    </Button>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
