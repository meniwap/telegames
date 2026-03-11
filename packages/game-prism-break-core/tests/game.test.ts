import { describe, expect, it } from "vitest";

import { MAX_TICKS } from "../src/constants";
import {
  createInitialPrismBreakState,
  createPrismBreakSessionConfig,
  createPrismWave,
  generateAutoplayPrismInputs,
  parsePrismBreakSubmissionPayload,
  replayPrismBreakGame,
  stepPrismBreakState,
  summarizePrismBreakState
} from "../src/game";

describe("prism break game", () => {
  const config = createPrismBreakSessionConfig("prism-session-1", 77);

  it("creates deterministic wave layouts from the same seed", () => {
    expect(createPrismWave(77, 0)).toEqual(createPrismWave(77, 0));
  });

  it("accepts autoplay replays", () => {
    const inputs = generateAutoplayPrismInputs(config, 10);
    const result = replayPrismBreakGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: inputs,
      clientSummary: {
        elapsedMs: 16000,
        reportedPlacement: 1,
        reportedDisplayValue: "10 prisms · 16.0s",
        reportedScoreSortValue: -10_000_000
      }
    });

    expect(result.status).toBe("accepted");
    expect(result.resultSummary.prismsShattered).toBeGreaterThanOrEqual(10);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it("rejects non-monotonic deflector changes", () => {
    const result = replayPrismBreakGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: {
        deflectorChanges: [
          { tick: 4, lane: 0 },
          { tick: 4, lane: 2 }
        ],
        magnetWindows: []
      },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("non_monotonic_deflector_changes");
  });

  it("rejects oversized magnet windows", () => {
    const result = replayPrismBreakGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: {
        deflectorChanges: [],
        magnetWindows: [{ startTick: 1, endTick: 20 }]
      },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("magnet_window_too_long");
  });

  it("keeps scoring aligned with more prisms being better", () => {
    const better = replayPrismBreakGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: generateAutoplayPrismInputs(config, 14),
      clientSummary: { elapsedMs: 18000 }
    });
    const worse = replayPrismBreakGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: {
        deflectorChanges: [],
        magnetWindows: []
      },
      clientSummary: { elapsedMs: 7000 }
    });

    expect(better.resultSummary.prismsShattered).toBeGreaterThan(worse.resultSummary.prismsShattered);
    expect(better.scoreSortValue).toBeLessThan(worse.scoreSortValue);
  });

  it("misses eventually without inputs", () => {
    let state = createInitialPrismBreakState(config);
    state = stepPrismBreakState(state, config, { laneChange: 1, magnetActive: false });

    while (!state.missed && state.tick < MAX_TICKS) {
      state = stepPrismBreakState(state, config, { laneChange: null, magnetActive: false });
    }

    const summary = summarizePrismBreakState(state);
    expect(summary.survivedMs).toBeGreaterThan(0);
  });

  it("validates submission payload schema", () => {
    expect(() =>
      parsePrismBreakSubmissionPayload({
        sessionId: config.sessionId,
        configVersion: config.configVersion,
        payload: {
          deflectorChanges: [{ tick: MAX_TICKS, lane: 0 }],
          magnetWindows: []
        },
        clientSummary: { elapsedMs: 0 }
      })
    ).toThrow();
  });
});
