/**
 * 8-bit styled tooltip component
 */

import type { JSX } from "solid-js";
import { createSignal, onCleanup, Show } from "solid-js";
import type { TooltipProps } from "../../types";

type TooltipPosition = "top" | "bottom" | "left" | "right";

const POSITION_CLASSES: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const ARROW_CLASSES: Record<TooltipPosition, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-orange border-x-transparent border-b-transparent",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 border-b-orange border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-orange border-y-transparent border-r-transparent",
  right:
    "right-full top-1/2 -translate-y-1/2 border-r-orange border-y-transparent border-l-transparent",
};

const DEFAULT_DELAY_MS = 300;

export function Tooltip(props: TooltipProps): JSX.Element {
  const [visible, setVisible] = createSignal(false);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const position = (): TooltipPosition => props.position ?? "top";
  const delay = (): number => props.delay ?? DEFAULT_DELAY_MS;

  const showTooltip = (): void => {
    timeoutId = setTimeout(() => {
      setVisible(true);
    }, delay());
  };

  const hideTooltip = (): void => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    setVisible(false);
  };

  onCleanup(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  });

  return (
    <span
      class="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {props.children}

      <Show when={visible()}>
        <div
          class={`pointer-events-none absolute z-50 ${POSITION_CLASSES[position()]} `}
          role="tooltip"
        >
          <div
            class={`border-orange font-pixel animate-fade-in relative border-2 bg-black px-2 py-1 text-[8px] whitespace-nowrap text-white shadow-[2px_2px_0_var(--color-orange)]`}
          >
            {props.content}
            <span class={`absolute h-0 w-0 border-4 ${ARROW_CLASSES[position()]} `} />
          </div>
        </div>
      </Show>
    </span>
  );
}
