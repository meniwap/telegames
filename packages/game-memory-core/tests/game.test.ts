import { describe, expect, it } from "vitest";

import { createMemorySessionConfig, replayMemoryGame } from "../src/game";
import { TOTAL_PAIRS } from "../src/constants";
import type { MemoryFlipAction, MemoryReplayPayload } from "../src/types";

describe("memory game", () => {
  const config = createMemorySessionConfig("test-session-1", 42);

  it("creates a valid board with correct number of pairs", () => {
    const board = config.payload.board;
    expect(board.cards.length).toBe(16);
    expect(board.gridSize).toBe(4);

    // Check that there are exactly 8 pairs
    const pairCounts = new Map<number, number>();
    for (const card of board.cards) {
      pairCounts.set(card.pairId, (pairCounts.get(card.pairId) ?? 0) + 1);
    }
    expect(pairCounts.size).toBe(TOTAL_PAIRS);
    for (const count of pairCounts.values()) {
      expect(count).toBe(2);
    }
  });

  it("same seed produces the same board", () => {
    const config2 = createMemorySessionConfig("test-session-2", 42);
    expect(config.payload.board.cards.map((c) => c.pairId)).toEqual(
      config2.payload.board.cards.map((c) => c.pairId)
    );
  });

  it("different seeds produce different boards", () => {
    const config2 = createMemorySessionConfig("test-session-2", 99);
    const board1 = config.payload.board.cards.map((c) => c.pairId);
    const board2 = config2.payload.board.cards.map((c) => c.pairId);
    // Very unlikely to be identical with different seeds
    expect(board1).not.toEqual(board2);
  });

  it("accepts a valid perfect game replay", () => {
    const board = config.payload.board;
    // Build a perfect replay: find matching pairs and flip them in order
    const flips: MemoryFlipAction[] = [];
    const matched = new Set<number>();
    let ts = 1000;

    for (let pairId = 0; pairId < TOTAL_PAIRS; pairId++) {
      const indices = board.cards
        .map((card, index) => ({ card, index }))
        .filter(({ card, index }) => card.pairId === pairId && !matched.has(index));

      flips.push({ cardIndex: indices[0]!.index, timestampMs: ts });
      ts += 600;
      flips.push({ cardIndex: indices[1]!.index, timestampMs: ts });
      ts += 600;

      matched.add(indices[0]!.index);
      matched.add(indices[1]!.index);
    }

    const elapsedMs = flips[flips.length - 1]!.timestampMs - flips[0]!.timestampMs;

    const submission: MemoryReplayPayload = {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { flips },
      clientSummary: {
        elapsedMs,
        reportedPlacement: 1,
        reportedScoreSortValue: TOTAL_PAIRS * 10000 + elapsedMs,
        reportedDisplayValue: `${TOTAL_PAIRS} moves`
      }
    };

    const result = replayMemoryGame(config, submission);
    expect(result.status).toBe("accepted");
    expect(result.resultSummary.totalMoves).toBe(TOTAL_PAIRS);
    expect(result.resultSummary.pairsFound).toBe(TOTAL_PAIRS);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it("rejects incomplete game", () => {
    const board = config.payload.board;
    // Only match the first pair
    const indices = board.cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => card.pairId === 0);

    const flips: MemoryFlipAction[] = [
      { cardIndex: indices[0]!.index, timestampMs: 1000 },
      { cardIndex: indices[1]!.index, timestampMs: 1500 }
    ];

    // Need at least TOTAL_PAIRS * 2 flips, but this has only 2
    // The Zod validation requires min flips, so let's pad with more valid flips
    // Actually the zod validation should catch this
    const submission: MemoryReplayPayload = {
      sessionId: config.sessionId,
      configVersion: config.configVersion,
      payload: { flips },
      clientSummary: { elapsedMs: 500, reportedPlacement: null, reportedDisplayValue: null, reportedScoreSortValue: null }
    };

    // parseMemorySubmissionPayload should reject due to min flips count
    expect(() => {
      const { parseMemorySubmissionPayload } = require("../src/game");
      parseMemorySubmissionPayload(submission);
    }).toThrow();
  });

  it("rejects config version mismatch", () => {
    const board = config.payload.board;
    const flips: MemoryFlipAction[] = [];
    const matched = new Set<number>();
    let ts = 1000;

    for (let pairId = 0; pairId < TOTAL_PAIRS; pairId++) {
      const indices = board.cards
        .map((card, index) => ({ card, index }))
        .filter(({ card, index }) => card.pairId === pairId && !matched.has(index));
      flips.push({ cardIndex: indices[0]!.index, timestampMs: ts });
      ts += 500;
      flips.push({ cardIndex: indices[1]!.index, timestampMs: ts });
      ts += 500;
      matched.add(indices[0]!.index);
      matched.add(indices[1]!.index);
    }

    const submission: MemoryReplayPayload = {
      sessionId: config.sessionId,
      configVersion: "wrong-version",
      payload: { flips },
      clientSummary: { elapsedMs: ts - 1000 }
    };

    const result = replayMemoryGame(config, submission);
    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("config_version_mismatch");
  });
});
