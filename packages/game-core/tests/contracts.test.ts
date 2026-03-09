import { describe, expect, it } from "vitest";

import type { GameDefinition, GameSessionConfig, OfficialGameResult } from "../src/types";

describe("game-core contracts", () => {
  it("supports genre-agnostic session and result shapes", () => {
    const definition: GameDefinition = {
      id: "module-1",
      slug: "module-1",
      name: "Module One",
      status: "live",
      tagline: "Generic contract test",
      description: "Ensures the shared package remains platform-generic.",
      coverLabel: "Test"
    };

    const session: GameSessionConfig<{ difficulty: string }> = {
      sessionId: "session-1",
      gameTitleId: definition.id,
      configVersion: "v1",
      seed: 7,
      createdAt: new Date(0).toISOString(),
      expiresAt: new Date(60_000).toISOString(),
      payload: {
        difficulty: "normal"
      }
    };

    const result: OfficialGameResult<{ summary: string }> = {
      sessionId: session.sessionId,
      gameTitleId: definition.id,
      status: "accepted",
      placement: 1,
      scoreSortValue: 1234,
      displayValue: "12.34s",
      elapsedMs: 1234,
      rewards: [],
      flags: [],
      resultSummary: {
        summary: "ok"
      }
    };

    expect(session.payload.difficulty).toBe("normal");
    expect(result.displayValue).toBe("12.34s");
    expect(result.resultSummary.summary).toBe("ok");
  });
});
