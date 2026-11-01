/**
// CryptLink Tactical C4ISR Sidebar
// Sidebar.tsx - Aligned Transmissions, High-Visibility + Button, and Sized Call-signs
 */

import { useStore } from "@nanostores/solid";
import type { JSX } from "solid-js";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  $activeRoomId,
  $currentUser,
  $rooms,
  $sidebarOpen,
  $totalUnreadCount,
  getUserStatus,
  openModal,
  setActiveRoom,
} from "../../stores";
import type { Participant } from "../../types";
import { Badge } from "../UI/Badge";
import { OnlineStatus } from "../Chat/OnlineStatus";

export function Sidebar(): JSX.Element {
  const currentUser = useStore($currentUser);
  const rooms = useStore($rooms);
  const activeRoomId = useStore($activeRoomId);
  const totalUnread = useStore($totalUnreadCount);
  const [filterQuery, setFilterQuery] = createSignal("");

  const sortedRooms = createMemo(() => {
    const arr = Object.values(rooms());
    const q = filterQuery().toLowerCase().trim();

    const filtered = q
      ? arr.filter((r) => {
          const other = r.participants?.find(
            (p: Participant) => p.user_id !== currentUser()?.id
          );
          const name = r.name ?? other?.display_name ?? other?.username ?? "";
          const lastMsg = r.last_message?.content ?? "";
          return name.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q);
        })
      : arr;

    return filtered.sort((a, b) => {
      const aTime = a.last_message?.created_at ?? a.updated_at;
      const bTime = b.last_message?.created_at ?? b.updated_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  });

  const formatMsgTime = (timestamp?: string): string => {
    if (!timestamp) return "";
    try {
      const d = new Date(timestamp);
      const h = String(d.getUTCHours()).padStart(2, "0");
      const m = String(d.getUTCMinutes()).padStart(2, "0");
      return `${h}:${m}Z`;
    } catch {
      return "";
    }
  };

  return (
    <div class="flex h-full flex-col bg-black select-none">
      {/* Sidebar Header */}
      <div class="border-orange border-b-2 bg-[#050D1C] p-4">
        <div class="mb-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 animate-pulse bg-green-500" />
            <h2 class="font-pixel text-orange text-[10px] font-bold tracking-wider uppercase">
              MESSAGES
            </h2>
          </div>
          <Show when={totalUnread() > 0}>
            <Badge variant="primary" size="xs">
              {totalUnread()} NEW
            </Badge>
          </Show>
        </div>

        {/* Aligned New Transmission Tactical Button with Ample Boundary */}
        <button
          type="button"
          onClick={() => openModal("new-conversation")}
          title="Initialize new end-to-end encrypted transmission"
          class="border-orange hover:bg-orange text-orange font-pixel group flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 border-2 bg-[#071328] px-3 py-2.5 text-[9px] font-bold tracking-wide uppercase shadow-[2px_2px_0_#0C254D] transition-all duration-150 hover:text-black active:translate-x-0.5 active:translate-y-0.5"
        >
          <PlusIcon class="text-orange h-4 w-4 flex-shrink-0 group-hover:text-black" />
          <span class="tracking-wide whitespace-nowrap">NEW TRANSMISSION</span>
        </button>

        {/* Filter Input */}
        <div class="border-dark-gray/80 focus-within:border-orange relative mt-3 flex min-h-[38px] items-center border bg-black px-2.5 py-1.5">
          <SearchIcon class="text-orange mr-2 h-3.5 w-3.5 flex-shrink-0" />
          <input
            type="text"
            placeholder="FILTER CALLSIGNS..."
            class="font-pixel placeholder-gray w-full bg-transparent text-[8px] text-white focus:outline-none"
            value={filterQuery()}
            onInput={(e) => setFilterQuery(e.currentTarget.value)}
          />
          <Show when={filterQuery()}>
            <button
              type="button"
              onClick={() => setFilterQuery("")}
              class="text-gray font-pixel px-1 text-[8px] hover:text-white"
              title="Clear filter"
            >
              ✕
            </button>
          </Show>
        </div>
      </div>

      {/* Vertical Conversation List */}
      <div class="scrollbar-pixel flex-1 space-y-1 overflow-y-auto p-2">
        <For each={sortedRooms()}>
          {(room) => {
            const isActive = () => activeRoomId() === room.id;
            const other = () =>
              room.participants?.find((p: Participant) => p.user_id !== currentUser()?.id);
            const displayName = () =>
              room.name ?? other()?.display_name ?? other()?.username ?? "TRANSMISSION";
            const initials = () => displayName().slice(0, 2).toUpperCase();
            const otherId = () => other()?.user_id;

            return (
              <button
                type="button"
                data-room-id={room.id}
                onClick={() => {
                  setActiveRoom(room.id);
                  if (typeof window !== "undefined" && window.innerWidth < 640) {
                    $sidebarOpen.set(false);
                  }
                }}
                class={`flex w-full items-center gap-3 border-2 p-2.5 text-left transition-all duration-100 ${
                  isActive()
                    ? "border-orange bg-orange font-bold text-black shadow-[2px_2px_0_#000]"
                    : "border-dark-gray/60 hover:border-orange bg-black text-white hover:bg-[#091833]"
                }`}
              >
                {/* Avatar with Online Status */}
                <div class="relative flex-shrink-0">
                  <div
                    class={`font-pixel flex h-9 w-9 items-center justify-center border-2 text-[10px] font-bold ${
                      isActive()
                        ? "text-orange border-black bg-black"
                        : "border-orange/70 text-orange bg-[#050D1C]"
                    }`}
                  >
                    {initials()}
                  </div>
                  <Show when={otherId()}>
                    <div class="absolute -right-1 -bottom-1">
                      <OnlineStatus status={getUserStatus(otherId()!)} size="sm" />
                    </div>
                  </Show>
                </div>

                {/* Text Content */}
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-1">
                    <span
                      class={`font-pixel truncate text-[10px] font-bold ${
                        isActive() ? "text-black" : "text-white"
                      }`}
                    >
                      {displayName()}
                    </span>
                    <Show when={room.last_message?.created_at}>
                      <span
                        class={`flex-shrink-0 font-mono text-[8px] ${
                          isActive() ? "font-bold text-black/80" : "text-gray"
                        }`}
                      >
                        {formatMsgTime(room.last_message?.created_at)}
                      </span>
                    </Show>
                  </div>

                  <div class="mt-0.5 flex items-center justify-between gap-2">
                    <p
                      class={`font-pixel truncate text-[8px] ${
                        isActive() ? "text-black/80" : "text-gray"
                      }`}
                    >
                      {room.last_message?.content ?? "ENCRYPTED CHANNEL ESTABLISHED"}
                    </p>
                    <Show when={room.unread_count > 0 && !isActive()}>
                      <span class="py-0.2 bg-orange font-pixel flex-shrink-0 px-1 text-[7px] font-bold text-black">
                        {room.unread_count}
                      </span>
                    </Show>
                  </div>
                </div>
              </button>
            );
          }}
        </For>

        <Show when={sortedRooms().length === 0}>
          <div class="border-dark-gray/60 my-4 border border-dashed bg-[#050D1C] p-6 text-center">
            <p class="font-pixel text-gray text-[8px] leading-relaxed uppercase">
              {filterQuery() ? "NO MATCHING CALLSIGNS FOUND" : "NO ACTIVE TRANSMISSIONS"}
            </p>
            <p class="font-pixel text-orange/70 mt-1 text-[7px]">
              CLICK + NEW TRANSMISSION TO INITIATE E2EE CONTACT
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}

function PlusIcon(props: { class?: string }): JSX.Element {
  return (
    <svg
      class={props.class ?? "h-4 w-4"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon(props: { class?: string }): JSX.Element {
  return (
    <svg
      class={props.class ?? "text-orange h-3.5 w-3.5"}
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
