/**
 * 8-bit styled textarea component
 */

import type { JSX } from "solid-js";
import { createEffect, createSignal, onMount, Show, splitProps } from "solid-js";
import type { TextAreaProps } from "../../types";

export function TextArea(props: TextAreaProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    "name",
    "placeholder",
    "value",
    "onInput",
    "disabled",
    "error",
    "label",
    "rows",
    "maxLength",
    "autoResize",
    "class",
  ]);

  const [focused, setFocused] = createSignal(false);
  let textareaRef: HTMLTextAreaElement | undefined;

  const handleInput: JSX.EventHandler<HTMLTextAreaElement, InputEvent> = (e) => {
    if (local.onInput !== undefined) {
      local.onInput(e.currentTarget.value);
    }

    if (local.autoResize === true && textareaRef !== undefined) {
      adjustHeight();
    }
  };

  const adjustHeight = (): void => {
    if (textareaRef !== undefined) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = `${textareaRef.scrollHeight}px`;
    }
  };

  onMount(() => {
    if (local.autoResize === true && textareaRef !== undefined) {
      adjustHeight();
    }
  });

  createEffect(() => {
    if (local.autoResize === true && local.value !== undefined && textareaRef !== undefined) {
      adjustHeight();
    }
  });

  const hasError = (): boolean => Boolean(local.error);
  const isDisabled = (): boolean => local.disabled ?? false;
  const currentLength = (): number => (local.value ?? "").length;

  return (
    <div class="flex w-full flex-col gap-1">
      <Show when={local.label}>
        <label
          class="font-pixel text-orange text-[10px] tracking-wider uppercase"
          for={local.name}
        >
          {local.label}
        </label>
      </Show>

      <div
        class={`relative border-2 bg-black transition-all duration-100 ${focused() ? "border-orange shadow-[0_0_0_2px_var(--color-orange)]" : "border-dark-gray"} ${hasError() ? "border-error shadow-[0_0_0_2px_var(--color-error)]" : ""} ${isDisabled() ? "cursor-not-allowed opacity-50" : ""} `}
      >
        <textarea
          ref={textareaRef}
          name={local.name}
          id={local.name}
          placeholder={local.placeholder}
          value={local.value ?? ""}
          disabled={isDisabled()}
          rows={local.rows ?? 3}
          maxLength={local.maxLength}
          onInput={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          class={`font-pixel placeholder:font-placeholder placeholder:text-gray w-full resize-none bg-transparent px-3 py-2 text-[16px] text-white placeholder:text-[16px] focus:outline-none disabled:cursor-not-allowed ${local.autoResize === true ? "overflow-hidden" : ""} ${local.class ?? ""} `}
          {...rest}
        />
      </div>

      <div class="flex justify-between">
        <Show when={local.error}>
          <span class="font-pixel text-error text-[8px]">{local.error}</span>
        </Show>
        <Show when={!local.error}>
          <span />
        </Show>

        <Show when={local.maxLength}>
          <span
            class={`font-pixel text-[8px] ${
              currentLength() > (local.maxLength ?? 0) * 0.9 ? "text-error" : "text-gray"
            }`}
          >
            {currentLength()}/{local.maxLength}
          </span>
        </Show>
      </div>
    </div>
  );
}
