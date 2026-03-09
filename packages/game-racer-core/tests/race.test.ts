import { describe, expect, it } from "vitest";

import { INPUT_BRAKE, INPUT_LEFT, INPUT_RIGHT } from "../src/constants";
import { createInitialRaceState, createRacerSessionConfig, evaluateRewards, replayRace, stepRaceState } from "../src/race";

describe("race core", () => {
  it("produces deterministic progression for the same replay", () => {
    const config = createRacerSessionConfig("session-1", 42);
    const frames = Array.from({ length: 5200 }, (_, index) => {
      if (index % 190 < 20) {
        return INPUT_LEFT;
      }

      if (index % 240 > 180 && index % 240 < 210) {
        return INPUT_RIGHT | INPUT_BRAKE;
      }

      return 0;
    });

    const first = replayRace(config, {
      sessionId: "session-1",
      configVersion: config.configVersion,
      payload: {
        frames
      },
      clientSummary: {
        elapsedMs: 70000,
        reportedPlacement: 3,
        reportedScoreSortValue: 69000
      }
    });

    const second = replayRace(config, {
      sessionId: "session-1",
      configVersion: config.configVersion,
      payload: {
        frames
      },
      clientSummary: {
        elapsedMs: 70000,
        reportedPlacement: 3,
        reportedScoreSortValue: 69000
      }
    });

    expect(first.resultSummary.officialTimeMs).toBe(second.resultSummary.officialTimeMs);
    expect(first.placement).toBe(second.placement);
  });

  it("applies rewards based on placement and finish time", () => {
    const rewards = evaluateRewards(2, 64000);

    expect(rewards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entryType: "xp", amount: expect.any(Number) }),
        expect.objectContaining({ entryType: "coins", amount: expect.any(Number) })
      ])
    );
  });

  it("rejects impossible frame values", () => {
    const config = createRacerSessionConfig("session-2", 99);
    const result = replayRace(config, {
      sessionId: "session-2",
      configVersion: config.configVersion,
      payload: {
        frames: [8]
      },
      clientSummary: {
        elapsedMs: 16,
        reportedPlacement: 1,
        reportedScoreSortValue: 16
      }
    });

    expect(result.status).toBe("rejected");
    expect(result.rejectedReason).toBe("invalid_input_mask");
  });

  it("advances race state and ranks racers", () => {
    const config = createRacerSessionConfig("session-3", 77);
    const state = createInitialRaceState(config);

    for (let frame = 0; frame < 600; frame += 1) {
      stepRaceState(state, config, frame % 90 < 10 ? INPUT_LEFT : 0);
    }

    expect(state.elapsedMs).toBeGreaterThan(0);
    expect(state.racers[0]?.place).toBeGreaterThan(0);
  });
});
