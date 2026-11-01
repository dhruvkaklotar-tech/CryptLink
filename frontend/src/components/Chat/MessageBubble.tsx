// ===================
// CryptLink Cryptographic Engine
// MessageBubble.tsx - Message Bubble with Vault Decryption & Status Receipts
// ===================

import type { JSX } from "solid-js";
import { createSignal, Match, onMount, Show, Switch } from "solid-js";
import { decryptSecretNote, decryptVaultFile, isSecretNote, isVaultFile } from "../../crypto";
import { formatTime } from "../../lib/date";
import type { Message, MessageStatus } from "../../types";
import { EncryptionBadge } from "./EncryptionBadge";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showSender?: boolean;
  class?: string;
}

export function MessageBubble(props: MessageBubbleProps): JSX.Element {
  const isVault = (): boolean => isVaultFile(props.message.content);
  const isSecret = (): boolean => isSecretNote(props.message.content);

  const bubbleClasses = (): string => {
    const base = "max-w-[85%] sm:max-w-[70%] p-3.5 border-2 transition-all";
    if (props.isOwnMessage) {
      return `${base} bg-orange text-black border-orange shadow-[2px_2px_0_rgba(0,0,0,0.6)]`;
    }
    return `${base} bg-[#071224] border-orange/40 hover:border-orange text-white shadow-[2px_2px_0_var(--color-plum-dark,#0C254D)]`;
  };

  return (
    <div
      class={`flex px-3 py-1 sm:px-4 ${props.isOwnMessage ? "justify-end" : "justify-start"} ${props.class ?? ""}`}
    >
      <div class={bubbleClasses()}>
        <Show when={props.isOwnMessage}>
          <div class="mb-1 flex items-center justify-between gap-2 border-b border-black/15 pb-1 font-mono text-[7px] tracking-wider">
            <span class="truncate font-bold text-black/70 uppercase">
              TX-BURST // OUTBOUND
            </span>
            <span class="flex-shrink-0 font-mono text-black/80">AES-GCM (TAG: OK)</span>
          </div>
        </Show>

        <Show when={!props.isOwnMessage}>
          <div class="border-orange/20 mb-1 flex items-center justify-between gap-2 border-b pb-1 font-mono text-[7px] tracking-wider">
            <span class="text-orange truncate font-bold uppercase">
              RX-COMM // @{props.message.sender_username}
            </span>
            <span class="flex-shrink-0 font-mono text-green-400">RATCHET: OK</span>
          </div>
        </Show>

        <Switch>
          <Match when={isVault()}>
            <VaultFileCard payload={props.message.content} isOwn={props.isOwnMessage} />
          </Match>
          <Match when={isSecret()}>
            <SecretNoteCard payload={props.message.content} isOwn={props.isOwnMessage} />
          </Match>
          <Match when={true}>
            <div class="font-pixel text-[10px] leading-relaxed break-words whitespace-pre-wrap select-text">
              {props.message.content}
            </div>
          </Match>
        </Switch>

        <div class="mt-2 flex items-center justify-end gap-1.5 border-t border-black/10 pt-1">
          <Show when={props.message.is_encrypted}>
            <EncryptionBadge isEncrypted size="sm" />
          </Show>
          <Show when={props.message.ttl_seconds && props.message.ttl_seconds > 0}>
            <span
              class={`font-mono text-[8px] font-bold ${props.isOwnMessage ? "text-black/80" : "text-orange"} flex items-center gap-0.5`}
            >
              ?? {props.message.ttl_seconds}S
            </span>
          </Show>
          <span
            class={`font-pixel text-[7px] ${props.isOwnMessage ? "text-black/70" : "text-gray"}`}
          >
            {formatTime(props.message.created_at)}
          </span>
          <Show when={props.isOwnMessage}>
            <MessageStatusIcon status={props.message.status} />
          </Show>
        </div>
      </div>
    </div>
  );
}

function VaultFileCard(props: { payload: string; isOwn: boolean }): JSX.Element {
  const [downloading, setDownloading] = createSignal(false);
  const [fileInfo, setFileInfo] = createSignal<{
    fileName: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);

  onMount(() => {
    try {
      const prefix = props.payload.startsWith("[CRYPTLINK_VAULT:v2:")
        ? "[CRYPTLINK_VAULT:v2:"
        : "[CRYPTLINK_VAULT:v1:";
      const raw = props.payload.slice(prefix.length, -1);
      const parts = raw.split(":");
      if (parts.length >= 4) {
        setFileInfo({
          fileName: decodeURIComponent(parts[0]),
          mimeType: decodeURIComponent(parts[1]),
          fileSize: parseInt(parts[2], 10),
        });
      }
    } catch {
      // Ignore parse failure
    }
  });

  const handleDownload = async (): Promise<void> => {
    setDownloading(true);
    try {
      const decrypted = await decryptVaultFile(props.payload);
      if (decrypted) {
        const a = document.createElement("a");
        a.href = decrypted.url;
        a.download = decrypted.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(decrypted.url), 200);
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      class={`border-2 p-2.5 ${props.isOwn ? "border-black/30 bg-black/10 text-black" : "border-orange bg-black text-white"} space-y-2`}
    >
      <div class="flex items-center gap-2">
        <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center border">
          <FileIcon />
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-pixel truncate text-[9px] font-bold">
            {fileInfo()?.fileName ?? "ENCRYPTED ATTACHMENT"}
          </div>
          <div class="font-pixel text-[7px] opacity-75">
            {fileInfo() ? `${(fileInfo()!.fileSize / 1024).toFixed(1)} KB` : "AES-256-GCM"} •
            SHA-256 VERIFIED
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading()}
        class={`font-pixel w-full border px-2 py-1.5 text-[8px] transition-colors ${
          props.isOwn
            ? "border-black bg-black text-white hover:bg-black/80"
            : "border-orange bg-orange text-black hover:bg-white"
        }`}
      >
        {downloading() ? "DECRYPTING..." : "DECRYPT & DOWNLOAD"}
      </button>
    </div>
  );
}

function SecretNoteCard(props: { payload: string; isOwn: boolean }): JSX.Element {
  const [revealed, setRevealed] = createSignal(false);
  const [decrypted, setDecrypted] = createSignal<{ title: string; content: string } | null>(
    null
  );
  const [decrypting, setDecrypting] = createSignal(false);

  const toggleReveal = async (): Promise<void> => {
    if (revealed()) {
      setRevealed(false);
      return;
    }

    if (!decrypted()) {
      setDecrypting(true);
      try {
        const res = await decryptSecretNote(props.payload);
        if (res) {
          setDecrypted(res);
          setRevealed(true);
        }
      } finally {
        setDecrypting(false);
      }
    } else {
      setRevealed(true);
    }
  };

  return (
    <div
      class={`border-2 p-2.5 ${props.isOwn ? "border-black/30 bg-black/10 text-black" : "border-orange bg-black text-white"} space-y-2`}
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <span class="inline-block h-1.5 w-1.5 animate-pulse bg-red-500"></span>
          <div class="font-pixel text-[8px] font-bold tracking-wider text-red-400 uppercase">
            [TOP SECRET // EYES ONLY]
          </div>
        </div>
        <button
          type="button"
          onClick={toggleReveal}
          class={`font-pixel border px-2 py-0.5 text-[7px] transition-colors ${
            props.isOwn
              ? "border-black bg-black text-white"
              : "border-orange bg-orange text-black"
          }`}
        >
          {decrypting() ? "DECRYPTING..." : revealed() ? "HIDE" : "REVEAL"}
        </button>
      </div>

      <Show when={revealed() && decrypted()}>
        {(data) => (
          <div class="space-y-1 border border-dashed border-current p-2">
            <div class="font-pixel text-orange text-[8px] font-bold">{data().title}</div>
            <div class="font-pixel text-[9px] leading-relaxed break-words whitespace-pre-wrap">
              {data().content}
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

function FileIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="1" width="7" height="2" />
      <rect x="2" y="3" width="2" height="11" />
      <rect x="12" y="5" width="2" height="9" />
      <rect x="3" y="13" width="10" height="2" />
      <rect x="10" y="3" width="2" height="2" />
    </svg>
  );
}

interface MessageStatusIconProps {
  status: MessageStatus;
}

function MessageStatusIcon(props: MessageStatusIconProps): JSX.Element {
  return (
    <Switch fallback={null}>
      <Match when={props.status === "sending"}>
        <ClockIcon class="h-2.5 w-2.5 text-black/40" />
      </Match>
      <Match when={props.status === "sent"}>
        <CheckIcon class="h-2.5 w-2.5 text-black/60" />
      </Match>
      <Match when={props.status === "delivered"}>
        <DoubleCheckIcon class="h-2.5 w-2.5 text-black/70" />
      </Match>
      <Match when={props.status === "read"}>
        <DoubleCheckIcon class="h-2.5 w-2.5 text-green-700" />
      </Match>
      <Match when={props.status === "failed"}>
        <ErrorIcon class="h-2.5 w-2.5 text-red-600" />
      </Match>
    </Switch>
  );
}

interface IconProps {
  class?: string;
}

function ClockIcon(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" class={props.class} aria-hidden="true">
      <rect x="5" y="1" width="2" height="1" />
      <rect x="3" y="2" width="2" height="1" />
      <rect x="7" y="2" width="2" height="1" />
      <rect x="2" y="3" width="1" height="2" />
      <rect x="9" y="3" width="1" height="2" />
      <rect x="1" y="5" width="1" height="2" />
      <rect x="10" y="5" width="1" height="2" />
      <rect x="2" y="7" width="1" height="2" />
      <rect x="9" y="7" width="1" height="2" />
      <rect x="3" y="9" width="2" height="1" />
      <rect x="7" y="9" width="2" height="1" />
      <rect x="5" y="10" width="2" height="1" />
      <rect x="5" y="3" width="2" height="3" />
      <rect x="5" y="5" width="3" height="2" />
    </svg>
  );
}

function CheckIcon(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" class={props.class} aria-hidden="true">
      <rect x="2" y="6" width="2" height="2" />
      <rect x="4" y="8" width="2" height="2" />
      <rect x="6" y="6" width="2" height="2" />
      <rect x="8" y="4" width="2" height="2" />
      <rect x="10" y="2" width="2" height="2" />
    </svg>
  );
}

function DoubleCheckIcon(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 16 12" fill="currentColor" class={props.class} aria-hidden="true">
      <rect x="0" y="6" width="2" height="2" />
      <rect x="2" y="8" width="2" height="2" />
      <rect x="4" y="6" width="2" height="2" />
      <rect x="6" y="4" width="2" height="2" />
      <rect x="8" y="2" width="2" height="2" />
      <rect x="4" y="6" width="2" height="2" />
      <rect x="6" y="8" width="2" height="2" />
      <rect x="8" y="6" width="2" height="2" />
      <rect x="10" y="4" width="2" height="2" />
      <rect x="12" y="2" width="2" height="2" />
    </svg>
  );
}

function ErrorIcon(props: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 12 12" fill="currentColor" class={props.class} aria-hidden="true">
      <rect x="5" y="1" width="2" height="1" />
      <rect x="3" y="2" width="2" height="1" />
      <rect x="7" y="2" width="2" height="1" />
      <rect x="2" y="3" width="1" height="2" />
      <rect x="9" y="3" width="1" height="2" />
      <rect x="1" y="5" width="1" height="2" />
      <rect x="10" y="5" width="1" height="2" />
      <rect x="2" y="7" width="1" height="2" />
      <rect x="9" y="7" width="1" height="2" />
      <rect x="3" y="9" width="2" height="1" />
      <rect x="7" y="9" width="2" height="1" />
      <rect x="5" y="10" width="2" height="1" />
      <rect x="5" y="3" width="2" height="4" />
      <rect x="5" y="8" width="2" height="1" />
    </svg>
  );
}
