/**
 * Main application shell layout - Clean Military C4ISR Architecture
 */

import { useStore } from "@nanostores/solid";
import type { JSX, ParentProps } from "solid-js";
import { Show } from "solid-js";
import { $sidebarOpen } from "../../stores";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps extends ParentProps {
  showSidebar?: boolean;
  showHeader?: boolean;
}

export function AppShell(props: AppShellProps): JSX.Element {
  const sidebarOpen = useStore($sidebarOpen);

  const showSidebar = (): boolean => props.showSidebar ?? true;
  const showHeader = (): boolean => props.showHeader ?? true;

  return (
    <div class="flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-black text-white">
      <Show when={showHeader()}>
        <Header />
      </Show>

      <div class="relative flex flex-1 min-h-0 overflow-hidden">
        <Show when={showSidebar() && sidebarOpen()}>
          <div class="border-orange fixed sm:static inset-y-0 left-0 top-14 sm:top-0 z-40 h-[calc(100dvh-3.5rem)] sm:h-full w-72 sm:w-80 flex-shrink-0 overflow-hidden border-r-2 bg-black shadow-2xl transition-all duration-200">
            <Sidebar />
          </div>
        </Show>

        <main class="tactical-grid-bg relative flex flex-1 min-h-0 flex-col overflow-hidden bg-black w-full min-w-0">
          {props.children}
        </main>
      </div>

      <Show when={sidebarOpen()}>
        <button
          type="button"
          class="fixed inset-0 z-30 h-full w-full cursor-default appearance-none border-0 bg-black/80 backdrop-blur-xs sm:hidden"
          tabIndex={-1}
          aria-label="Close sidebar"
          onClick={() => $sidebarOpen.set(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") $sidebarOpen.set(false);
          }}
        />
      </Show>
    </div>
  );
}
