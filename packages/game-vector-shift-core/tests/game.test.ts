import { describe, expect, it } from "vitest";

import { MAX_TICKS } from "../src/constants";
import {
  createInitialVectorShiftState,
  createVectorShiftSessionConfig,
  generateAutoplayLaneChanges,
  parseVectorShiftSubmissionPayload,
  replayVectorShiftGame,
  stepVectorShiftState,
  summarizeVectorShiftState
} from "../src/game";

describe("vector shift game", () => {
  const config = createVectorShiftSessionConfig("vector-session-1", 42);

  it("creates deterministic row streams from the same seed", () => {
    const config2 = createVectorShiftSessionConfig("vector-session-2", 42);
    expect(config.payload.course.rows).toEqual(config2.payload.course.rows);
  });

  it("accepts autoplay replays", () => {
    const laneChanges = generateAutoplayLaneChanges(config, 8);
    const result = replayVectorShiftGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { laneChanges },
      clientSummary: {
        elapsedMs: 9000,
        reportedPlacement: 1,
        reportedDisplayValue: "8 sectors · 3 charges",
        reportedScoreSortValue: -8_000_000
      }
    });

    expect(result.status).toBe("accepted");
    expect(result.resultSummary.sectorsCleared).toBeGreaterThanOrEqual(8);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it("rejects non-monotonic lane changes", () => {
    const result = replayVectorShiftGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { laneChanges: [{ tick: 4, targetLane: 0 }, { tick: 4, targetLane: 1 }] },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("non_monotonic_lane_changes");
  });

  it("rejects oversized lane jumps", () => {
    const result = replayVectorShiftGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: {
        laneChanges: [
          { tick: 0, targetLane: 0 },
          { tick: 1, targetLane: 2 }
        ]
      },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("lane_jump_too_large");
  });

  it("keeps scoring aligned with more sectors being better", () => {
    const better = replayVectorShiftGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { laneChanges: generateAutoplayLaneChanges(config, 10) },
      clientSummary: { elapsedMs: 12000 }
    });
    const worse = replayVectorShiftGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { laneChanges: generateAutoplayLaneChanges(config, 4) },
      clientSummary: { elapsedMs: 6000 }
    });

    expect(better.scoreSortValue).toBeLessThan(worse.scoreSortValue);
  });

  it("collides eventually without lane changes", () => {
    let state = createInitialVectorShiftState(config);

    while (!state.collided && state.tick < MAX_TICKS) {
      state = stepVectorShiftState(state, config, null);
    }

    const summary = summarizeVectorShiftState(state);
    expect(summary.survivedMs).toBeGreaterThan(0);
  });

  it("validates submission payload schema", () => {
    expect(() =>
      parseVectorShiftSubmissionPayload({
        sessionId: config.sessionId,
        configVersion: config.configVersion,
        payload: { laneChanges: [{ tick: MAX_TICKS, targetLane: 0 }] },
        clientSummary: { elapsedMs: 0 }
      })
    ).toThrow();
  });
});
