import { describe, expect, it } from "vitest";

import { INPUT_BRAKE, INPUT_LEFT, INPUT_RIGHT } from "../src/constants";
import { createInitialRaceState, createRacerSessionConfig, evaluateRewards, generateAutoplayFrames, replayRace, stepRaceState } from "../src/race";

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

  it("does not seed cpu racers almost a full lap ahead of the player", () => {
    const config = createRacerSessionConfig("session-4", 77);
    const state = createInitialRaceState(config);
    const player = state.racers[0]!;
    const furthestCpu = [...state.racers.slice(1)].sort((left, right) => right.progressDistance - left.progressDistance)[0]!;

    expect(player.place).toBe(1);
    expect(furthestCpu.progressDistance).toBeLessThan(player.progressDistance);
    expect(player.progressDistance - furthestCpu.progressDistance).toBeLessThan(120);
  });

  it("returns integer milliseconds for accepted official results", () => {
    const config = createRacerSessionConfig("session-5", 12345);
    const frames = generateAutoplayFrames(config);
    const result = replayRace(config, {
      sessionId: "session-5",
      configVersion: config.configVersion,
      payload: {
        frames
      },
      clientSummary: {
        elapsedMs: 0,
        reportedPlacement: null,
        reportedScoreSortValue: null
      }
    });

    expect(result.status).toBe("accepted");
    expect(Number.isInteger(result.elapsedMs)).toBe(true);
    expect(Number.isInteger(result.scoreSortValue)).toBe(true);
  });

  it("does not count the launch crossing as a completed lap for cars starting behind the line", () => {
    const config = createRacerSessionConfig("session-6", 42);
    const state = createInitialRaceState(config);

    for (let frame = 0; frame < 420; frame += 1) {
      stepRaceState(state, config, 0);
    }

    expect(state.racers.every((racer) => racer.completedLaps === 0)).toBe(true);
  });

  it("accepts fast but still plausible clean runs that beat the nominal expected minimum", () => {
    const config = createRacerSessionConfig("session-7", 12345);
    config.payload.track.expectedMsRange.min = 45000;
    const frames = generateAutoplayFrames(config);
    const result = replayRace(config, {
      sessionId: "session-7",
      configVersion: config.configVersion,
      payload: {
        frames
      },
      clientSummary: {
        elapsedMs: 0,
        reportedPlacement: null,
        reportedScoreSortValue: null
      }
    });

    expect(result.status).toBe("accepted");
    expect(result.flags).not.toContain("impossible_fast_time");
  });
});
