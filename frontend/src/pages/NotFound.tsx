/**
 * 404 Not Found page
 */

import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Button } from "../components/UI";

export default function NotFound(): JSX.Element {
  return (
    <div class="flex min-h-screen flex-col items-center justify-center bg-black p-4">
      <div class="text-center">
        <h1 class="font-pixel text-orange mb-4 text-6xl">404</h1>

        <p class="font-pixel mb-2 text-sm text-white">PAGE NOT FOUND</p>

        <p class="font-pixel text-gray mb-8 text-[10px]">
          THE PAGE YOU ARE LOOKING FOR DOES NOT EXIST
        </p>

        <A href="/">
          <Button variant="primary" size="lg">
            GO HOME
          </Button>
        </A>
      </div>
    </div>
  );
}
