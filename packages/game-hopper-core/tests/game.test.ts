import { describe, expect, it } from "vitest";

import { MAX_TICKS } from "../src/constants";
import {
  createInitialHopperState,
  createHopperSessionConfig,
  generateAutoplayFlapTicks,
  parseHopperSubmissionPayload,
  replayHopperGame,
  stepHopperState,
  summarizeHopperState
} from "../src/game";
import type { HopperReplayPayload } from "../src/types";

describe("hopper game", () => {
  const config = createHopperSessionConfig("hopper-session-1", 42);

  it("creates a deterministic obstacle stream from the seed", () => {
    const config2 = createHopperSessionConfig("hopper-session-2", 42);
    expect(config.payload.course.obstacles.slice(0, 10)).toEqual(config2.payload.course.obstacles.slice(0, 10));
  });

  it("generates distinct obstacle streams for different seeds", () => {
    const config2 = createHopperSessionConfig("hopper-session-3", 99);
    expect(config.payload.course.obstacles.slice(0, 6)).not.toEqual(config2.payload.course.obstacles.slice(0, 6));
  });

  it("accepts a deterministic autoplay replay", () => {
    const flapTicks = generateAutoplayFlapTicks(config, 4);
    const submission: HopperReplayPayload = {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { flapTicks },
      clientSummary: {
        elapsedMs: 24000,
        reportedPlacement: 1,
        reportedDisplayValue: "4 gates · 24.0s",
        reportedScoreSortValue: -4000000
      }
    };

    const result = replayHopperGame(config, submission);
    expect(result.status).toBe("accepted");
    expect(result.resultSummary.gatesCleared).toBeGreaterThan(0);
    expect(result.scoreSortValue).toBeLessThan(0);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it("rejects non-monotonic flap ticks", () => {
    expect(() =>
      parseHopperSubmissionPayload({
        sessionId: config.sessionId,
        configVersion: config.configVersion,
        payload: { flapTicks: [3, 2, 5] },
        clientSummary: { elapsedMs: 1200 }
      })
    ).not.toThrow();

    const result = replayHopperGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { flapTicks: [3, 2, 5] },
      clientSummary: { elapsedMs: 1200 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("non_monotonic_flap_ticks");
  });

  it("rejects flap ticks outside the max tick range", () => {
    const result = replayHopperGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { flapTicks: [MAX_TICKS + 4] },
      clientSummary: { elapsedMs: 0 }
    });

    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("flap_tick_out_of_bounds");
  });

  it("keeps scoring order aligned with more gates being better", () => {
    const betterConfig = createHopperSessionConfig("hopper-session-4", 44);
    const best = replayHopperGame(betterConfig, {
      sessionId: betterConfig.sessionId,
      configVersion: betterConfig.configVersion,
      payload: { flapTicks: generateAutoplayFlapTicks(betterConfig, 5) },
      clientSummary: { elapsedMs: 20000 }
    });

    const worse = replayHopperGame(config, {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { flapTicks: [] },
      clientSummary: { elapsedMs: 0 }
    });

    expect(best.scoreSortValue).toBeLessThan(worse.scoreSortValue);
  });

  it("collides quickly without flaps", () => {
    const current = createHopperSessionConfig("hopper-session-7", 11);
    let stepState = createInitialHopperState(current);

    while (!stepState.collided && stepState.tick < 180) {
      stepState = stepHopperState(stepState, current, false);
    }

    const summary = summarizeHopperState(stepState);
    expect(stepState.collided).toBe(true);
    expect(summary.survivedMs).toBeGreaterThan(0);
  });
});
