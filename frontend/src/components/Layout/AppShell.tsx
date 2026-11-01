/**
 * Main application shell layout - Clean Military C4ISR Architecture
 */

import { useStore } from "@nanostores/solid";
import type { JSX, ParentProps } from "solid-js";
import { Show } from "solid-js";
import { $isMobile, $sidebarOpen } from "../../stores";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps extends ParentProps {
  showSidebar?: boolean;
  showHeader?: boolean;
}

export function AppShell(props: AppShellProps): JSX.Element {
  const sidebarOpen = useStore($sidebarOpen);
  const isMobile = useStore($isMobile);

  const showSidebar = (): boolean => props.showSidebar ?? true;
  const showHeader = (): boolean => props.showHeader ?? true;

  return (
    <div class="flex h-screen w-screen flex-col overflow-hidden bg-black text-white">
      <Show when={showHeader()}>
        <Header />
      </Show>

      <div class="flex flex-1 overflow-hidden">
        <Show when={showSidebar() && sidebarOpen()}>
          <div class="border-orange h-full w-72 flex-shrink-0 overflow-hidden border-r-2 bg-black sm:w-80">
            <Sidebar />
          </div>
        </Show>

        <main class="tactical-grid-bg relative flex flex-1 flex-col overflow-hidden bg-black">
          {props.children}
        </main>
      </div>

      <Show when={isMobile() && sidebarOpen()}>
        <button
          type="button"
          class="fixed inset-0 z-30 h-full w-full cursor-default appearance-none border-0 bg-black/80"
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
