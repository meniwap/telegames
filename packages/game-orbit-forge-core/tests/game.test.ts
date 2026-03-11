import { describe, expect, it } from "vitest";

import { MAX_TICKS } from "../src/constants";
import {
  createInitialOrbitForgeState,
  createOrbitForgeSessionConfig,
  generateAutoplayOrbitInputs,
  parseOrbitForgeSubmissionPayload,
  replayOrbitForgeGame,
  stepOrbitForgeState,
  summarizeOrbitForgeState
} from "../src/game";

describe("orbit forge game", () => {
  const config = createOrbitForgeSessionConfig("orbit-session-1", 42);

  it("creates deterministic event streams from the same seed", () => {
    const config2 = createOrbitForgeSessionConfig("orbit-session-2", 42);
    expect(config.payload.course.events).toEqual(config2.payload.course.events);
  });

  it("accepts autoplay replays", () => {
    const controls = generateAutoplayOrbitInputs(config, 10);
    const result = replayOrbitForgeGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: controls,
      clientSummary: {
        elapsedMs: 18000,
        reportedPlacement: 1,
        reportedDisplayValue: "10 gates · 18.0s",
        reportedScoreSortValue: -10_000_000
      }
    });

    expect(result.status).toBe("accepted");
    expect(result.resultSummary.gatesCleared).toBeGreaterThanOrEqual(10);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it("rejects non-monotonic swap ticks", () => {
    const result = replayOrbitForgeGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { swapTicks: [4, 4], phaseWindows: [] },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("non_monotonic_swap_ticks");
  });

  it("rejects oversized phase windows", () => {
    const result = replayOrbitForgeGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: {
        swapTicks: [],
        phaseWindows: [{ startTick: 1, endTick: 12 }]
      },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("phase_window_too_long");
  });

  it("keeps scoring aligned with more gates being better", () => {
    const betterControls = generateAutoplayOrbitInputs(config, 12);
    const worseControls = generateAutoplayOrbitInputs(config, 5);
    const better = replayOrbitForgeGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: betterControls,
      clientSummary: { elapsedMs: 20000 }
    });
    const worse = replayOrbitForgeGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: worseControls,
      clientSummary: { elapsedMs: 9000 }
    });

    expect(better.scoreSortValue).toBeLessThan(worse.scoreSortValue);
  });

  it("collides eventually without swaps", () => {
    let state = createInitialOrbitForgeState(config);

    while (!state.collided && state.tick < MAX_TICKS) {
      state = stepOrbitForgeState(state, config, { shouldSwap: false, phaseActive: false });
    }

    const summary = summarizeOrbitForgeState(state);
    expect(summary.survivedMs).toBeGreaterThan(0);
  });

  it("validates submission payload schema", () => {
    expect(() =>
      parseOrbitForgeSubmissionPayload({
        sessionId: config.sessionId,
        configVersion: config.configVersion,
        payload: { swapTicks: [MAX_TICKS], phaseWindows: [] },
        clientSummary: { elapsedMs: 0 }
      })
    ).toThrow();
  });
});
