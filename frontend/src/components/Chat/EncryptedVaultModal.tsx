// ===================
// CryptLink Cryptographic Engine
// EncryptedVaultModal.tsx - End-to-End Encrypted File & Secret Transfer
// ===================

import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { encryptSecretNote, encryptVaultFile } from "../../crypto";
import { showToast } from "../../stores";
import { Button } from "../UI/Button";
import { Modal } from "../UI/Modal";

interface EncryptedVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPayload: (payload: string) => void;
}

export function EncryptedVaultModal(props: EncryptedVaultModalProps): JSX.Element {
  const [tab, setTab] = createSignal<"file" | "secret">("file");
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [secretTitle, setSecretTitle] = createSignal("");
  const [secretNote, setSecretNote] = createSignal("");
  const [encrypting, setEncrypting] = createSignal(false);
  let fileInputRef: HTMLInputElement | undefined;

  const handleFileChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showToast("error", "FILE TOO LARGE", "MAXIMUM ENCRYPTED ATTACHMENT IS 5MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSendFile = async (): Promise<void> => {
    const file = selectedFile();
    if (!file) return;

    setEncrypting(true);
    try {
      const result = await encryptVaultFile(file);
      props.onSendPayload(result.payload);
      showToast(
        "success",
        "FILE ENCRYPTED",
        `${file.name.toUpperCase()} SECURED WITH AES-256-GCM`
      );
      handleClose();
    } catch {
      showToast("error", "ENCRYPTION FAILED", "COULD NOT ENCRYPT FILE");
    } finally {
      setEncrypting(false);
    }
  };

  const handleSendSecret = async (): Promise<void> => {
    const note = secretNote().trim();
    const title = secretTitle().trim() || "CONFIDENTIAL NOTE";
    if (!note) return;

    setEncrypting(true);
    try {
      const payload = await encryptSecretNote(title, note);
      props.onSendPayload(payload);
      showToast("success", "SECRET SECURED", "CONFIDENTIAL NOTE ENCRYPTED WITH AES-256-GCM");
      handleClose();
    } catch {
      showToast("error", "ENCRYPTION FAILED", "COULD NOT ENCRYPT SECRET");
    } finally {
      setEncrypting(false);
    }
  };

  const handleClose = (): void => {
    setSelectedFile(null);
    setSecretTitle("");
    setSecretNote("");
    setEncrypting(false);
    props.onClose();
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={handleClose}
      title="CRYPTLINK SECURE VAULT"
      size="lg"
    >
      <div class="space-y-4">
        {/* Tab Selection */}
        <div class="border-dark-gray flex items-center gap-2 border-b-2 pb-2">
          <button
            type="button"
            onClick={() => setTab("file")}
            class={`font-pixel border-2 px-3 py-1 text-[9px] transition-colors ${
              tab() === "file"
                ? "border-orange bg-orange text-black"
                : "border-dark-gray text-gray hover:border-orange hover:text-white"
            }`}
          >
            ENCRYPTED FILE
          </button>
          <button
            type="button"
            onClick={() => setTab("secret")}
            class={`font-pixel border-2 px-3 py-1 text-[9px] transition-colors ${
              tab() === "secret"
                ? "border-orange bg-orange text-black"
                : "border-dark-gray text-gray hover:border-orange hover:text-white"
            }`}
          >
            CONFIDENTIAL NOTE
          </button>
        </div>

        <Show
          when={tab() === "file"}
          fallback={
            <div class="space-y-3">
              <div>
                <label class="font-pixel text-gray mb-1 block text-[8px] uppercase">
                  Note Title
                </label>
                <input
                  type="text"
                  value={secretTitle()}
                  onInput={(e) => setSecretTitle(e.currentTarget.value)}
                  placeholder="E.G. SERVER SSH PASSPHRASE"
                  class="border-dark-gray focus:border-orange font-pixel w-full border-2 bg-black p-2 text-[9px] text-white focus:outline-none"
                />
              </div>

              <div>
                <label class="font-pixel text-gray mb-1 block text-[8px] uppercase">
                  Secret Content
                </label>
                <textarea
                  value={secretNote()}
                  onInput={(e) => setSecretNote(e.currentTarget.value)}
                  rows={4}
                  placeholder="ENTER SENSITIVE INFORMATION..."
                  class="border-dark-gray focus:border-orange font-pixel w-full border-2 bg-black p-2 text-[9px] text-white focus:outline-none"
                />
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleSendSecret}
                disabled={!secretNote().trim() || encrypting()}
                loading={encrypting()}
                fullWidth
              >
                ENCRYPT & TRANSMIT SECRET
              </Button>
            </div>
          }
        >
          <div class="space-y-3">
            <input ref={fileInputRef} type="file" onChange={handleFileChange} class="hidden" />

            <div
              onClick={() => fileInputRef?.click()}
              class="border-orange hover:bg-orange/5 cursor-pointer border-2 border-dashed bg-black p-6 text-center transition-colors"
            >
              <Show
                when={selectedFile()}
                keyed
                fallback={
                  <div>
                    <FileIcon />
                    <p class="font-pixel mt-2 text-[9px] text-white">CLICK TO SELECT FILE</p>
                    <p class="font-pixel text-gray mt-1 text-[7px]">
                      ANY FILE UP TO 5MB (DOCUMENTS, IMAGES, KEYS)
                    </p>
                  </div>
                }
              >
                {(file) => (
                  <div>
                    <p class="font-pixel text-orange truncate text-[10px] uppercase">
                      {file.name}
                    </p>
                    <p class="font-pixel text-gray mt-1 text-[8px]">
                      {(file.size / 1024).toFixed(1)} KB • {file.type || "UNKNOWN TYPE"}
                    </p>
                    <p class="font-pixel mt-2 text-[7px] text-green-400">
                      READY FOR ZERO-KNOWLEDGE AES-256-GCM ENCRYPTION
                    </p>
                  </div>
                )}
              </Show>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleSendFile}
              disabled={selectedFile() === null || encrypting()}
              loading={encrypting()}
              fullWidth
            >
              ENCRYPT & SEND FILE
            </Button>
          </div>
        </Show>
      </div>
    </Modal>
  );
}

function FileIcon(): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 16 16"
      fill="currentColor"
      class="text-orange mx-auto"
    >
      <rect x="3" y="1" width="7" height="2" />
      <rect x="2" y="3" width="2" height="11" />
      <rect x="12" y="5" width="2" height="9" />
      <rect x="3" y="13" width="10" height="2" />
      <rect x="10" y="3" width="2" height="2" />
      <rect x="5" y="5" width="5" height="2" />
      <rect x="5" y="8" width="6" height="2" />
      <rect x="5" y="11" width="4" height="2" />
    </svg>
  );
}
