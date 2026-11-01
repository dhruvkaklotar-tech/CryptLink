// ===================
// © AngelaMos | 2025
// message-handlers.ts
// ===================

import { cryptoService, saveDecryptedMessage, updateMessageId } from "../crypto";
import {
  addMessage,
  confirmMessageId,
  getMessageById,
  updateMessageStatus,
} from "../stores/messages.store";
import { setUserPresence } from "../stores/presence.store";
import { $activeRoomId, addRoom } from "../stores/rooms.store";
import { setUserTyping } from "../stores/typing.store";
import { showToast } from "../stores/ui.store";
import type {
  EncryptedMessageWS,
  ErrorMessageWS,
  IdentityVerifiedWS,
  Message,
  MessageSentWS,
  PresenceUpdateWS,
  ReadReceiptWS,
  Room,
  RoomCreatedWS,
  TypingIndicatorWS,
  WSMessage,
} from "../types";
import {
  isEncryptedMessageWS,
  isErrorMessageWS,
  isHeartbeatWS,
  isIdentityVerifiedWS,
  isMessageSentWS,
  isPresenceUpdateWS,
  isReadReceiptWS,
  isRoomCreatedWS,
  isTypingIndicatorWS,
} from "../types/guards";

type MessageHandler<T extends WSMessage> = (message: T) => void;

async function encryptedMessageHandler(message: EncryptedMessageWS): Promise<void> {
  let decryptedContent: string;

  try {
    decryptedContent = await cryptoService.decrypt(
      message.sender_id,
      message.ciphertext,
      message.nonce,
      message.header
    );
  } catch (err) {
    console.error("DECRYPTION ERROR DETAILS:", err);
    decryptedContent = "[Encrypted message - decryption failed]";
  }

  const isViewing =
    $activeRoomId.get() === message.room_id &&
    (typeof document === "undefined" || document.visibilityState === "visible");

  let ttl = (message as { ttl_seconds?: number }).ttl_seconds ?? 0;
  if (!ttl) {
    try {
      const { getRoomSettings } = await import("../crypto/key-store");
      const settings = await getRoomSettings(message.room_id);
      ttl = settings?.disappearing_ttl_seconds ?? 0;
    } catch {}
  }

  const chatMessage: Message = {
    id: message.message_id,
    room_id: message.room_id,
    sender_id: message.sender_id,
    sender_username: message.sender_username,
    content: decryptedContent,
    status: isViewing ? "read" : "delivered",
    is_encrypted: true,
    encrypted_content: message.ciphertext,
    nonce: message.nonce,
    header: message.header,
    created_at: message.timestamp ?? new Date().toISOString(),
    updated_at: message.timestamp ?? new Date().toISOString(),
    ttl_seconds: ttl > 0 ? ttl : undefined,
  };

  addMessage(message.room_id, chatMessage);
  void saveDecryptedMessage(chatMessage);

  if (isViewing) {
    // Emit delivery read receipt back to the sender
    try {
      const { wsManager } = await import("./websocket-manager");
      wsManager.sendReadReceipt(message.message_id, message.room_id);
    } catch {}

    // Check for ephemeral / disappearing messages TTL starting now that user has seen it
    if (ttl > 0) {
      setTimeout(async () => {
        const { deleteMessage } = await import("../crypto/message-store");
        const { removeMessage } = await import("../stores/messages.store");
        void deleteMessage(message.message_id);
        removeMessage(message.room_id, message.message_id);
      }, ttl * 1000);
    }
  }
}

const typingIndicatorHandler: MessageHandler<TypingIndicatorWS> = (message) => {
  setUserTyping(message.room_id, message.user_id, message.username, message.is_typing);
};

const presenceUpdateHandler: MessageHandler<PresenceUpdateWS> = (message) => {
  setUserPresence(message.user_id, message.status, message.last_seen);
};

const readReceiptHandler: MessageHandler<ReadReceiptWS> = (message) => {
  updateMessageStatus(message.room_id, message.message_id, "read");
  const msg = getMessageById(message.room_id, message.message_id);
  const ttl = msg?.ttl_seconds ?? 0;
  if (ttl > 0) {
    setTimeout(async () => {
      const { deleteMessage } = await import("../crypto/message-store");
      const { removeMessage } = await import("../stores/messages.store");
      void deleteMessage(message.message_id);
      removeMessage(message.room_id, message.message_id);
    }, ttl * 1000);
  }
};

const identityVerifiedHandler = async (message: IdentityVerifiedWS): Promise<void> => {
  const isVerified = Boolean(message.verified);
  const name = message.display_name || message.username || "CONTACT";
  showToast(
    isVerified ? "success" : "info",
    isVerified ? "IDENTITY VERIFIED BY PEER" : "VERIFICATION REVOKED BY PEER",
    isVerified
      ? `@${name.toUpperCase()} CRYPTOGRAPHICALLY VERIFIED & PINNED YOUR SAFETY NUMBER`
      : `@${name.toUpperCase()} MARKED YOUR SAFETY NUMBER AS UNVERIFIED`
  );
  try {
    const { setPeerVerificationStatus } = await import("../crypto/key-store");
    await setPeerVerificationStatus(message.user_id, isVerified);
  } catch {}
};

const errorMessageHandler: MessageHandler<ErrorMessageWS> = (message) => {
  showToast("error", "CONNECTION ERROR", message.error_message.toUpperCase());
};

const roomCreatedHandler: MessageHandler<RoomCreatedWS> = (message) => {
  const participants: Room["participants"] = message.participants.map((p) => ({
    user_id: String(p.user_id ?? ""),
    username: String(p.username ?? ""),
    display_name: String(p.display_name ?? ""),
    role: (p.role as "owner" | "admin" | "member" | undefined) ?? "member",
    joined_at: String(p.joined_at ?? ""),
  }));

  const room: Room = {
    id: message.room_id,
    type: message.room_type as "direct" | "group" | "ephemeral",
    name: message.name ?? undefined,
    participants,
    unread_count: 0,
    is_encrypted: message.is_encrypted,
    created_at: message.created_at,
    updated_at: message.updated_at,
  };

  addRoom(room);
  showToast("info", "NEW CHAT", `NEW CONVERSATION STARTED`);
};

const messageSentHandler: MessageHandler<MessageSentWS> = async (message) => {
  confirmMessageId(message.room_id, message.temp_id, message.message_id, "sent");
  void updateMessageId(message.temp_id, message.message_id);

  try {
    const { getRoomSettings } = await import("../crypto/key-store");
    const { deleteMessage } = await import("../crypto/message-store");
    const { removeMessage } = await import("../stores/messages.store");
    const settings = await getRoomSettings(message.room_id);
    const ttl =
      (message as { ttl_seconds?: number }).ttl_seconds ??
      settings?.disappearing_ttl_seconds ??
      0;
    if (ttl > 0) {
      setTimeout(() => {
        void deleteMessage(message.message_id);
        void deleteMessage(message.temp_id);
        removeMessage(message.room_id, message.message_id);
        removeMessage(message.room_id, message.temp_id);
      }, ttl * 1000);
    }
  } catch {}
};

export function handleWSMessage(message: WSMessage): void {
  if (isEncryptedMessageWS(message)) {
    void encryptedMessageHandler(message);
  } else if (isTypingIndicatorWS(message)) {
    typingIndicatorHandler(message);
  } else if (isPresenceUpdateWS(message)) {
    presenceUpdateHandler(message);
  } else if (isReadReceiptWS(message)) {
    readReceiptHandler(message);
  } else if (isErrorMessageWS(message)) {
    errorMessageHandler(message);
  } else if (isRoomCreatedWS(message)) {
    roomCreatedHandler(message);
  } else if (isMessageSentWS(message)) {
    messageSentHandler(message);
  } else if (isHeartbeatWS(message)) {
    return;
  } else if (isIdentityVerifiedWS(message)) {
    void identityVerifiedHandler(message);
  }
}

export async function handleEncryptedMessage(message: EncryptedMessageWS): Promise<void> {
  await encryptedMessageHandler(message);
}

export function handleTypingIndicator(message: TypingIndicatorWS): void {
  typingIndicatorHandler(message);
}

export function handlePresenceUpdate(message: PresenceUpdateWS): void {
  presenceUpdateHandler(message);
}

export function handleReadReceipt(message: ReadReceiptWS): void {
  readReceiptHandler(message);
}

export function handleErrorMessage(message: ErrorMessageWS): void {
  errorMessageHandler(message);
}
