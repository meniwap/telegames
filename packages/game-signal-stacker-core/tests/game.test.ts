import { describe, expect, it } from "vitest";

import {
  createInitialSignalStackerState,
  createSignalStackerSessionConfig,
  generateAutoplayDropTicks,
  getMaxAllowedTick,
  parseSignalStackerSubmissionPayload,
  replaySignalStackerGame,
  stepSignalStackerState,
  summarizeSignalStackerState
} from "../src/game";

describe("signal stacker game", () => {
  const config = createSignalStackerSessionConfig("signal-session-1", 42);

  it("creates a deterministic session config from the same seed", () => {
    const config2 = createSignalStackerSessionConfig("signal-session-2", 42);
    expect(config.payload.tower).toEqual(config2.payload.tower);
  });

  it("accepts autoplay replays", () => {
    const dropTicks = generateAutoplayDropTicks(config, 7);
    const result = replaySignalStackerGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { dropTicks },
      clientSummary: {
        elapsedMs: dropTicks[dropTicks.length - 1]! * 50,
        reportedPlacement: 1,
        reportedDisplayValue: "7 floors · 7 perfect",
        reportedScoreSortValue: -7_000_000
      }
    });

    expect(result.status).toBe("accepted");
    expect(result.resultSummary.floorsStacked).toBeGreaterThanOrEqual(7);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it("rejects non-monotonic drop ticks", () => {
    const result = replaySignalStackerGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { dropTicks: [8, 6, 9] },
      clientSummary: { elapsedMs: 500 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("non_monotonic_drop_ticks");
  });

  it("rejects drop ticks outside the course budget", () => {
    const result = replaySignalStackerGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { dropTicks: [getMaxAllowedTick(config) + 1] },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("drop_tick_out_of_bounds");
  });

  it("keeps scoring aligned with taller towers being better", () => {
    const better = replaySignalStackerGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { dropTicks: generateAutoplayDropTicks(config, 8) },
      clientSummary: { elapsedMs: 12000 }
    });
    const worse = replaySignalStackerGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { dropTicks: generateAutoplayDropTicks(config, 4) },
      clientSummary: { elapsedMs: 9000 }
    });

    expect(better.scoreSortValue).toBeLessThan(worse.scoreSortValue);
  });

  it("times out without input after repeated sweeps", () => {
    let state = createInitialSignalStackerState(config);

    while (!state.ended && state.tick < getMaxAllowedTick(config)) {
      state = stepSignalStackerState(state, config, false);
    }

    const summary = summarizeSignalStackerState(state, config);
    expect(state.ended).toBe(true);
    expect(summary.floorsStacked).toBe(0);
  });

  it("validates payload schema bounds", () => {
    expect(() =>
      parseSignalStackerSubmissionPayload({
        sessionId: config.sessionId,
        configVersion: config.configVersion,
        payload: { dropTicks: [] },
        clientSummary: { elapsedMs: 0 }
      })
    ).toThrow();
  });
});
