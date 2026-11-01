// ===================
// CryptLink Cryptographic Engine
// MilitaryTelemetryBar.tsx - Real-Time Tactical Military Operations & DTG Banner
// ===================

import type { JSX } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";

export function MilitaryTelemetryBar(): JSX.Element {
  const [dtg, setDtg] = createSignal("");
  const [randomFreq, setRandomFreq] = createSignal("142.850");

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
    const year = String(now.getUTCFullYear()).slice(2);
    setDtg(`${day}${hours}${mins}:${secs}Z ${month} ${year}`);
  };

  onMount(() => {
    updateDTG();
    const timer = setInterval(updateDTG, 1000);
    const freqTimer = setInterval(() => {
      // Simulate frequency agile hopping in military band (136.000 - 174.000 MHz)
      const base = 142.0 + Math.random() * 8.0;
      setRandomFreq(base.toFixed(3));
    }, 4000);

    onCleanup(() => {
      clearInterval(timer);
      clearInterval(freqTimer);
    });
  });

  return (
    <div class="border-orange/40 font-pixel flex-shrink-0 overflow-hidden border-b bg-black text-[7px] tracking-wider select-none sm:text-[8px]">
      {/* Top micro hazard bar */}
      <div class="hazard-stripes-plum h-[2px] w-full opacity-80" />

      <div class="text-gray flex flex-wrap items-center justify-between gap-2 bg-[#061022] px-3 py-1">
        {/* Left: Classification & DEFCON */}
        <div class="flex items-center gap-2">
          <span class="border-orange text-orange inline-flex items-center gap-1.5 border bg-[#0A1938] px-1.5 py-0.5 font-bold">
            <span class="bg-orange animate-mil-blip inline-block h-1.5 w-1.5" />
            TOP SECRET // NOFORN // TS-SCI
          </span>

          <span class="border-dark-gray hidden items-center gap-1 border px-1.5 py-0.5 text-white sm:inline-flex">
            <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-none bg-green-500" />
            DEFCON 1: MAXIMUM READINESS
          </span>
        </div>

        {/* Center: Live Zulu DTG Clock */}
        <div class="flex items-center gap-1.5 text-white/90">
          <span class="text-orange font-bold">DTG:</span>
          <span class="font-mono text-[9px] tracking-normal text-[#38BDF8]">
            {dtg() || "301630Z OCT 26"}
          </span>
        </div>

        {/* Right: Telemetry & ECCM Status */}
        <div class="hidden items-center gap-3 md:flex">
          <div class="flex items-center gap-1">
            <span class="text-gray">FREQ:</span>
            <span class="font-mono text-white">{randomFreq()} MHz</span>
            <span class="text-orange border-orange/40 border px-0.5 text-[7px]">HOPPING</span>
          </div>

          <div class="flex items-center gap-1">
            <span class="text-gray">COMSEC:</span>
            <span class="font-bold text-green-400">E2EE ACTIVE</span>
          </div>

          <div class="flex items-center gap-1 text-[#38BDF8]">
            <span class="text-gray">SIGINT ASSURANCE:</span>
            <span class="font-bold">99.99%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
