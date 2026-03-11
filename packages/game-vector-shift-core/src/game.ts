import { z } from "zod";

import type { GameModuleServerContract, RewardGrant } from "@telegramplay/game-core";

import {
  BASE_SPEED,
  LANE_COUNT,
  MAX_REPLAY_LANE_CHANGES,
  MAX_ROW_SPACING,
  MAX_TICKS,
  MIN_ROW_SPACING,
  SPEED_RAMP,
  START_LANE,
  TICK_MS,
  TICK_SECONDS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "./constants";
import { createMulberry32 } from "./prng";
import type {
  OfficialVectorShiftResult,
  VectorShiftLane,
  VectorShiftLaneChange,
  VectorShiftReplayPayload,
  VectorShiftResultSummary,
  VectorShiftRow,
  VectorShiftSessionConfig,
  VectorShiftSessionPayload,
  VectorShiftState
} from "./types";

function clampLane(value: number): VectorShiftLane {
  return Math.max(0, Math.min(LANE_COUNT - 1, value)) as VectorShiftLane;
}

function sortLanes(lanes: VectorShiftLane[]) {
  return [...lanes].sort((left, right) => left - right);
}

function shuffleLanes(nextRandom: () => number) {
  const lanes: VectorShiftLane[] = [0, 1, 2];

  for (let index = lanes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    const current = lanes[index]!;
    lanes[index] = lanes[swapIndex]!;
    lanes[swapIndex] = current;
  }

  return lanes;
}

export function createVectorShiftRows(seed: number) {
  const nextRandom = createMulberry32(seed);
  const rows: VectorShiftRow[] = [];
  let tick = 10;

  while (tick < MAX_TICKS - 6) {
    const shuffled = sortLanes(shuffleLanes(nextRandom));
    const safeCount = nextRandom() > 0.34 ? 2 : 1;
    const safeLanes = shuffled.slice(0, safeCount);
    const blockedLanes = sortLanes(([0, 1, 2] as VectorShiftLane[]).filter((lane) => !safeLanes.includes(lane)));
    const chargeLane = nextRandom() > 0.4 ? safeLanes[Math.floor(nextRandom() * safeLanes.length)] ?? null : null;

    rows.push({
      tick,
      blockedLanes,
      chargeLane
    });

    tick += MIN_ROW_SPACING + Math.floor(nextRandom() * (MAX_ROW_SPACING - MIN_ROW_SPACING + 1));
  }

  return rows;
}

export function createVectorShiftSessionConfig(sessionId: string, seed: number): VectorShiftSessionConfig {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  return {
    sessionId,
    gameTitleId: "vector-shift",
    configVersion: "vector-shift-v1",
    seed,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    payload: {
      course: {
        laneCount: LANE_COUNT,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        startLane: START_LANE,
        tickMs: TICK_MS,
        maxTicks: MAX_TICKS,
        baseSpeed: BASE_SPEED,
        speedRamp: SPEED_RAMP,
        obstacleStreamVersion: "vector-stream-v1",
        rows: createVectorShiftRows(seed)
      }
    }
  };
}

const submissionSchema = z.object({
  sessionId: z.string().min(1),
  configVersion: z.string().min(1),
  payload: z.object({
    laneChanges: z
      .array(
        z.object({
          tick: z.number().int().min(0).max(MAX_TICKS - 1),
          targetLane: z.union([z.literal(0), z.literal(1), z.literal(2)])
        })
      )
      .max(MAX_REPLAY_LANE_CHANGES)
  }),
  clientSummary: z.object({
    elapsedMs: z.number().min(0),
    reportedPlacement: z.number().nullable().optional(),
    reportedDisplayValue: z.string().nullable().optional(),
    reportedScoreSortValue: z.number().nullable().optional()
  })
});

export function parseVectorShiftSubmissionPayload(body: unknown): VectorShiftReplayPayload {
  return submissionSchema.parse(body) as VectorShiftReplayPayload;
}

export function createInitialVectorShiftState(config: VectorShiftSessionConfig): VectorShiftState {
  return {
    tick: 0,
    lane: config.payload.course.startLane,
    sectorsCleared: 0,
    chargesCollected: 0,
    distance: 0,
    nextRowIndex: 0,
    collided: false,
    collisionTick: null
  };
}

function getSpeed(state: VectorShiftState, config: VectorShiftSessionConfig) {
  return config.payload.course.baseSpeed + state.sectorsCleared * config.payload.course.speedRamp;
}

function getRowAtTick(config: VectorShiftSessionConfig, tick: number, nextRowIndex: number) {
  const row = config.payload.course.rows[nextRowIndex];
  if (!row || row.tick !== tick) {
    return null;
  }

  return row;
}

function summarizeFromState(state: VectorShiftState) {
  const survivedMs = Math.round(state.tick * TICK_MS);
  const scoreSortValue = -(state.sectorsCleared * 1_000_000 + state.chargesCollected * 10_000 + survivedMs);

  return {
    sectorsCleared: state.sectorsCleared,
    chargesCollected: state.chargesCollected,
    survivedMs,
    scoreSortValue,
    displayValue: `${state.sectorsCleared} sectors · ${state.chargesCollected} charges`
  };
}

export function summarizeVectorShiftState(state: VectorShiftState) {
  return summarizeFromState(state);
}

function evaluateVectorShiftRewards(sectorsCleared: number, chargesCollected: number): Omit<RewardGrant, "sourceId">[] {
  const coins = Math.min(200, Math.max(12, 14 + sectorsCleared * 2 + chargesCollected * 3));
  const xp = Math.min(260, Math.max(16, 18 + sectorsCleared * 3 + chargesCollected * 4));

  return [
    { entryType: "coins", amount: coins, sourceType: "game_result" },
    { entryType: "xp", amount: xp, sourceType: "game_result" }
  ];
}

export function stepVectorShiftState(
  state: VectorShiftState,
  config: VectorShiftSessionConfig,
  laneChangeTarget: VectorShiftLane | null
): VectorShiftState {
  if (state.collided || state.tick >= config.payload.course.maxTicks) {
    return state;
  }

  const nextState: VectorShiftState = {
    ...state,
    tick: state.tick + 1,
    lane: laneChangeTarget ?? state.lane,
    distance: state.distance + getSpeed(state, config) * TICK_SECONDS
  };
  const row = getRowAtTick(config, nextState.tick, nextState.nextRowIndex);

  if (!row) {
    return nextState;
  }

  if (row.blockedLanes.includes(nextState.lane)) {
    nextState.collided = true;
    nextState.collisionTick = nextState.tick;
    return nextState;
  }

  nextState.sectorsCleared += 1;
  if (row.chargeLane === nextState.lane) {
    nextState.chargesCollected += 1;
  }
  nextState.nextRowIndex += 1;
  return nextState;
}

function rejection(
  config: VectorShiftSessionConfig,
  submission: VectorShiftReplayPayload,
  reason: string,
  summary?: Partial<VectorShiftResultSummary>
): OfficialVectorShiftResult {
  return {
    sessionId: submission.sessionId,
    gameTitleId: config.gameTitleId,
    status: "rejected",
    placement: null,
    scoreSortValue: 0,
    displayValue: "Rejected",
    elapsedMs: 0,
    rewards: [],
    flags: [reason],
    rejectedReason: reason,
    resultSummary: {
      sectorsCleared: summary?.sectorsCleared ?? 0,
      chargesCollected: summary?.chargesCollected ?? 0,
      survivedMs: summary?.survivedMs ?? 0,
      collisionTick: summary?.collisionTick ?? null
    }
  };
}

export function replayVectorShiftGame(
  config: VectorShiftSessionConfig,
  submission: VectorShiftReplayPayload
): OfficialVectorShiftResult {
  if (submission.configVersion !== config.configVersion) {
    return rejection(config, submission, "config_version_mismatch");
  }

  const laneChanges = submission.payload.laneChanges;
  for (let index = 0; index < laneChanges.length; index += 1) {
    const current = laneChanges[index]!;

    if (index > 0) {
      const previous = laneChanges[index - 1]!;
      if (current.tick <= previous.tick) {
        return rejection(config, submission, "non_monotonic_lane_changes");
      }
      if (current.targetLane === previous.targetLane) {
        return rejection(config, submission, "duplicate_consecutive_lane_targets");
      }
    }
  }

  let state = createInitialVectorShiftState(config);
  let laneChangeIndex = 0;

  while (!state.collided && state.tick < config.payload.course.maxTicks) {
    const scheduled = laneChanges[laneChangeIndex];
    let targetLane: VectorShiftLane | null = null;

    if (scheduled && scheduled.tick === state.tick) {
      if (Math.abs(scheduled.targetLane - state.lane) !== 1) {
        return rejection(config, submission, "lane_jump_too_large", {
          sectorsCleared: state.sectorsCleared,
          chargesCollected: state.chargesCollected,
          survivedMs: Math.round(state.tick * TICK_MS),
          collisionTick: state.collisionTick
        });
      }
      targetLane = scheduled.targetLane;
      laneChangeIndex += 1;
    }

    state = stepVectorShiftState(state, config, targetLane);
  }

  if (laneChangeIndex < laneChanges.length) {
    return rejection(config, submission, "post_finish_lane_changes", {
      sectorsCleared: state.sectorsCleared,
      chargesCollected: state.chargesCollected,
      survivedMs: Math.round(state.tick * TICK_MS),
      collisionTick: state.collisionTick
    });
  }

  const summary = summarizeFromState(state);
  const flags: string[] = [];
  if (Math.abs(Math.round(submission.clientSummary.elapsedMs) - summary.survivedMs) > 2500) {
    flags.push("client_summary_mismatch");
  }

  const rewards = evaluateVectorShiftRewards(summary.sectorsCleared, summary.chargesCollected).map((reward) => ({
    ...reward,
    sourceId: submission.sessionId
  }));

  return {
    sessionId: submission.sessionId,
    gameTitleId: config.gameTitleId,
    status: "accepted",
    placement: 1,
    scoreSortValue: summary.scoreSortValue,
    displayValue: summary.displayValue,
    elapsedMs: summary.survivedMs,
    rewards,
    flags,
    resultSummary: {
      sectorsCleared: summary.sectorsCleared,
      chargesCollected: summary.chargesCollected,
      survivedMs: summary.survivedMs,
      collisionTick: state.collisionTick
    }
  };
}

function getSafeLanes(row: VectorShiftRow) {
  return ([0, 1, 2] as VectorShiftLane[]).filter((lane) => !row.blockedLanes.includes(lane));
}

function getNearestLane(currentLane: VectorShiftLane, candidates: VectorShiftLane[]) {
  return [...candidates].sort((left, right) => Math.abs(left - currentLane) - Math.abs(right - currentLane))[0] ?? currentLane;
}

export function generateAutoplayLaneChanges(config: VectorShiftSessionConfig, targetSectors = 8) {
  let state = createInitialVectorShiftState(config);
  const laneChanges: VectorShiftLaneChange[] = [];

  while (!state.collided && state.tick < config.payload.course.maxTicks) {
    const row = config.payload.course.rows[state.nextRowIndex];
    let targetLane: VectorShiftLane | null = null;

    if (row) {
      const safeLanes = getSafeLanes(row);
      const desiredLane =
        state.sectorsCleared >= targetSectors
          ? getNearestLane(state.lane, row.blockedLanes)
          : row.chargeLane && safeLanes.includes(row.chargeLane)
            ? row.chargeLane
            : safeLanes.includes(state.lane)
              ? state.lane
              : getNearestLane(state.lane, safeLanes);

      if (desiredLane !== state.lane) {
        targetLane = clampLane(state.lane + Math.sign(desiredLane - state.lane));
        laneChanges.push({ tick: state.tick, targetLane });
      }
    }

    state = stepVectorShiftState(state, config, targetLane);
  }

  return laneChanges;
}

export const vectorShiftGameModule: GameModuleServerContract<
  VectorShiftSessionPayload,
  VectorShiftReplayPayload["payload"],
  VectorShiftResultSummary
> = {
  definition: {
    id: "vector-shift",
    slug: "vector-shift",
    name: "Vector Shift",
    status: "live",
    tagline: "Cut across neon lanes and survive the charge stream.",
    description:
      "A one-thumb lane dodger with deterministic obstacle waves, collectible charges, and official server-verified runs for Telegram leaderboards.",
    coverLabel: "Reflex"
  },
  createSessionConfig: createVectorShiftSessionConfig,
  parseSubmissionPayload: parseVectorShiftSubmissionPayload,
  verifySubmission: replayVectorShiftGame
};
