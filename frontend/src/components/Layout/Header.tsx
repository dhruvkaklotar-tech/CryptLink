/**
// CryptLink Tactical C4ISR Header
// Header.tsx - Aligned Navigation, Clear Search, and Sized Profile Box
 */

import { useStore } from "@nanostores/solid";
import { A, useLocation } from "@solidjs/router";
import type { JSX } from "solid-js";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  $currentUser,
  $isAuthenticated,
  $sidebarOpen,
  openModal,
  toggleSidebar,
} from "../../stores";
import { IconButton } from "../UI/IconButton";

export function Header(): JSX.Element {
  const isAuthenticated = useStore($isAuthenticated);
  const sidebarOpen = useStore($sidebarOpen);
  const currentUser = useStore($currentUser);
  const location = useLocation();
  const [dtg, setDtg] = createSignal("");

  const updateDTG = (): void => {
    const now = new Date();
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    const mins = String(now.getUTCMinutes()).padStart(2, "0");
    const secs = String(now.getUTCSeconds()).padStart(2, "0");
    const months = [
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL",
      "AUG",
      "SEP",
      "OCT",
      "NOV",
      "DEC",
    ];
    const month = months[now.getUTCMonth()];
    setDtg(`${day}${hours}${mins}:${secs}Z ${month}`);
  };

  onMount(() => {
    updateDTG();
    const timer = setInterval(updateDTG, 1000);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <header class="border-orange flex-shrink-0 border-b-2 bg-black select-none">
      <div class="flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
        {/* Left: Menu toggle + Logo + DEFCON tag */}
        <div class="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          <Show when={isAuthenticated()}>
            <IconButton
              icon={sidebarOpen() ? <CloseMenuIcon /> : <MenuIcon />}
              ariaLabel={sidebarOpen() ? "Close menu" : "Open menu"}
              onClick={toggleSidebar}
              size="sm"
            />
          </Show>

          <A href="/" class="flex items-center gap-2 hover:no-underline">
            <LockIcon />
            <h1 class="font-pixel text-orange text-xs font-bold tracking-wider uppercase sm:text-sm">
              CRYPTLINK
            </h1>
          </A>

          <span class="border-orange/60 font-pixel hidden items-center gap-1 border bg-[#0A1938] px-1.5 py-0.5 text-[7px] text-[#38BDF8] sm:inline-flex">
            DEFCON 1
          </span>
        </div>

        {/* Center: Live Zulu DTG Telemetry */}
        <div class="border-dark-gray/80 hidden items-center gap-2 border bg-[#050D1C] px-2.5 py-1 md:flex">
          <span class="inline-block h-1.5 w-1.5 animate-pulse bg-green-500" />
          <span class="font-pixel text-gray text-[7px] uppercase">DTG:</span>
          <span class="font-mono text-[10px] font-bold tracking-wider text-white">
            {dtg() || "301645Z OCT"}
          </span>
          <span class="text-dark-gray">|</span>
          <span class="font-pixel text-[7px] text-[#38BDF8]">E2EE: ACTIVE</span>
        </div>

        {/* Right: Visible Search + Sized Tactical Profile Box */}
        <nav class="flex flex-shrink-0 items-center gap-2">
          <Show
            when={isAuthenticated()}
            fallback={
              <div class="flex items-center gap-2">
                <A
                  href="/login"
                  class="font-pixel hover:text-orange hover:border-orange border border-transparent px-3 py-1.5 text-[9px] text-white transition-colors"
                >
                  LOGIN
                </A>
                <A
                  href="/register"
                  class="font-pixel bg-orange px-3 py-1.5 text-[9px] font-bold text-black transition-colors hover:bg-white"
                >
                  REGISTER
                </A>
              </div>
            }
          >
            {/* High-Visibility Search Button */}
            <button
              type="button"
              onClick={() => openModal("new-conversation")}
              title="Search users & start new transmission"
              aria-label="Search users"
              class="border-orange/60 hover:border-orange hover:bg-orange/15 text-orange font-pixel flex h-9 items-center gap-2 border-2 bg-black px-3 text-[8px] shadow-[1px_1px_0_#0C254D] transition-colors"
            >
              <SearchIcon class="text-orange h-4 w-4" />
              <span class="hidden font-bold sm:inline">SEARCH</span>
            </button>

            {/* Sized Tactical Profile Box with Generous Line Spacing */}
            <Show when={currentUser()} keyed>
              {(user) => (
                <A
                  href="/settings"
                  title="Tactical Callsign & Cryptographic Settings"
                  class={`flex min-h-[46px] items-center gap-3 border-2 px-4 py-1.5 transition-all duration-150 ${
                    location.pathname === "/settings"
                      ? "border-orange bg-orange text-black shadow-[2px_2px_0_#000]"
                      : "border-orange hover:border-orange hover:bg-orange/20 hover:text-orange bg-[#071224] text-white shadow-[2px_2px_0_#0C254D]"
                  }`}
                >
                  <div class="border-orange text-orange flex h-7 w-7 flex-shrink-0 items-center justify-center border bg-black">
                    <TacticalUserIcon class="h-4 w-4" />
                  </div>
                  <div class="flex flex-col justify-center space-y-1.5 py-0.5 text-left">
                    <span class="font-pixel block text-[8px] tracking-wider text-[#38BDF8] uppercase">
                      CALLSIGN
                    </span>
                    <span class="font-pixel block max-w-[150px] truncate text-[11px] font-bold tracking-wide uppercase">
                      {user.display_name}
                    </span>
                  </div>
                </A>
              )}
            </Show>
          </Show>
        </nav>
      </div>
    </header>
  );
}

function MenuIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseMenuIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
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

function LockIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="text-orange"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function SearchIcon(props: { class?: string }): JSX.Element {
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

function TacticalUserIcon(props: { class?: string }): JSX.Element {
  return (
    <svg
      class={props.class ?? "h-3.5 w-3.5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
