// ===================
// CryptLink Engineering | 2026
// NewConversation.tsx
// ===================

import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { showToast } from "../../stores";
import type { User } from "../../types";
import { Button } from "../UI/Button";
import { Modal } from "../UI/Modal";
import { UserSearch } from "./UserSearch";

interface NewConversationProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (userId: string) => Promise<void>;
}

export function NewConversation(props: NewConversationProps): JSX.Element {
  const [selectedUser, setSelectedUser] = createSignal<User | null>(null);
  const [loading, setLoading] = createSignal(false);

  const handleUserSelect = (user: User): void => {
    setSelectedUser(user);
  };

  const handleCreate = async (): Promise<void> => {
    const user = selectedUser();
    if (user === null) return;

    setLoading(true);

    try {
      await props.onCreateRoom(user.id);
      showToast(
        "success",
        "TRANSMISSION INITIALIZED",
        `ESTABLISHED ENCRYPTED CHANNEL WITH ${user.display_name.toUpperCase()}`
      );
      handleClose();
    } catch (_error: unknown) {
      showToast("error", "FAILED TO CREATE CHANNEL", "COULD NOT INITIALIZE E2EE SESSION");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (): void => {
    setSelectedUser(null);
    setLoading(false);
    props.onClose();
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={handleClose}
      title="INITIALIZE NEW TRANSMISSION"
      size="lg"
    >
      <div class="space-y-4">
        <div>
          <span class="font-pixel text-orange mb-2 block text-[9px] font-bold uppercase">
            TARGET CALLSIGN SEARCH
          </span>
          <UserSearch onSelect={handleUserSelect} placeholder="TYPE CALLSIGN OR USERNAME..." />
        </div>

        <Show when={selectedUser()} keyed>
          {(user) => (
            <div class="border-orange border-2 bg-[#050D1C] p-4 shadow-[2px_2px_0_#0C254D]">
              <p class="font-pixel mb-2 text-[8px] font-bold text-[#38BDF8]">
                SELECTED CONTACT FOR E2EE KEY EXCHANGE
              </p>
              <div class="flex items-center gap-3">
                <div class="border-orange flex h-10 w-10 items-center justify-center border-2 bg-black">
                  <span class="font-pixel text-orange text-[11px] font-bold">
                    {user.display_name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div class="font-pixel text-[11px] font-bold text-white">
                    {user.display_name}
                  </div>
                  <div class="font-pixel text-gray text-[8px]">@{user.username}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  class="border-gray text-gray hover:border-error hover:text-error ml-auto flex h-7 w-7 items-center justify-center border-2 transition-colors"
                  aria-label="Remove selection"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
          )}
        </Show>

        <div class="border-dark-gray flex items-center justify-end gap-2 border-t-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading()}>
            CANCEL
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={selectedUser() === null}
            loading={loading()}
          >
            ESTABLISH E2EE TRANSMISSION
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CloseIcon(): JSX.Element {
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
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
