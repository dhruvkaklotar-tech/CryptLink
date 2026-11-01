// ===================
// CryptLink Cryptographic Engine
// ChatInput.tsx - Secure Chat Input with Integrated Encrypted Vault
// ===================

import type { JSX } from "solid-js";
import { createSignal, onCleanup, Show } from "solid-js";
import { MESSAGE_MAX_LENGTH } from "../../types";
import { wsManager } from "../../websocket";
import { EncryptedVaultModal } from "./EncryptedVaultModal";

interface ChatInputProps {
  roomId: string;
  recipientId: string;
  disabled?: boolean;
  onSend?: (content: string) => void;
  class?: string;
}

export function ChatInput(props: ChatInputProps): JSX.Element {
  const [message, setMessage] = createSignal("");
  const [isTyping, setIsTyping] = createSignal(false);
  const [showVaultModal, setShowVaultModal] = createSignal(false);
  let typingTimeout: ReturnType<typeof setTimeout> | undefined;
  let inputRef: HTMLInputElement | undefined;

  const charCount = (): number => message().length;
  const isOverLimit = (): boolean => charCount() > MESSAGE_MAX_LENGTH;
  const canSend = (): boolean =>
    message().trim().length > 0 && !isOverLimit() && props.disabled !== true;

  const handleInput = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    setMessage(target.value);

    if (!isTyping()) {
      setIsTyping(true);
      wsManager.sendTypingIndicator(props.roomId, true);
    }

    if (typingTimeout !== undefined) {
      clearTimeout(typingTimeout);
    }

    typingTimeout = setTimeout(() => {
      setIsTyping(false);
      wsManager.sendTypingIndicator(props.roomId, false);
    }, 2000);
  };

  const handleSend = (): void => {
    if (!canSend()) return;

    const content = message().trim();
    props.onSend?.(content);
    setMessage("");

    if (isTyping()) {
      setIsTyping(false);
      wsManager.sendTypingIndicator(props.roomId, false);
    }

    inputRef?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendVaultPayload = (payload: string): void => {
    props.onSend?.(payload);
  };

  onCleanup(() => {
    if (typingTimeout !== undefined) {
      clearTimeout(typingTimeout);
    }
    if (isTyping()) {
      wsManager.sendTypingIndicator(props.roomId, false);
    }
  });

  return (
    <div
      class={`border-orange tactical-corners flex-shrink-0 border-t-2 bg-black p-3 sm:p-4 ${props.class ?? ""}`}
    >
      {/* Tactical Radio Buffer Status */}
      <div class="font-pixel text-gray mb-2 flex items-center justify-between px-1 text-[7px]">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1 text-green-400">
            <span class="inline-block h-1.5 w-1.5 animate-pulse bg-green-500"></span>
            TX-BURST BUFFER: ARMED
          </span>
          <span class="text-dark-gray">|</span>
          <span class="font-mono text-[8px] tracking-normal text-[#38BDF8]">
            PAYLOAD: [{charCount()}/{MESSAGE_MAX_LENGTH}]
          </span>
        </div>
        <div class="text-gray hidden items-center gap-2 sm:flex">
          <span>BURST FREQ: AGILE</span>
          <span class="text-dark-gray">|</span>
          <span class="text-orange font-bold">X3DH ARMED</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        {/* Encrypted File / Secret Vault Button */}
        <button
          type="button"
          onClick={() => setShowVaultModal(true)}
          class="border-orange text-orange hover:bg-orange font-pixel flex h-10 flex-shrink-0 items-center gap-1.5 border-2 bg-black px-3 text-[9px] transition-colors hover:text-black"
          title="Attach Encrypted File or Secret Note"
        >
          <VaultIcon />
          <span class="hidden sm:inline">VAULT</span>
        </button>

        {/* Input Bar */}
        <div class="border-orange flex h-10 flex-1 items-center border-2 bg-black">
          <span class="font-pixel text-orange px-2 text-[10px] select-none">&gt;&gt;&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={message()}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="TYPE ENCRYPTED MESSAGE..."
            disabled={props.disabled}
            maxLength={MESSAGE_MAX_LENGTH + 100}
            class="font-pixel placeholder:text-gray flex-1 bg-transparent py-1 pr-3 text-[10px] text-white focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Transmit Burst Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend()}
          class="border-orange bg-orange font-pixel flex h-10 flex-shrink-0 items-center gap-2 border-2 px-4 text-[10px] font-bold text-black transition-colors hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          title="Transmit End-to-End Encrypted Burst"
        >
          <SendIcon />
          <span>TRANSMIT</span>
        </button>
      </div>

      <div class="mt-1.5 flex items-center justify-between px-0.5">
        <Show when={isOverLimit()}>
          <span class="font-pixel text-error text-[7px]">MESSAGE TOO LONG</span>
        </Show>
        <span
          class={`font-pixel ml-auto text-[7px] ${isOverLimit() ? "text-error" : "text-gray"}`}
        >
          {charCount()}/{MESSAGE_MAX_LENGTH}
        </span>
      </div>

      {/* Encrypted Vault Modal */}
      <EncryptedVaultModal
        isOpen={showVaultModal()}
        onClose={() => setShowVaultModal(false)}
        onSendPayload={handleSendVaultPayload}
      />
    </div>
  );
}

function VaultIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="4" width="12" height="10" />
      <rect x="5" y="1" width="6" height="3" />
      <rect x="7" y="7" width="2" height="4" fill="black" />
    </svg>
  );
}

function SendIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <rect x="0" y="5" width="8" height="2" />
      <rect x="6" y="3" width="2" height="2" />
      <rect x="6" y="7" width="2" height="2" />
      <rect x="8" y="1" width="2" height="4" />
      <rect x="8" y="7" width="2" height="4" />
      <rect x="10" y="3" width="2" height="6" />
    </svg>
  );
}
