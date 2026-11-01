// ===================
// CryptLink Cryptographic Engine
// AuthForm.tsx - Secure WebAuthn Passkey Authentication Form
// ===================

import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { validateUsername } from "../../lib/validators";
import { authService } from "../../services";
import { showToast } from "../../stores";
import { ApiError } from "../../types";
import { Input } from "../UI/Input";
import { AuthCard } from "./AuthCard";
import { PasskeyButton } from "./PasskeyButton";

type AuthMode = "login" | "register";

interface AuthFormProps {
  mode: AuthMode;
}

export function AuthForm(props: AuthFormProps): JSX.Element {
  const [username, setUsername] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [usernameError, setUsernameError] = createSignal<string | undefined>();

  const isRegister = (): boolean => props.mode === "register";

  const title = (): string => (isRegister() ? "CREATE ACCOUNT" : "SECURE SIGN IN");

  const subtitle = (): string =>
    isRegister()
      ? "ENTER USERNAME TO REGISTER A SECURE WEBAUTHN PASSKEY"
      : "ENTER USERNAME OR SIGN IN DIRECTLY WITH YOUR PASSKEY";

  const validateForm = (): boolean => {
    let valid = true;

    if (isRegister()) {
      const usernameResult = validateUsername(username().trim());
      if (!usernameResult.valid) {
        setUsernameError(usernameResult.error);
        valid = false;
      } else {
        setUsernameError(undefined);
      }
    }

    return valid;
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isRegister()) {
        const u = username().trim();
        await authService.register(u, u);
        showToast("success", "REGISTRATION COMPLETE", "YOUR PASSKEY HAS BEEN CREATED");
      } else {
        const trimmedUsername = username().trim();
        const usernameValue = trimmedUsername === "" ? undefined : trimmedUsername;
        await authService.login(usernameValue);
        showToast("success", "LOGIN SUCCESSFUL", "WELCOME BACK");
      }
    } catch (error) {
      let message = "AN UNEXPECTED ERROR OCCURRED";

      if (error instanceof ApiError) {
        message = error.message.toUpperCase();
      } else if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          message = "PASSKEY OPERATION CANCELLED";
        } else if (error.name === "InvalidStateError") {
          message = "PASSKEY ALREADY REGISTERED";
        } else {
          message = error.message.toUpperCase();
        }
      }

      showToast("error", isRegister() ? "REGISTRATION FAILED" : "LOGIN FAILED", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title={title()} subtitle={subtitle()}>
      <div class="space-y-6 sm:space-y-8">
        <div>
          <Input
            name="username"
            label="USERNAME"
            placeholder={isRegister() ? "ENTER USERNAME (3-32 CHARS)" : "ENTER USERNAME"}
            value={username()}
            onInput={(val) => {
              setUsername(val);
              if (usernameError()) setUsernameError(undefined);
            }}
            error={usernameError()}
            required={isRegister()}
            disabled={loading()}
            fullWidth
          />
        </div>

        <div class="pt-2">
          <PasskeyButton mode={props.mode} onClick={handleSubmit} loading={loading()} />
        </div>
      </div>

      <div class="border-dark-gray mt-8 border-t-2 pt-6">
        <p class="font-pixel text-gray text-center text-[10px]">
          <Show
            when={isRegister()}
            fallback={
              <>
                DON'T HAVE AN ACCOUNT?{" "}
                <A href="/register" class="text-orange hover:underline">
                  REGISTER
                </A>
              </>
            }
          >
            ALREADY HAVE AN ACCOUNT?{" "}
            <A href="/login" class="text-orange hover:underline">
              SIGN IN
            </A>
          </Show>
        </p>
      </div>
    </AuthCard>
  );
}
