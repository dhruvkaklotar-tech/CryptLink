// ===================
// CryptLink Cryptographic Engine
// ChatHeader.tsx - Secure Room Header with Aligned Toolbar & Sentinel HUD
// ===================

import type { JSX } from "solid-js";
import { createEffect, createSignal, Show } from "solid-js";
import { cryptoService } from "../../crypto";
import { getRoomSettings, saveRoomSettings } from "../../crypto/key-store";
import { $sidebarOpen, $userId, getUserStatus, setActiveRoom, showToast } from "../../stores";
import type { Participant, Room } from "../../types";
import { EncryptionBadge } from "./EncryptionBadge";
import { OnlineStatus } from "./OnlineStatus";
import { SafetyNumberModal } from "./SafetyNumberModal";
import { SentinelDefenseModal } from "./SentinelDefenseModal";
import { SessionDetailsModal } from "./SessionDetailsModal";

interface ChatHeaderProps {
  room: Room | null;
  onSettingsClick?: () => void;
  onInfoClick?: () => void;
  class?: string;
}

const DISAPPEARING_OPTIONS = [0, 30, 300, 3600, 86400];
const DISAPPEARING_LABELS: Record<number, string> = {
  0: "OFF",
  30: "30S",
  300: "5M",
  3600: "1H",
  86400: "24H",
};

export function ChatHeader(props: ChatHeaderProps): JSX.Element {
  const [showSafetyModal, setShowSafetyModal] = createSignal(false);
  const [showSessionModal, setShowSessionModal] = createSignal(false);
  const [showSentinelModal, setShowSentinelModal] = createSignal(false);
  const [isVerified, setIsVerified] = createSignal(false);
  const [isCompromised, setIsCompromised] = createSignal(false);
  const [disappearingTtl, setDisappearingTtl] = createSignal(0);

  const otherParticipant = (): Participant | null => {
    if (props.room?.type !== "direct") return null;
    const currentUserId = $userId.get();
    return (
      props.room.participants.find((p) => p.user_id !== currentUserId) ??
      props.room.participants[0] ??
      null
    );
  };

  createEffect(async () => {
    const peer = otherParticipant();
    const roomId = props.room?.id;
    if (peer) {
      const pinned = await cryptoService.getPeerPinnedIdentity(peer.user_id);
      setIsVerified(pinned?.is_verified ?? false);
      setIsCompromised(pinned?.status === "compromised");
    }
    if (roomId) {
      const settings = await getRoomSettings(roomId);
      setDisappearingTtl(settings?.disappearing_ttl_seconds ?? 0);
    }
  });

  const cycleDisappearingTimer = async (): Promise<void> => {
    if (!props.room) return;
    const currentIdx = DISAPPEARING_OPTIONS.indexOf(disappearingTtl());
    const nextIdx = (currentIdx + 1) % DISAPPEARING_OPTIONS.length;
    const nextTtl = DISAPPEARING_OPTIONS[nextIdx];

    setDisappearingTtl(nextTtl);
    await saveRoomSettings({
      room_id: props.room.id,
      disappearing_ttl_seconds: nextTtl,
      updated_at: new Date().toISOString(),
    });

    showToast(
      "info",
      "DISAPPEARING MESSAGES",
      nextTtl === 0
        ? "TIMER DISABLED"
        : `MESSAGES WILL AUTO-DELETE AFTER ${DISAPPEARING_LABELS[nextTtl]}`
    );
  };

  const displayName = (): string => {
    const room = props.room;
    if (room === null) return "CRYPTLINK CHAT";
    const other = otherParticipant();
    return other?.display_name ?? other?.username ?? room.name ?? "CHAT";
  };

  const initials = (): string => {
    const name = displayName();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <div
        class={`border-orange flex-shrink-0 border-b-2 bg-black px-4 py-2.5 ${props.class ?? ""}`}
      >
        <div class="flex items-center justify-between gap-3">
          {/* Left: User Identity */}
          <div class="flex min-w-0 items-center gap-2 sm:gap-3">
            {/* Mobile Back to Transmissions Button */}
            <button
              type="button"
              onClick={() => {
                setActiveRoom(null as any);
                $sidebarOpen.set(true);
              }}
              aria-label="Open contact list"
              title="Back to transmissions"
              class="border-orange text-orange hover:bg-orange flex h-8 w-8 flex-shrink-0 items-center justify-center border-2 bg-black text-[12px] font-bold transition-colors hover:text-black sm:hidden"
            >
              &lt;
            </button>

            <div class="relative flex-shrink-0">
              <div class="border-orange flex h-9 w-9 items-center justify-center border-2 bg-black">
                <span class="font-pixel text-orange text-[10px]">{initials()}</span>
              </div>
              <Show when={otherParticipant()} keyed>
                {(participant) => (
                  <div class="absolute -right-1 -bottom-1">
                    <OnlineStatus status={getUserStatus(participant.user_id)} size="sm" />
                  </div>
                )}
              </Show>
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h2 class="font-pixel truncate text-[11px] font-bold text-white">
                  {displayName()}
                </h2>
              </div>

              <div class="mt-0.5 flex items-center gap-2">
                <Show when={props.room?.is_encrypted}>
                  <EncryptionBadge isEncrypted showLabel size="sm" />
                </Show>
                <Show when={otherParticipant()} keyed>
                  {(participant) => (
                    <span class="font-pixel text-gray text-[7px] uppercase">
                      {getUserStatus(participant.user_id)}
                    </span>
                  )}
                </Show>
                <Show when={disappearingTtl() > 0}>
                  <span class="font-pixel text-orange bg-orange/15 border-orange border px-1 text-[7px] uppercase">
                    EPHEMERAL: {DISAPPEARING_LABELS[disappearingTtl()]}
                  </span>
                </Show>
              </div>
            </div>
          </div>

          {/* Right: Unified Height Aligned Toolbar */}
          <div class="flex flex-shrink-0 items-center gap-2">
            {/* MitM Verification Badge / Button */}
            <button
              type="button"
              onClick={() => setShowSafetyModal(true)}
              class={`font-pixel flex h-8 items-center gap-1.5 border-2 px-2.5 text-[8px] transition-colors ${
                isCompromised()
                  ? "animate-pulse border-red-500 bg-red-950 text-red-400"
                  : isVerified()
                    ? "border-green-500 bg-green-950/60 text-green-400 hover:bg-green-900/60"
                    : "border-orange bg-orange/10 text-orange hover:bg-orange hover:text-black"
              }`}
              title="Verify contact against Man-in-the-Middle attacks"
            >
              <ShieldIcon />
              <span class="hidden sm:inline">
                {isCompromised() ? "KEY MISMATCH" : isVerified() ? "VERIFIED" : "VERIFY MITM"}
              </span>
            </button>

            {/* CryptLink Sentinel HUD Button */}
            <button
              type="button"
              onClick={() => setShowSentinelModal(true)}
              class="border-orange text-orange hover:bg-orange font-pixel flex h-8 items-center gap-1.5 border-2 bg-black px-2.5 text-[8px] transition-colors hover:text-black"
              title="CryptLink Sentinel Live Threat & Tamper Monitor"
            >
              <RadarIcon />
              <span class="hidden md:inline">SENTINEL</span>
            </button>

            {/* Ephemeral Disappearing Messages Toggle */}
            <button
              type="button"
              onClick={cycleDisappearingTimer}
              class={`font-pixel flex h-8 min-w-[56px] items-center justify-center gap-1.5 border-2 px-2.5 text-[8px] transition-colors ${
                disappearingTtl() > 0
                  ? "border-orange bg-orange font-bold text-black shadow-[1px_1px_0_#000]"
                  : "border-dark-gray text-gray hover:border-orange hover:text-orange"
              }`}
              title="Toggle disappearing messages timer (30s, 5m, 1h, 24h, 7d)"
            >
              <ClockIcon class="h-3.5 w-3.5 flex-shrink-0" />
              <span class="tracking-wider">{DISAPPEARING_LABELS[disappearingTtl()]}</span>
            </button>

            {/* Cryptographic Audit Inspector */}
            <button
              type="button"
              onClick={() => setShowSessionModal(true)}
              class="border-dark-gray text-gray hover:border-orange hover:text-orange font-pixel flex h-8 items-center gap-1.5 border-2 px-2.5 text-[8px] transition-colors"
              title="Cryptographic Session Parameters & Ratchet Inspector"
            >
              <InfoIcon />
              <span class="hidden lg:inline">AUDIT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Out-of-band MitM Safety Number Verification Modal */}
      <SafetyNumberModal
        isOpen={showSafetyModal()}
        onClose={() => setShowSafetyModal(false)}
        peer={otherParticipant()}
      />

      {/* Cryptographic Session Details Inspector Modal */}
      <SessionDetailsModal
        isOpen={showSessionModal()}
        onClose={() => setShowSessionModal(false)}
        room={props.room}
        peer={otherParticipant()}
      />

      {/* CryptLink Sentinel Defense Monitor Modal */}
      <SentinelDefenseModal
        isOpen={showSentinelModal()}
        onClose={() => setShowSentinelModal(false)}
        peer={otherParticipant()}
      />
    </>
  );
}

function ShieldIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockIcon(props: { class?: string }): JSX.Element {
  return (
    <svg
      class={props.class ?? "h-3 w-3"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function RadarIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function InfoIcon(): JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
