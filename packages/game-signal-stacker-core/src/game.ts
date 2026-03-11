import { z } from "zod";

import type { GameModuleServerContract, RewardGrant } from "@telegramplay/game-core";

import {
  BASE_BLOCK_WIDTH,
  BASE_SWEEP_TICKS,
  BLOCK_HEIGHT,
  HORIZONTAL_PADDING,
  MAX_DROPS,
  MAX_LAYER_SWEEPS,
  MAX_REPLAY_DROPS,
  MIN_WIDTH_PX,
  PERFECT_WINDOW_PX,
  SPEED_RAMP_PER_LAYER,
  TICK_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "./constants";
import { createMulberry32 } from "./prng";
import type {
  OfficialSignalStackerResult,
  SignalActiveBlock,
  SignalStackerReplayPayload,
  SignalStackerResultSummary,
  SignalStackerSessionConfig,
  SignalStackerSessionPayload,
  SignalStackerState,
  SignalTowerBlock,
  SignalTowerConfig
} from "./types";

function createFoundationBlock(config: SignalTowerConfig): SignalTowerBlock {
  return {
    centerX: config.worldWidth / 2,
    width: config.baseBlockWidth,
    dropTick: 0,
    perfect: true
  };
}

function getSupportBlock(state: SignalStackerState) {
  return state.towerBlocks[state.towerBlocks.length - 1]!;
}

export function getSweepTicks(config: SignalStackerSessionConfig, floorsStacked: number) {
  return Math.max(10, Math.round(config.payload.tower.baseSweepTicks - floorsStacked * config.payload.tower.speedRampPerLayer));
}

function getTravelBounds(config: SignalStackerSessionConfig, width: number) {
  const minCenter = HORIZONTAL_PADDING + width / 2;
  const maxCenter = config.payload.tower.worldWidth - HORIZONTAL_PADDING - width / 2;

  return {
    minCenter,
    maxCenter
  };
}

export function getMaxAllowedTick(config: SignalStackerSessionConfig) {
  let total = 0;

  for (let floor = 0; floor < config.payload.tower.maxDrops; floor += 1) {
    total += getSweepTicks(config, floor) * MAX_LAYER_SWEEPS;
  }

  return total;
}

export function createSignalStackerSessionConfig(sessionId: string, seed: number): SignalStackerSessionConfig {
  const nextRandom = createMulberry32(seed);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  return {
    sessionId,
    gameTitleId: "signal-stacker",
    configVersion: "signal-stacker-v1",
    seed,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    payload: {
      tower: {
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        baseBlockWidth: BASE_BLOCK_WIDTH,
        blockHeight: BLOCK_HEIGHT,
        maxDrops: MAX_DROPS,
        perfectWindowPx: PERFECT_WINDOW_PX,
        minWidthPx: MIN_WIDTH_PX,
        baseSweepTicks: BASE_SWEEP_TICKS + Math.round(nextRandom() * 4),
        speedRampPerLayer: Number((SPEED_RAMP_PER_LAYER + nextRandom() * 0.2).toFixed(2)),
        directionPatternVersion: "signal-pattern-v1"
      }
    }
  };
}

const submissionSchema = z.object({
  sessionId: z.string().min(1),
  configVersion: z.string().min(1),
  payload: z.object({
    dropTicks: z.array(z.number().int().min(0)).min(1).max(MAX_REPLAY_DROPS)
  }),
  clientSummary: z.object({
    elapsedMs: z.number().min(0),
    reportedPlacement: z.number().nullable().optional(),
    reportedDisplayValue: z.string().nullable().optional(),
    reportedScoreSortValue: z.number().nullable().optional()
  })
});

export function parseSignalStackerSubmissionPayload(body: unknown): SignalStackerReplayPayload {
  return submissionSchema.parse(body) as SignalStackerReplayPayload;
}

export function createInitialSignalStackerState(config: SignalStackerSessionConfig): SignalStackerState {
  return {
    tick: 0,
    floorsStacked: 0,
    perfectDrops: 0,
    towerBlocks: [createFoundationBlock(config.payload.tower)],
    layerStartTick: 0,
    missTick: null,
    ended: false,
    finishReason: null
  };
}

export function getActiveSignalBlock(state: SignalStackerState, config: SignalStackerSessionConfig): SignalActiveBlock {
  const support = getSupportBlock(state);
  const sweepTicks = getSweepTicks(config, state.floorsStacked);
  const elapsed = Math.max(0, state.tick - state.layerStartTick);
  const cycleTicks = Math.max(1, sweepTicks * 2);
  const phase = elapsed % cycleTicks;
  const normalized = phase <= sweepTicks ? phase / sweepTicks : 2 - phase / sweepTicks;
  const startFromLeft = state.floorsStacked % 2 === 0;
  const { minCenter, maxCenter } = getTravelBounds(config, support.width);
  const progress = startFromLeft ? normalized : 1 - normalized;
  const centerX = minCenter + (maxCenter - minCenter) * progress;

  return {
    centerX,
    width: support.width,
    sweepTicks,
    travelProgress: progress
  };
}

function getOverlap(active: SignalActiveBlock, support: SignalTowerBlock) {
  const left = Math.max(active.centerX - active.width / 2, support.centerX - support.width / 2);
  const right = Math.min(active.centerX + active.width / 2, support.centerX + support.width / 2);
  const overlapWidth = Math.max(0, right - left);
  const overlapCenter = overlapWidth > 0 ? left + overlapWidth / 2 : active.centerX;

  return {
    overlapWidth,
    overlapCenter
  };
}

function summarizeFromState(state: SignalStackerState, config: SignalStackerSessionConfig) {
  const topBlock = getSupportBlock(state);
  const topWidthPct = Math.round((topBlock.width / config.payload.tower.baseBlockWidth) * 100);
  const elapsedMs = Math.round(state.tick * TICK_MS);
  const scoreSortValue =
    -(state.floorsStacked * 1_000_000 + state.perfectDrops * 10_000 + topWidthPct * 100) + elapsedMs;

  return {
    floorsStacked: state.floorsStacked,
    perfectDrops: state.perfectDrops,
    topWidthPct,
    elapsedMs,
    scoreSortValue,
    displayValue: `${state.floorsStacked} floors · ${state.perfectDrops} perfect`
  };
}

export function summarizeSignalStackerState(state: SignalStackerState, config: SignalStackerSessionConfig) {
  return summarizeFromState(state, config);
}

function evaluateSignalStackerRewards(floorsStacked: number, perfectDrops: number): Omit<RewardGrant, "sourceId">[] {
  const coins = Math.min(180, Math.max(10, 12 + floorsStacked * 4 + perfectDrops * 3));
  const xp = Math.min(240, Math.max(14, 16 + floorsStacked * 6 + perfectDrops * 4));

  return [
    { entryType: "coins", amount: coins, sourceType: "game_result" },
    { entryType: "xp", amount: xp, sourceType: "game_result" }
  ];
}

export function stepSignalStackerState(
  state: SignalStackerState,
  config: SignalStackerSessionConfig,
  shouldDrop: boolean
): SignalStackerState {
  if (state.ended) {
    return state;
  }

  const active = getActiveSignalBlock(state, config);
  const support = getSupportBlock(state);
  const sweepLimit = active.sweepTicks * MAX_LAYER_SWEEPS;
  const nextTick = state.tick + 1;

  if (shouldDrop) {
    const overlap = getOverlap(active, support);

    if (overlap.overlapWidth <= 0) {
      return {
        ...state,
        tick: nextTick,
        ended: true,
        finishReason: "miss",
        missTick: state.tick
      };
    }

    const isPerfect = Math.abs(active.centerX - support.centerX) <= config.payload.tower.perfectWindowPx;
    const placedBlock: SignalTowerBlock = {
      centerX: isPerfect ? support.centerX : overlap.overlapCenter,
      width: isPerfect ? support.width : Math.max(config.payload.tower.minWidthPx, overlap.overlapWidth),
      dropTick: state.tick,
      perfect: isPerfect
    };
    const nextFloors = state.floorsStacked + 1;

    return {
      ...state,
      tick: nextTick,
      floorsStacked: nextFloors,
      perfectDrops: state.perfectDrops + (isPerfect ? 1 : 0),
      towerBlocks: [...state.towerBlocks, placedBlock],
      layerStartTick: nextTick,
      ended: nextFloors >= config.payload.tower.maxDrops,
      finishReason: nextFloors >= config.payload.tower.maxDrops ? "max_drops" : null
    };
  }

  if (state.tick - state.layerStartTick >= sweepLimit) {
    return {
      ...state,
      tick: nextTick,
      ended: true,
      finishReason: "timeout",
      missTick: state.tick
    };
  }

  return {
    ...state,
    tick: nextTick
  };
}

function rejection(
  config: SignalStackerSessionConfig,
  submission: SignalStackerReplayPayload,
  reason: string,
  summary?: Partial<SignalStackerResultSummary>
): OfficialSignalStackerResult {
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
      floorsStacked: summary?.floorsStacked ?? 0,
      perfectDrops: summary?.perfectDrops ?? 0,
      topWidthPct: summary?.topWidthPct ?? 0,
      missTick: summary?.missTick ?? null
    }
  };
}

export function replaySignalStackerGame(
  config: SignalStackerSessionConfig,
  submission: SignalStackerReplayPayload
): OfficialSignalStackerResult {
  if (submission.configVersion !== config.configVersion) {
    return rejection(config, submission, "config_version_mismatch");
  }

  const { dropTicks } = submission.payload;
  const maxAllowedTick = getMaxAllowedTick(config);

  for (let index = 0; index < dropTicks.length; index += 1) {
    const tick = dropTicks[index]!;
    if (tick > maxAllowedTick) {
      return rejection(config, submission, "drop_tick_out_of_bounds");
    }

    if (index > 0 && tick <= dropTicks[index - 1]!) {
      return rejection(config, submission, "non_monotonic_drop_ticks");
    }
  }

  let state = createInitialSignalStackerState(config);
  let dropIndex = 0;

  while (!state.ended && state.tick <= maxAllowedTick) {
    const shouldDrop = dropIndex < dropTicks.length && dropTicks[dropIndex] === state.tick;

    if (shouldDrop) {
      dropIndex += 1;
    }

    state = stepSignalStackerState(state, config, shouldDrop);
  }

  if (dropIndex < dropTicks.length) {
    return rejection(config, submission, "post_finish_drop_ticks", {
      floorsStacked: state.floorsStacked,
      perfectDrops: state.perfectDrops,
      topWidthPct: summarizeFromState(state, config).topWidthPct,
      missTick: state.missTick
    });
  }

  if (!state.ended) {
    return rejection(config, submission, "incomplete_run", {
      floorsStacked: state.floorsStacked,
      perfectDrops: state.perfectDrops,
      topWidthPct: summarizeFromState(state, config).topWidthPct,
      missTick: state.missTick
    });
  }

  const summary = summarizeFromState(state, config);
  const flags: string[] = [];
  if (Math.abs(Math.round(submission.clientSummary.elapsedMs) - summary.elapsedMs) > 2500) {
    flags.push("client_summary_mismatch");
  }

  const rewards = evaluateSignalStackerRewards(summary.floorsStacked, summary.perfectDrops).map((reward) => ({
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
    elapsedMs: summary.elapsedMs,
    rewards,
    flags,
    resultSummary: {
      floorsStacked: summary.floorsStacked,
      perfectDrops: summary.perfectDrops,
      topWidthPct: summary.topWidthPct,
      missTick: state.missTick
    }
  };
}

export function generateAutoplayDropTicks(config: SignalStackerSessionConfig, targetFloors = 8) {
  let state = createInitialSignalStackerState(config);
  const dropTicks: number[] = [];
  const desiredFloors = Math.max(1, Math.min(targetFloors, config.payload.tower.maxDrops - 1));

  const findTick = (
    currentState: SignalStackerState,
    matcher: (active: SignalActiveBlock, support: SignalTowerBlock) => boolean
  ) => {
    const support = getSupportBlock(currentState);
    const sweepTicks = getSweepTicks(config, currentState.floorsStacked) * MAX_LAYER_SWEEPS;

    for (let candidate = currentState.tick; candidate <= currentState.tick + sweepTicks; candidate += 1) {
      const active = getActiveSignalBlock({ ...currentState, tick: candidate }, config);
      if (matcher(active, support)) {
        return candidate;
      }
    }

    return null;
  };

  while (!state.ended && state.floorsStacked < desiredFloors) {
    const perfectTick = findTick(
      state,
      (active, support) => Math.abs(active.centerX - support.centerX) <= config.payload.tower.perfectWindowPx / 2
    );

    if (perfectTick === null) {
      break;
    }

    while (!state.ended && state.tick < perfectTick) {
      state = stepSignalStackerState(state, config, false);
    }

    if (state.ended) {
      break;
    }

    dropTicks.push(state.tick);
    state = stepSignalStackerState(state, config, true);
  }

  if (!state.ended) {
    const missTick = findTick(state, (active, support) => getOverlap(active, support).overlapWidth <= 0);
    if (missTick !== null) {
      while (!state.ended && state.tick < missTick) {
        state = stepSignalStackerState(state, config, false);
      }

      if (!state.ended) {
        dropTicks.push(state.tick);
        state = stepSignalStackerState(state, config, true);
      }
    }
  }

  return dropTicks;
}

export const signalStackerGameModule: GameModuleServerContract<
  SignalStackerSessionPayload,
  SignalStackerReplayPayload["payload"],
  SignalStackerResultSummary
> = {
  definition: {
    id: "signal-stacker",
    slug: "signal-stacker",
    name: "Signal Stacker",
    status: "live",
    tagline: "Drop precision stacks and hold the tower steady.",
    description:
      "A tactile one-thumb stacking challenge with server-verified timing, perfect-drop bonuses, and fast leaderboard climbs inside Telegram.",
    coverLabel: "Precision"
  },
  createSessionConfig: createSignalStackerSessionConfig,
  parseSubmissionPayload: parseSignalStackerSubmissionPayload,
  verifySubmission: replaySignalStackerGame
};
