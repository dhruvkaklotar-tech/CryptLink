// ===================
// © AngelaMos | 2025
// Chat.tsx
// ===================

import { useStore } from "@nanostores/solid";
import type { JSX } from "solid-js";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { ChatHeader, ChatInput, MessageList, NewConversation } from "../components/Chat";
import { AppShell, ProtectedRoute } from "../components/Layout";
import { cryptoService, saveDecryptedMessage } from "../crypto";
import { api } from "../lib/api-client";
import { roomService } from "../services";
import {
  $activeModal,
  $activeRoom,
  $activeRoomId,
  $currentUser,
  $userId,
  addMessage,
  closeModal,
  markRoomMessagesAsSeen,
  openModal,
  setActiveRoom,
  showToast,
} from "../stores";
import type { Participant } from "../types";
import { connectWebSocket, disconnectWebSocket, wsManager } from "../websocket";

export default function Chat(): JSX.Element {
  const activeRoom = useStore($activeRoom);
  const activeRoomId = useStore($activeRoomId);
  const userId = useStore($userId);
  const activeModal = useStore($activeModal);
  const [securityAlert, setSecurityAlert] = createSignal<string | null>(null);

  createEffect(() => {
    const roomId = activeRoomId();
    const uId = userId();
    if (roomId && uId) {
      void roomService.loadMessages(roomId).then(() => {
        markRoomMessagesAsSeen(roomId, uId);
      });
    }
  });

  // Automated background Key Integrity Audit (MitM Detection)
  createEffect(async () => {
    const rId = activeRoomId();
    const currentUserId = userId();
    const room = activeRoom();
    if (!rId || !currentUserId || !room) {
      setSecurityAlert(null);
      return;
    }

    const peer = room.participants.find((p: Participant) => p.user_id !== currentUserId);
    if (!peer) return;

    try {
      const bundle = await api.encryption.getPublicIdentity(peer.user_id);
      const pinned = await cryptoService.getPeerPinnedIdentity(peer.user_id);
      if (pinned && pinned.identity_key) {
        if (
          pinned.identity_key !== bundle.identity_key ||
          (pinned.identity_key_ed25519 &&
            bundle.identity_key_ed25519 &&
            pinned.identity_key_ed25519 !== bundle.identity_key_ed25519)
        ) {
          showToast(
            "error",
            "CRITICAL MITM DETECTED",
            `SECURITY ALERT: @${(peer.display_name || peer.username).toUpperCase()}'S IDENTITY KEY HAS CHANGED ON SERVER!`
          );
          setSecurityAlert(
            `CRITICAL ALERT: Identity key for @${peer.display_name || peer.username} has changed! Messages may be intercepted.`
          );
          return;
        }
      }
      setSecurityAlert(null);
    } catch {}
  });

  createEffect(async () => {
    const currentUserId = userId();
    if (currentUserId) {
      try {
        await cryptoService.initialize(currentUserId);
      } catch (e) {
        console.error("CryptoService initialization failed:", e);
      }
      connectWebSocket();
      await roomService.loadRooms();
    }
  });

  onCleanup(() => {
    disconnectWebSocket();
  });

  const handleSendMessage = async (content: string): Promise<void> => {
    const roomId = activeRoomId();
    const room = activeRoom();
    const currentUserId = userId();
    const user = $currentUser.get();

    if (roomId === null || room === null) {
      showToast("error", "SEND FAILED", "NO ACTIVE ROOM");
      return;
    }

    if (currentUserId === null) {
      showToast("error", "SEND FAILED", "NOT AUTHENTICATED");
      return;
    }

    const recipientId = room.participants.find(
      (p: Participant) => p.user_id !== currentUserId
    )?.user_id;

    if (recipientId === undefined) {
      showToast("error", "SEND FAILED", "NO RECIPIENT FOUND");
      return;
    }

    if (securityAlert()) {
      showToast(
        "error",
        "TRANSMISSION BLOCKED",
        "KEY MISMATCH DETECTED - VERIFY MITM BEFORE TRANSMITTING"
      );
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();

    const { getRoomSettings } = await import("../crypto/key-store");
    const settings = await getRoomSettings(roomId);
    const ttl = settings?.disappearing_ttl_seconds ?? 0;

    const messageToSend = {
      id: tempId,
      room_id: roomId,
      sender_id: currentUserId,
      sender_username: user?.username ?? "me",
      content,
      status: "sending" as const,
      is_encrypted: true,
      created_at: now,
      updated_at: now,
      ttl_seconds: ttl > 0 ? ttl : undefined,
    };

    addMessage(roomId, messageToSend);

    if (ttl > 0) {
      setTimeout(async () => {
        const { deleteMessage } = await import("../crypto/message-store");
        const { removeMessage } = await import("../stores/messages.store");
        void deleteMessage(tempId);
        removeMessage(roomId, tempId);
        if (messageToSend.id && messageToSend.id !== tempId) {
          void deleteMessage(messageToSend.id);
          removeMessage(roomId, messageToSend.id);
        }
      }, ttl * 1000);
    }

    try {
      const encrypted = await cryptoService.encrypt(recipientId, content);
      const sent = wsManager.sendEncryptedMessage(recipientId, roomId, encrypted, tempId, ttl);

      if (sent) {
        void saveDecryptedMessage(messageToSend);
      } else {
        showToast("error", "SEND FAILED", "NOT CONNECTED");
      }
    } catch (_error: unknown) {
      console.error("Error during message encryption or sending:", _error);
      const message = _error instanceof Error ? _error.message : "ENCRYPTION ERROR";
      showToast("error", "SEND FAILED", message.slice(0, 75).toUpperCase());
    }
  };

  const handleCreateRoom = async (targetUserId: string): Promise<void> => {
    const currentUserId = userId();

    if (currentUserId === null) {
      showToast("error", "FAILED", "NOT AUTHENTICATED");
      throw new Error("Not authenticated");
    }

    const room = await roomService.createRoom(targetUserId);

    if (room) {
      setActiveRoom(room.id);
      closeModal();
    } else {
      showToast("error", "FAILED", "COULD NOT CREATE CONVERSATION");
      throw new Error("Could not create conversation");
    }
  };

  const handleNewChat = (): void => {
    openModal("new-conversation");
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div class="flex h-full flex-col bg-black">
          <Show
            when={activeRoomId()}
            fallback={<EmptyState onNewChat={handleNewChat} />}
            keyed
          >
            {(roomId) => (
              <>
                <ChatHeader room={activeRoom()} />
                <Show when={securityAlert()}>
                  <div class="font-pixel z-20 flex items-center justify-between border-2 border-red-500 bg-red-950/95 p-3 text-[8px] text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                    <div class="flex items-center gap-2">
                      <span class="inline-block h-2.5 w-2.5 flex-shrink-0 animate-ping bg-red-500" />
                      <span>[!] {securityAlert()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openModal("safety-number")}
                      class="flex-shrink-0 cursor-pointer border border-red-400 bg-red-900 px-2.5 py-1 text-[8px] font-bold text-white uppercase shadow-[1px_1px_0_#000] hover:bg-red-800"
                    >
                      VERIFY MITM
                    </button>
                  </div>
                </Show>
                <MessageList roomId={roomId} />
                <ChatInput
                  roomId={roomId}
                  recipientId={
                    activeRoom()?.participants.find((p: Participant) => p.user_id !== userId())
                      ?.user_id ?? ""
                  }
                  onSend={handleSendMessage}
                />
              </>
            )}
          </Show>
        </div>

        <NewConversation
          isOpen={activeModal() === "new-conversation"}
          onClose={closeModal}
          onCreateRoom={handleCreateRoom}
        />
      </AppShell>
    </ProtectedRoute>
  );
}

interface EmptyStateProps {
  onNewChat: () => void;
}

function EmptyState(props: EmptyStateProps): JSX.Element {
  return (
    <div class="flex h-full flex-col items-center justify-center p-4">
      <div class="text-center">
        <ChatIcon />
        <h2 class="font-pixel text-orange mt-4 mb-2 text-sm">SELECT A CONVERSATION</h2>
        <p class="font-pixel text-gray mb-6 text-[10px]">
          CHOOSE A CHAT FROM THE SIDEBAR OR START A NEW ONE
        </p>
        <button
          type="button"
          onClick={() => props.onNewChat()}
          class="border-orange text-orange font-pixel hover:bg-orange border-2 px-6 py-3 text-[10px] transition-colors hover:text-black"
        >
          START NEW CHAT
        </button>
      </div>
    </div>
  );
}

function ChatIcon(): JSX.Element {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="currentColor"
      class="text-orange mx-auto"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="32" height="4" />
      <rect x="4" y="12" width="4" height="24" />
      <rect x="40" y="12" width="4" height="24" />
      <rect x="8" y="36" width="12" height="4" />
      <rect x="28" y="36" width="12" height="4" />
      <rect x="20" y="40" width="4" height="4" />
      <rect x="16" y="44" width="4" height="4" />
      <rect x="12" y="18" width="24" height="2" />
      <rect x="12" y="24" width="16" height="2" />
      <rect x="12" y="30" width="20" height="2" />
    </svg>
  );
}
