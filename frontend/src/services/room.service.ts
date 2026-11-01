// ===================
// © AngelaMos | 2026
// room.service.ts
// ===================

import {
  cryptoService,
  getDecryptedMessage,
  getDecryptedMessages,
  saveDecryptedMessage,
} from "../crypto";
import { api } from "../lib/api-client";
import { $userId, addRoom, setHasMore, setRoomMessages, setRooms } from "../stores";
import type { Message, Room } from "../types";

export async function loadRooms(): Promise<Room[]> {
  try {
    const response = await api.rooms.list();
    setRooms(response.rooms);
    return response.rooms;
  } catch {
    return [];
  }
}

export async function createRoom(
  participantId: string,
  roomType: "direct" | "group" | "ephemeral" = "direct"
): Promise<Room | null> {
  try {
    const room = await api.rooms.create({
      participant_id: participantId,
      room_type: roomType,
    });
    addRoom(room);
    return room;
  } catch (_err) {
    return null;
  }
}

export async function loadMessages(
  roomId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Message[]> {
  try {
    const localMessages = await getDecryptedMessages(roomId, limit);
    const localMessageIds = new Set(localMessages.map((m) => m.id));

    if (localMessages.length > 0) {
      setRoomMessages(roomId, localMessages);
      const now = Date.now();
      for (const m of localMessages) {
        if (m.ttl_seconds && m.ttl_seconds > 0) {
          const expiresAt = new Date(m.created_at).getTime() + m.ttl_seconds * 1000;
          const remaining = expiresAt - now;
          if (remaining > 0) {
            setTimeout(async () => {
              const { deleteMessage } = await import("../crypto/message-store");
              const { removeMessage } = await import("../stores/messages.store");
              void deleteMessage(m.id);
              removeMessage(roomId, m.id);
            }, remaining);
          }
        }
      }
    }

    const response = await api.rooms.getMessages(roomId, limit, offset);
    const serverMessages = response.messages.reverse();

    const newMessages: Message[] = [];
    const currentUserId = $userId.get();

    const localByNonce = new Map(
      localMessages.filter((m) => m.nonce).map((m) => [m.nonce, m])
    );

    for (const msg of serverMessages) {
      if (localMessageIds.has(msg.id)) {
        continue;
      }

      // Check if already decrypted locally by nonce
      if (msg.nonce && localByNonce.has(msg.nonce)) {
        const existing = localByNonce.get(msg.nonce)!;
        existing.id = msg.id;
        existing.status = "delivered";
        void saveDecryptedMessage(existing);
        localMessageIds.add(msg.id);
        continue;
      }

      const isOwnMessage = msg.sender_id === currentUserId;
      let content = "[Sent before this device joined - cannot decrypt]";

      if (isOwnMessage) {
        // Look up local copy by ID or matching pending message
        const localCopy = await getDecryptedMessage(msg.id);
        const matchingPending = localMessages.find(
          (lm) =>
            lm.sender_id === currentUserId &&
            (lm.id.startsWith("temp-") || lm.content) &&
            Math.abs(new Date(lm.created_at).getTime() - new Date(msg.created_at).getTime()) <
              15000
        );

        if (localCopy && !localCopy.content.startsWith("[Sent")) {
          content = localCopy.content;
        } else if (matchingPending && !matchingPending.content.startsWith("[Sent")) {
          content = matchingPending.content;
          matchingPending.id = msg.id;
          matchingPending.status = "delivered";
          void saveDecryptedMessage(matchingPending);
          localMessageIds.add(msg.id);
          continue;
        } else {
          content = "[Sent from a different device]";
        }
      } else {
        try {
          content = await cryptoService.decrypt(
            msg.sender_id,
            msg.ciphertext,
            msg.nonce,
            msg.header
          );
        } catch {
          content = "[Sent before this device joined - cannot decrypt]";
        }
      }

      const decryptedMessage: Message = {
        id: msg.id,
        room_id: msg.room_id,
        sender_id: msg.sender_id,
        sender_username: msg.sender_username,
        content,
        status: "delivered" as const,
        is_encrypted: true,
        encrypted_content: msg.ciphertext,
        nonce: msg.nonce,
        header: msg.header,
        created_at: msg.created_at,
        updated_at: msg.created_at,
      };

      if (!content.startsWith("[Sent")) {
        void saveDecryptedMessage(decryptedMessage);
      }

      newMessages.push(decryptedMessage);
    }

    const allMessages = [...localMessages, ...newMessages];
    const uniqueMessages = Array.from(
      new Map(allMessages.map((m) => [m.id, m])).values()
    ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    setRoomMessages(roomId, uniqueMessages);
    setHasMore(roomId, response.has_more);
    return uniqueMessages;
  } catch (_err) {
    const localMessages = await getDecryptedMessages(roomId, limit);
    if (localMessages.length > 0) {
      setRoomMessages(roomId, localMessages);
      const now = Date.now();
      for (const m of localMessages) {
        if (m.ttl_seconds && m.ttl_seconds > 0) {
          const expiresAt = new Date(m.created_at).getTime() + m.ttl_seconds * 1000;
          const remaining = expiresAt - now;
          if (remaining > 0) {
            setTimeout(async () => {
              const { deleteMessage } = await import("../crypto/message-store");
              const { removeMessage } = await import("../stores/messages.store");
              void deleteMessage(m.id);
              removeMessage(roomId, m.id);
            }, remaining);
          }
        }
      }
    }
    return localMessages;
  }
}

export const roomService = {
  loadRooms,
  createRoom,
  loadMessages,
};
