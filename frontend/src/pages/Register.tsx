// ===================
// © AngelaMos | 2025
// Registration page with WebAuthn passkey creation
// ===================

import type { JSX } from "solid-js";
import { AuthForm } from "../components/Auth";
import { GuestRoute } from "../components/Layout";

export default function Register(): JSX.Element {
  return (
    <GuestRoute>
      <div class="flex min-h-screen items-center justify-center bg-black p-4">
        <AuthForm mode="register" />
      </div>
    </GuestRoute>
  );
}
