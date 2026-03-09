import { afterEach, describe, expect, it, vi } from "vitest";

import { waitForAuthenticatedPlayer } from "../lib/client/player-session";

describe("player session bootstrap", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns true once bootstrap exposes an authenticated player", async () => {
    let attempts = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        attempts += 1;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            player: attempts >= 3 ? { id: "player_1" } : null
          })
        });
      })
    );

    await expect(waitForAuthenticatedPlayer({ maxAttempts: 4, intervalMs: 0 })).resolves.toBe(true);
  });

  it("returns false when bootstrap never exposes an authenticated player", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              player: null
            })
        })
      )
    );

    await expect(waitForAuthenticatedPlayer({ maxAttempts: 2, intervalMs: 0 })).resolves.toBe(false);
  });
});
