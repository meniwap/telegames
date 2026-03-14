import { describe, expect, it } from "vitest";

import { MAX_TICKS, NUDGE_MAX_TICKS } from "../src/constants";
import {
  createInitialPhotonPinballState,
  createPhotonPinballSessionConfig,
  generateAutoplayPhotonPinballInputs,
  parsePhotonPinballSubmissionPayload,
  replayPhotonPinballGame,
  stepPhotonPinballState,
  summarizePhotonPinballState
} from "../src/game";

describe("photon pinball core", () => {
  const config = createPhotonPinballSessionConfig("pinball-session-1", 91);

  it("creates deterministic layouts from the same seed", () => {
    const again = createPhotonPinballSessionConfig("pinball-session-2", 91);
    expect(config.payload.table.bumperLayout).toEqual(again.payload.table.bumperLayout);
    expect(config.payload.table.targetLayout).toEqual(again.payload.table.targetLayout);
  });

  it("accepts autoplay replays", () => {
    const controls = generateAutoplayPhotonPinballInputs(config, 2600);
    const result = replayPhotonPinballGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: controls,
      clientSummary: {
        elapsedMs: 18000,
        reportedPlacement: 1,
        reportedDisplayValue: "2600 pts · 1 jackpots",
        reportedScoreSortValue: -2_600_100
      }
    });

    expect(result.status).toBe("accepted");
    expect(result.resultSummary.score).toBeGreaterThan(0);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it("rejects non-monotonic left flip ticks", () => {
    const result = replayPhotonPinballGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: {
        leftFlipTicks: [12, 12],
        rightFlipTicks: [],
        nudgeWindows: []
      },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("non_monotonic_left_flip_ticks");
  });

  it("rejects oversized nudge windows", () => {
    const result = replayPhotonPinballGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: {
        leftFlipTicks: [],
        rightFlipTicks: [],
        nudgeWindows: [{ startTick: 2, endTick: 2 + NUDGE_MAX_TICKS }]
      },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("nudge_window_too_long");
  });

  it("sorts higher scores ahead of weaker runs", () => {
    const better = replayPhotonPinballGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: generateAutoplayPhotonPinballInputs(config, 3200),
      clientSummary: { elapsedMs: 20000 }
    });
    const worse = replayPhotonPinballGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: {
        leftFlipTicks: [],
        rightFlipTicks: [],
        nudgeWindows: []
      },
      clientSummary: { elapsedMs: 4000 }
    });

    expect(better.resultSummary.score).toBeGreaterThan(worse.resultSummary.score);
    expect(better.scoreSortValue).toBeLessThan(worse.scoreSortValue);
  });

  it("drains eventually without inputs", () => {
    let state = createInitialPhotonPinballState(config);

    while (!state.finishReason && state.tick < MAX_TICKS) {
      state = stepPhotonPinballState(state, config, { leftFlip: false, rightFlip: false, nudge: false });
    }

    const summary = summarizePhotonPinballState(state);
    expect(summary.ballsDrained).toBeGreaterThan(0);
    expect(summary.survivedMs).toBeGreaterThan(0);
  });

  it("validates payload schema", () => {
    expect(() =>
      parsePhotonPinballSubmissionPayload({
        sessionId: config.sessionId,
        configVersion: config.configVersion,
        payload: {
          leftFlipTicks: [MAX_TICKS],
          rightFlipTicks: [],
          nudgeWindows: []
        },
        clientSummary: { elapsedMs: 0 }
      })
    ).toThrow();
  });
});
