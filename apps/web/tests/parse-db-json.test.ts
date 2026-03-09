import { describe, expect, it } from "vitest";

import { parseDbJson } from "../lib/server/parse-db-json";

describe("parseDbJson", () => {
  it("returns objects unchanged", () => {
    const value = { payload: { track: { id: "track-neon-loop" } } };

    expect(parseDbJson(value)).toBe(value);
  });

  it("parses JSON strings returned by Postgres jsonb columns", () => {
    const value = "{\"sessionId\":\"game_123\",\"payload\":{\"track\":{\"id\":\"track-neon-loop\"}}}";

    expect(parseDbJson<{ sessionId: string; payload: { track: { id: string } } }>(value)).toEqual({
      sessionId: "game_123",
      payload: {
        track: {
          id: "track-neon-loop"
        }
      }
    });
  });

  it("leaves non-JSON strings untouched", () => {
    expect(parseDbJson("plain-text")).toBe("plain-text");
  });
});
