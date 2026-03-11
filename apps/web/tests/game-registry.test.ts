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

  it("resolves the hopper module from the generic registry", () => {
    const module = getGameModule("skyline-hopper");

    expect(module.definition.slug).toBe("skyline-hopper");
    expect(getRegisteredGames().map((entry) => entry.definition.slug)).toContain("skyline-hopper");
  });

  it("resolves the signal stacker module from the generic registry", () => {
    const module = getGameModule("signal-stacker");

    expect(module.definition.slug).toBe("signal-stacker");
    expect(getRegisteredGames().map((entry) => entry.definition.slug)).toContain("signal-stacker");
  });

  it("resolves the vector shift module from the generic registry", () => {
    const module = getGameModule("vector-shift");

    expect(module.definition.slug).toBe("vector-shift");
    expect(getRegisteredGames().map((entry) => entry.definition.slug)).toContain("vector-shift");
  });

  it("rejects unknown game slugs", () => {
    expect(() => getGameModule("unknown-module")).toThrowError("game_not_found");
  });
});
