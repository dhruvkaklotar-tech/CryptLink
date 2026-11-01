/**
 * Protected route wrapper that redirects unauthenticated users
 */

import { useStore } from "@nanostores/solid";
import { useLocation, useNavigate } from "@solidjs/router";
import type { JSX, ParentProps } from "solid-js";
import { createEffect, Show } from "solid-js";
import { $isAuthenticated } from "../../stores";
import { Spinner } from "../UI/Spinner";

interface ProtectedRouteProps extends ParentProps {
  redirectTo?: string;
}

export function ProtectedRoute(props: ProtectedRouteProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useStore($isAuthenticated);

  const redirectPath = (): string => props.redirectTo ?? "/login";

  createEffect(() => {
    if (!isAuthenticated()) {
      const currentPath = location.pathname;
      const redirectUrl =
        currentPath !== "/"
          ? `${redirectPath()}?redirect=${encodeURIComponent(currentPath)}`
          : redirectPath();

      navigate(redirectUrl, { replace: true });
    }
  });

  return (
    <Show
      when={isAuthenticated()}
      fallback={
        <div class="flex h-full items-center justify-center bg-black">
          <div class="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <span class="font-pixel text-orange text-[10px]">AUTHENTICATING...</span>
          </div>
        </div>
      }
    >
      {props.children}
    </Show>
  );
}

export function GuestRoute(props: ParentProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useStore($isAuthenticated);

  createEffect(() => {
    if (isAuthenticated()) {
      const params = new URLSearchParams(location.search);
      const redirectPath = params.get("redirect") ?? "/chat";
      navigate(redirectPath, { replace: true });
    }
  });

  return (
    <Show
      when={!isAuthenticated()}
      fallback={
        <div class="flex h-full items-center justify-center bg-black">
          <div class="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <span class="font-pixel text-orange text-[10px]">REDIRECTING...</span>
          </div>
        </div>
      }
    >
      {props.children}
    </Show>
  );
}
