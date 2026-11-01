// ===================
// © AngelaMos | 2025
// UserSearch.tsx
// ===================

import type { JSX } from "solid-js";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { USER_SEARCH_DEFAULT_LIMIT, USER_SEARCH_MIN_LENGTH } from "../../config";
import { api } from "../../lib/api-client";
import type { User } from "../../types";
import { Input } from "../UI/Input";
import { Spinner } from "../UI/Spinner";

interface UserSearchProps {
  onSelect: (user: User) => void;
  excludeIds?: string[];
  placeholder?: string;
  class?: string;
}

interface SearchResult {
  users: User[];
  loading: boolean;
  error: string | null;
}

export function UserSearch(props: UserSearchProps): JSX.Element {
  const [query, setQuery] = createSignal("");
  const [result, setResult] = createSignal<SearchResult>({
    users: [],
    loading: false,
    error: null,
  });
  const [isFocused, setIsFocused] = createSignal(false);

  let searchTimeout: ReturnType<typeof setTimeout> | undefined;

  const handleInput = (value: string): void => {
    setQuery(value);

    if (searchTimeout !== undefined) {
      clearTimeout(searchTimeout);
    }

    if (value.trim().length < USER_SEARCH_MIN_LENGTH) {
      setResult({ users: [], loading: false, error: null });
      return;
    }

    setResult((prev) => ({ ...prev, loading: true }));

    searchTimeout = setTimeout(() => {
      void searchUsers(value.trim());
    }, 300);
  };

  const searchUsers = async (searchQuery: string): Promise<void> => {
    try {
      const response = await api.users.search({
        query: searchQuery,
        limit: USER_SEARCH_DEFAULT_LIMIT,
      });
      setResult({ users: response.users, loading: false, error: null });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Search failed";
      setResult({ users: [], loading: false, error: errorMessage });
    }
  };

  const handleSelect = (user: User): void => {
    props.onSelect(user);
    setQuery("");
    setResult({ users: [], loading: false, error: null });
    setIsFocused(false);
  };

  const filteredUsers = (): User[] => {
    const excludeSet = new Set(props.excludeIds ?? []);
    return result().users.filter((u) => !excludeSet.has(u.id));
  };

  const showResults = (): boolean => {
    return (
      isFocused() &&
      (result().loading || filteredUsers().length > 0 || result().error !== null)
    );
  };

  onCleanup(() => {
    if (searchTimeout !== undefined) {
      clearTimeout(searchTimeout);
    }
  });

  return (
    <div class={`relative ${props.class ?? ""}`}>
      <Input
        name="user-search"
        placeholder={props.placeholder ?? "SEARCH CALLSIGNS OR USERNAMES..."}
        value={query()}
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        fullWidth
        leftIcon={<SearchIcon class="text-orange h-4 w-4" />}
      />

      <Show when={showResults()}>
        <div
          class="border-orange scrollbar-pixel absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto border-2 bg-black shadow-[4px_4px_0_#0C254D]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <Show when={result().loading}>
            <div class="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          </Show>

          <Show when={result().error}>
            <div class="p-3">
              <span class="font-pixel text-error text-[10px]">{result().error}</span>
            </div>
          </Show>

          <Show when={!result().loading && !result().error}>
            <For each={filteredUsers()}>
              {(user) => (
                <button
                  type="button"
                  class="hover:bg-orange/20 border-dark-gray flex w-full items-center gap-3 border-b p-3 text-left transition-colors last:border-b-0"
                  onClick={() => handleSelect(user)}
                >
                  <div class="border-orange flex h-8 w-8 flex-shrink-0 items-center justify-center border-2 bg-black">
                    <span class="font-pixel text-orange text-[9px] font-bold">
                      {user.display_name.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-pixel truncate text-[10px] font-bold text-white">
                      {user.display_name}
                    </div>
                    <div class="font-pixel text-gray truncate text-[8px]">
                      @{user.username}
                    </div>
                  </div>
                  <span class="font-pixel border border-green-500/50 px-1 py-0.5 text-[7px] text-green-400">
                    AUTHENTICATED
                  </span>
                </button>
              )}
            </For>
            <Show when={filteredUsers().length === 0}>
              <div class="p-3 text-center">
                <span class="font-pixel text-gray text-[9px]">NO USERS FOUND</span>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}

function SearchIcon(props: { class?: string }): JSX.Element {
  return (
    <svg
      class={props.class ?? "text-orange h-4 w-4"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
