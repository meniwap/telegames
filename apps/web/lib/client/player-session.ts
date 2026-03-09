"use client";

import type { BootstrapPayload } from "@/lib/types";

function wait(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export async function waitForAuthenticatedPlayer(options?: { maxAttempts?: number; intervalMs?: number }) {
  const maxAttempts = options?.maxAttempts ?? 24;
  const intervalMs = options?.intervalMs ?? 150;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch("/api/bootstrap", {
      method: "GET",
      cache: "no-store",
      headers: {
        "cache-control": "no-store"
      }
    });

    if (response.ok) {
      const payload = (await response.json()) as BootstrapPayload;
      if (payload.player) {
        return true;
      }
    }

    if (attempt < maxAttempts - 1) {
      await wait(intervalMs);
    }
  }

  return false;
}
