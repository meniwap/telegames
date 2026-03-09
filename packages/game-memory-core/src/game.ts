import { z } from "zod";

import type { GameModuleServerContract, RewardGrant } from "@telegramplay/game-core";

import { MAX_REPLAY_FLIPS, TOTAL_CARDS, TOTAL_PAIRS } from "./constants";
import { createBoard } from "./board";
import type {
  MemoryBoardConfig,
  MemoryReplayPayload,
  MemoryResultSummary,
  MemorySessionConfig,
  MemorySessionPayload,
  OfficialMemoryResult
} from "./types";

// ── Session creation ───────────────────────────────────────────────────────

export function createMemorySessionConfig(sessionId: string, seed: number): MemorySessionConfig {
  const board = createBoard(seed);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

  return {
    sessionId,
    gameTitleId: "memory",
    configVersion: "memory-v1",
    seed,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    payload: { board }
  };
}

// ── Submission parsing ──────────────────────────────────────────────────────

const flipActionSchema = z.object({
  cardIndex: z.number().int().min(0).max(TOTAL_CARDS - 1),
  timestampMs: z.number().min(0)
});

const submissionSchema = z.object({
  sessionId: z.string().min(1),
  configVersion: z.string().min(1),
  payload: z.object({
    flips: z.array(flipActionSchema).min(TOTAL_PAIRS * 2).max(MAX_REPLAY_FLIPS)
  }),
  clientSummary: z.object({
    elapsedMs: z.number().min(0),
    reportedPlacement: z.number().nullable().optional(),
    reportedDisplayValue: z.string().nullable().optional(),
    reportedScoreSortValue: z.number().nullable().optional()
  })
});

export function parseMemorySubmissionPayload(body: unknown): MemoryReplayPayload {
  return submissionSchema.parse(body) as MemoryReplayPayload;
}

// ── Game state for replay ───────────────────────────────────────────────────

type MemoryGameState = {
  matched: boolean[];
  revealed: number | null; // index of currently revealed card (waiting for second flip)
  pairsFound: number;
  totalMoves: number; // counts pair attempts (every 2nd flip)
};

function createInitialState(): MemoryGameState {
  return {
    matched: new Array(TOTAL_CARDS).fill(false) as boolean[],
    revealed: null,
    pairsFound: 0,
    totalMoves: 0
  };
}

function applyFlip(
  state: MemoryGameState,
  board: MemoryBoardConfig,
  cardIndex: number
): { valid: boolean; reason?: string } {
  // Can't flip a matched card
  if (state.matched[cardIndex]) {
    return { valid: false, reason: "card_already_matched" };
  }

  // Can't flip the same card that's currently revealed
  if (state.revealed === cardIndex) {
    return { valid: false, reason: "card_already_revealed" };
  }

  if (state.revealed === null) {
    // First flip of a pair attempt
    state.revealed = cardIndex;
  } else {
    // Second flip - check for match
    state.totalMoves++;
    const firstCard = board.cards[state.revealed]!;
    const secondCard = board.cards[cardIndex]!;

    if (firstCard.pairId === secondCard.pairId) {
      // Match found
      state.matched[state.revealed] = true;
      state.matched[cardIndex] = true;
      state.pairsFound++;
    }

    state.revealed = null;
  }

  return { valid: true };
}

// ── Rewards ─────────────────────────────────────────────────────────────────

function evaluateMemoryRewards(totalMoves: number, officialTimeMs: number): Omit<RewardGrant, "sourceId">[] {
  // Fewer moves = more rewards. Perfect game is 8 moves (TOTAL_PAIRS).
  // Max reasonable is ~24 moves.
  const moveBonus = Math.max(0, 24 - totalMoves) * 4; // 0–64 bonus
  const timeBonus = Math.max(0, Math.floor((120000 - officialTimeMs) / 2000)); // faster = more
  const coins = Math.max(30, 80 + moveBonus);
  const xp = Math.max(20, 60 + Math.floor(moveBonus * 0.7) + timeBonus);

  return [
    { entryType: "coins", amount: coins, sourceType: "game_result" },
    { entryType: "xp", amount: xp, sourceType: "game_result" }
  ];
}

// ── Server-side replay & verification ───────────────────────────────────────

export function replayMemoryGame(
  config: MemorySessionConfig,
  submission: MemoryReplayPayload
): OfficialMemoryResult {
  const cheatFlags: string[] = [];

  // Validate config version
  if (submission.configVersion !== config.configVersion) {
    return {
      sessionId: submission.sessionId,
      gameTitleId: config.gameTitleId,
      status: "rejected",
      placement: null,
      scoreSortValue: 0,
      displayValue: "Rejected",
      elapsedMs: 0,
      rewards: [],
      flags: ["config_version_mismatch"],
      rejectedReason: "config_version_mismatch",
      resultSummary: { totalMoves: 0, officialTimeMs: 0, pairsFound: 0 }
    };
  }

  const { flips } = submission.payload;
  const board = config.payload.board;
  const state = createInitialState();

  // Validate flip count bounds
  if (flips.length < TOTAL_PAIRS * 2 || flips.length > MAX_REPLAY_FLIPS) {
    return {
      sessionId: submission.sessionId,
      gameTitleId: config.gameTitleId,
      status: "rejected",
      placement: null,
      scoreSortValue: 0,
      displayValue: "Rejected",
      elapsedMs: 0,
      rewards: [],
      flags: ["invalid_flip_count"],
      rejectedReason: "invalid_flip_count",
      resultSummary: { totalMoves: 0, officialTimeMs: 0, pairsFound: 0 }
    };
  }

  // Validate timestamps are monotonically increasing
  for (let i = 1; i < flips.length; i++) {
    if (flips[i]!.timestampMs < flips[i - 1]!.timestampMs) {
      return {
        sessionId: submission.sessionId,
        gameTitleId: config.gameTitleId,
        status: "rejected",
        placement: null,
        scoreSortValue: 0,
        displayValue: "Rejected",
        elapsedMs: 0,
        rewards: [],
        flags: ["non_monotonic_timestamps"],
        rejectedReason: "non_monotonic_timestamps",
        resultSummary: { totalMoves: 0, officialTimeMs: 0, pairsFound: 0 }
      };
    }
  }

  // Replay all flips
  for (const flip of flips) {
    if (flip.cardIndex < 0 || flip.cardIndex >= TOTAL_CARDS) {
      cheatFlags.push("invalid_card_index");
      break;
    }

    const result = applyFlip(state, board, flip.cardIndex);
    if (!result.valid) {
      cheatFlags.push(result.reason ?? "invalid_flip");
      break;
    }

    // Stop after all pairs found
    if (state.pairsFound === TOTAL_PAIRS) {
      break;
    }
  }

  // Check if all pairs were found
  if (state.pairsFound < TOTAL_PAIRS) {
    return {
      sessionId: submission.sessionId,
      gameTitleId: config.gameTitleId,
      status: "rejected",
      placement: null,
      scoreSortValue: 0,
      displayValue: "Rejected",
      elapsedMs: 0,
      rewards: [],
      flags: [...cheatFlags, "incomplete_game"],
      rejectedReason: cheatFlags[0] ?? "incomplete_game",
      resultSummary: { totalMoves: state.totalMoves, officialTimeMs: 0, pairsFound: state.pairsFound }
    };
  }

  const officialTimeMs = Math.round(flips[flips.length - 1]!.timestampMs - flips[0]!.timestampMs);

  // Time range validation
  if (officialTimeMs < board.expectedMsRange.min) {
    cheatFlags.push("impossible_fast_time");
  }

  if (officialTimeMs > board.expectedMsRange.max * 1.5) {
    cheatFlags.push("impossible_slow_time");
  }

  // Scoring: lower is better. Moves are primary, time is tiebreaker.
  const scoreSortValue = state.totalMoves * 10000 + officialTimeMs;
  const displayValue = `${state.totalMoves} moves · ${(officialTimeMs / 1000).toFixed(1)}s`;

  const rewards = evaluateMemoryRewards(state.totalMoves, officialTimeMs).map((reward) => ({
    ...reward,
    sourceId: submission.sessionId
  }));

  return {
    sessionId: submission.sessionId,
    gameTitleId: config.gameTitleId,
    status: cheatFlags.includes("impossible_fast_time") ? "rejected" : "accepted",
    placement: 1, // single player, always P1
    scoreSortValue,
    displayValue,
    elapsedMs: officialTimeMs,
    rewards: cheatFlags.includes("impossible_fast_time") ? [] : rewards,
    flags: cheatFlags,
    rejectedReason: cheatFlags.includes("impossible_fast_time") ? "impossible_fast_time" : undefined,
    resultSummary: {
      totalMoves: state.totalMoves,
      officialTimeMs,
      pairsFound: state.pairsFound
    }
  };
}

// ── Module export ───────────────────────────────────────────────────────────

export const memoryGameModule: GameModuleServerContract<
  MemorySessionPayload,
  MemoryReplayPayload["payload"],
  MemoryResultSummary
> = {
  definition: {
    id: "memory",
    slug: "memory",
    name: "Memory Match",
    status: "live",
    tagline: "Find all pairs as fast as you can.",
    description: "Classic 4x4 memory card matching game. Flip cards to find matching pairs — fewer moves and faster times earn bigger rewards.",
    coverLabel: "New Game"
  },
  createSessionConfig: createMemorySessionConfig,
  parseSubmissionPayload: parseMemorySubmissionPayload,
  verifySubmission: replayMemoryGame
};
