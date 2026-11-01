// ===================
// © AngelaMos | 2025
// websockets.ts
// ===================
import type { PresenceStatus } from "./chat";

export type WSMessageType =
  | "encrypted_message"
  | "typing"
  | "presence"
  | "receipt"
  | "heartbeat"
  | "error"
  | "room_created"
  | "message_sent"
  | "identity_verified";

export interface BaseWSMessage {
  type: WSMessageType;
  timestamp?: string;
}

export interface EncryptedMessageWS extends BaseWSMessage {
  type: "encrypted_message";
  message_id: string;
  sender_id: string;
  recipient_id: string;
  room_id: string;
  content: string;
  ciphertext: string;
  nonce: string;
  header: string;
  sender_username: string;
  ttl_seconds?: number;
}

export interface TypingIndicatorWS extends BaseWSMessage {
  type: "typing";
  user_id: string;
  room_id: string;
  is_typing: boolean;
  username: string;
}

export interface PresenceUpdateWS extends BaseWSMessage {
  type: "presence";
  user_id: string;
  status: PresenceStatus;
  last_seen: string;
}

export interface ReadReceiptWS extends BaseWSMessage {
  type: "receipt";
  message_id: string;
  room_id: string;
  user_id: string;
  read_at: string;
}

export interface HeartbeatWS extends BaseWSMessage {
  type: "heartbeat";
}

export interface ErrorMessageWS extends BaseWSMessage {
  type: "error";
  error_code: string;
  error_message: string;
  details?: Record<string, unknown>;
}

export interface RoomCreatedWS extends BaseWSMessage {
  type: "room_created";
  room_id: string;
  room_type: string;
  name: string | null;
  participants: Array<{
    user_id: string;
    username: string;
    display_name: string;
    role: string;
    joined_at: string;
  }>;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageSentWS extends BaseWSMessage {
  type: "message_sent";
  temp_id: string;
  message_id: string;
  room_id: string;
  status: string;
  created_at: string;
  ttl_seconds?: number;
}

export interface IdentityVerifiedWS extends BaseWSMessage {
  type: "identity_verified";
  user_id: string;
  username: string;
  display_name: string;
  verified: boolean;
}

export type WSMessage =
  | EncryptedMessageWS
  | TypingIndicatorWS
  | PresenceUpdateWS
  | ReadReceiptWS
  | HeartbeatWS
  | ErrorMessageWS
  | RoomCreatedWS
  | MessageSentWS
  | IdentityVerifiedWS;

export interface WSOutgoingEncryptedMessage {
  type: "encrypted_message";
  recipient_id: string;
  room_id: string;
  ciphertext: string;
  nonce: string;
  header: string;
  temp_id: string;
  ttl_seconds?: number;
}

export interface WSOutgoingTyping {
  type: "typing";
  room_id: string;
  is_typing: boolean;
}

export interface WSOutgoingPresence {
  type: "presence";
  status: PresenceStatus;
}

export interface WSOutgoingReceipt {
  type: "receipt";
  message_id: string;
  room_id: string;
}

export interface WSOutgoingIdentityVerified {
  type: "identity_verified";
  recipient_id: string;
  verified: boolean;
}

export interface WSOutgoingHeartbeat {
  type: "heartbeat";
  timestamp: string;
}

export type WSOutgoingMessage =
  | WSOutgoingEncryptedMessage
  | WSOutgoingTyping
  | WSOutgoingPresence
  | WSOutgoingReceipt
  | WSOutgoingHeartbeat
  | WSOutgoingIdentityVerified;

export const WS_HEARTBEAT_INTERVAL = 30000;
export const WS_RECONNECT_DELAY = 5000;
export const WS_MAX_RECONNECT_ATTEMPTS = 10;
