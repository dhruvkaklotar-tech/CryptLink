/**
 * 8-bit styled modal component
 */

import type { JSX } from "solid-js";
import { createEffect, onCleanup, Show } from "solid-js";
import type { ModalProps, ModalSize } from "../../types";
import { IconButton } from "./IconButton";

const SIZE_CLASSES: Record<ModalSize, string> = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-5xl",
  "3xl": "max-w-6xl",
  "4xl": "max-w-7xl",
  full: "max-w-[95vw]",
};

export function Modal(props: ModalProps): JSX.Element {
  const size = (): ModalSize => props.size ?? "md";
  const closeOnOverlayClick = (): boolean => props.closeOnOverlayClick ?? true;
  const showCloseButton = (): boolean => props.showCloseButton ?? true;

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  createEffect(() => {
    if (props.isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    });
  });

  const handleOverlayKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (closeOnOverlayClick()) {
        props.onClose();
      }
    }
  };

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          class="animate-fade-in absolute inset-0 h-full w-full cursor-default appearance-none border-0 bg-black/80"
          tabIndex={-1}
          aria-label="Close modal"
          onClick={() => {
            if (closeOnOverlayClick()) props.onClose();
          }}
          onKeyDown={handleOverlayKeyDown}
        />

        <div
          class={`border-orange animate-scale-in relative z-10 flex max-h-[90vh] w-full flex-col border-4 bg-black shadow-[8px_8px_0_var(--color-orange)] ${SIZE_CLASSES[size()]} ${props.class ?? ""} `}
          role="dialog"
          aria-modal="true"
          aria-labelledby={props.title ? "modal-title" : undefined}
        >
          <Show when={(props.title !== undefined && props.title !== "") || showCloseButton()}>
            <div class="border-orange flex-shrink-0 flex items-start justify-between border-b-2 p-4">
              <div class="flex-1">
                <Show when={props.title}>
                  <h2 id="modal-title" class="font-pixel text-orange text-sm uppercase">
                    {props.title}
                  </h2>
                </Show>
                <Show when={props.description}>
                  <p class="font-pixel text-gray mt-1 text-[10px]">{props.description}</p>
                </Show>
              </div>

              <Show when={showCloseButton()}>
                <IconButton
                  icon={<CloseIcon />}
                  ariaLabel="Close modal"
                  onClick={props.onClose}
                  size="sm"
                  variant="ghost"
                />
              </Show>
            </div>
          </Show>

          <div class="scrollbar-pixel flex-1 overflow-y-auto p-4">{props.children}</div>
        </div>
      </div>
    </Show>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 2L14 14M14 2L2 14"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="square"
      />
    </svg>
  );
}
