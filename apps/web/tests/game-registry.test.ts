import { describe, expect, it } from "vitest";

import { getGameModule, getRegisteredGames } from "../lib/games/registry";

describe("game registry", () => {
  it("resolves the racer module from the generic registry", () => {
    const module = getGameModule("racer-poc");

    expect(module.definition.slug).toBe("racer-poc");
    expect(getRegisteredGames().map((entry) => entry.definition.slug)).toContain("racer-poc");
  });

  it("resolves the memory module from the generic registry", () => {
    const module = getGameModule("memory");

    expect(module.definition.slug).toBe("memory");
    expect(getRegisteredGames().map((entry) => entry.definition.slug)).toContain("memory");
  });

  it("rejects unknown game slugs", () => {
    expect(() => getGameModule("unknown-module")).toThrowError("game_not_found");
  });
});
