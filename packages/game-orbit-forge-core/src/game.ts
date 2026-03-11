import { z } from "zod";

import type { GameModuleServerContract, RewardGrant } from "@telegramplay/game-core";

import {
  ANGULAR_SPEED,
  CORE_RADIUS,
  INNER_RING_RADIUS,
  MAX_GATE_SPACING,
  MAX_PHASE_WINDOW_TICKS,
  MAX_PHASE_WINDOWS,
  MAX_REPLAY_SWAPS,
  MAX_TICKS,
  MIN_GATE_SPACING,
  OUTER_RING_RADIUS,
  PLAYER_RADIUS,
  RING_COUNT,
  TICK_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "./constants";
import { createMulberry32 } from "./prng";
import type {
  OfficialOrbitForgeResult,
  OrbitForgeEvent,
  OrbitForgePhaseWindow,
  OrbitForgeReplayPayload,
  OrbitForgeResultSummary,
  OrbitForgeRing,
  OrbitForgeSessionConfig,
  OrbitForgeSessionPayload,
  OrbitForgeState
} from "./types";

function getDisplayValue(gatesCleared: number, survivedMs: number) {
  return `${gatesCleared} gates · ${(survivedMs / 1000).toFixed(1)}s`;
}

function getScoreSortValue(gatesCleared: number, shardsCollected: number, survivedMs: number) {
  return -(gatesCleared * 1_000_000 + shardsCollected * 1_000 + survivedMs);
}

function evaluateOrbitForgeRewards(gatesCleared: number, shardsCollected: number): Omit<RewardGrant, "sourceId">[] {
  const coins = Math.min(220, Math.max(14, 14 + gatesCleared * 3 + shardsCollected * 5));
  const xp = Math.min(280, Math.max(18, 18 + gatesCleared * 4 + shardsCollected * 6));

  return [
    { entryType: "coins", amount: coins, sourceType: "game_result" },
    { entryType: "xp", amount: xp, sourceType: "game_result" }
  ];
}

export function createOrbitForgeEvents(seed: number) {
  const nextRandom = createMulberry32(seed);
  const events: OrbitForgeEvent[] = [];
  let tick = 18;

  while (tick < MAX_TICKS - 4) {
    const hazardRing = (nextRandom() > 0.5 ? 1 : 0) as OrbitForgeRing;
    const shardRoll = nextRandom();
    const shardRing =
      shardRoll > 0.72 ? hazardRing : shardRoll > 0.32 ? ((1 - hazardRing) as OrbitForgeRing) : null;

    events.push({
      tick,
      hazardRing,
      shardRing
    });

    tick += MIN_GATE_SPACING + Math.floor(nextRandom() * (MAX_GATE_SPACING - MIN_GATE_SPACING + 1));
  }

  return events;
}

export function createOrbitForgeSessionConfig(sessionId: string, seed: number): OrbitForgeSessionConfig {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  return {
    sessionId,
    gameTitleId: "orbit-forge",
    configVersion: "orbit-forge-v1",
    seed,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    payload: {
      course: {
        ringCount: RING_COUNT,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        coreRadius: CORE_RADIUS,
        ringRadii: [INNER_RING_RADIUS, OUTER_RING_RADIUS],
        playerRadius: PLAYER_RADIUS,
        tickMs: TICK_MS,
        maxTicks: MAX_TICKS,
        angularSpeed: ANGULAR_SPEED,
        phaseWindowTicks: MAX_PHASE_WINDOW_TICKS,
        spawnStreamVersion: "orbit-stream-v1",
        events: createOrbitForgeEvents(seed)
      }
    }
  };
}

const submissionSchema = z.object({
  sessionId: z.string().min(1),
  configVersion: z.string().min(1),
  payload: z.object({
    swapTicks: z.array(z.number().int().min(0).max(MAX_TICKS - 1)).max(MAX_REPLAY_SWAPS),
    phaseWindows: z
      .array(
        z.object({
          startTick: z.number().int().min(0).max(MAX_TICKS - 1),
          endTick: z.number().int().min(0).max(MAX_TICKS - 1)
        })
      )
      .max(MAX_PHASE_WINDOWS)
  }),
  clientSummary: z.object({
    elapsedMs: z.number().min(0),
    reportedPlacement: z.number().nullable().optional(),
    reportedDisplayValue: z.string().nullable().optional(),
    reportedScoreSortValue: z.number().nullable().optional()
  })
});

export function parseOrbitForgeSubmissionPayload(body: unknown): OrbitForgeReplayPayload {
  return submissionSchema.parse(body) as OrbitForgeReplayPayload;
}

export function createInitialOrbitForgeState(config: OrbitForgeSessionConfig): OrbitForgeState {
  void config;
  return {
    tick: 0,
    ring: 0,
    angle: -Math.PI / 2,
    gatesCleared: 0,
    shardsCollected: 0,
    nextEventIndex: 0,
    collided: false,
    collisionTick: null,
    phaseActive: false
  };
}

function summarizeState(state: OrbitForgeState): OrbitForgeResultSummary & {
  scoreSortValue: number;
  displayValue: string;
} {
  const survivedMs = Math.round(state.tick * TICK_MS);

  return {
    gatesCleared: state.gatesCleared,
    shardsCollected: state.shardsCollected,
    survivedMs,
    collisionTick: state.collisionTick,
    scoreSortValue: getScoreSortValue(state.gatesCleared, state.shardsCollected, survivedMs),
    displayValue: getDisplayValue(state.gatesCleared, survivedMs)
  };
}

export function summarizeOrbitForgeState(state: OrbitForgeState) {
  return summarizeState(state);
}

export function stepOrbitForgeState(
  state: OrbitForgeState,
  config: OrbitForgeSessionConfig,
  input: { shouldSwap: boolean; phaseActive: boolean }
): OrbitForgeState {
  if (state.collided || state.tick >= config.payload.course.maxTicks) {
    return state;
  }

  const nextState: OrbitForgeState = {
    ...state,
    tick: state.tick + 1,
    ring: input.shouldSwap ? ((1 - state.ring) as OrbitForgeRing) : state.ring,
    angle: (state.angle + config.payload.course.angularSpeed) % (Math.PI * 2),
    phaseActive: input.phaseActive
  };

  while (nextState.nextEventIndex < config.payload.course.events.length) {
    const event = config.payload.course.events[nextState.nextEventIndex];
    if (!event || event.tick > nextState.tick) {
      break;
    }

    if (nextState.ring === event.hazardRing && !input.phaseActive) {
      nextState.collided = true;
      nextState.collisionTick = nextState.tick;
      break;
    }

    nextState.gatesCleared += 1;
    if (event.shardRing === nextState.ring) {
      nextState.shardsCollected += 1;
    }
    nextState.nextEventIndex += 1;
  }

  return nextState;
}

function reject(config: OrbitForgeSessionConfig, submission: OrbitForgeReplayPayload, reason: string, flags: string[]) {
  const elapsedMs = Math.min(Math.round(submission.clientSummary.elapsedMs), config.payload.course.maxTicks * TICK_MS);

  return {
    sessionId: config.sessionId,
    gameTitleId: config.gameTitleId,
    status: "rejected" as const,
    placement: null,
    scoreSortValue: getScoreSortValue(0, 0, elapsedMs),
    displayValue: "Run rejected",
    elapsedMs,
    rewards: [],
    flags,
    rejectedReason: reason,
    resultSummary: {
      gatesCleared: 0,
      shardsCollected: 0,
      survivedMs: elapsedMs,
      collisionTick: null
    }
  };
}

function validateSwapTicks(swapTicks: number[]) {
  let lastTick = -1;
  for (const tick of swapTicks) {
    if (tick <= lastTick) {
      return "non_monotonic_swap_ticks";
    }
    lastTick = tick;
  }
  return null;
}

function validatePhaseWindows(phaseWindows: OrbitForgePhaseWindow[]) {
  let lastEnd = -1;
  for (const window of phaseWindows) {
    if (window.endTick < window.startTick) {
      return "phase_window_inverted";
    }
    if (window.startTick <= lastEnd) {
      return "phase_windows_overlap";
    }
    if (window.endTick - window.startTick + 1 > MAX_PHASE_WINDOW_TICKS) {
      return "phase_window_too_long";
    }
    lastEnd = window.endTick;
  }
  return null;
}

function isPhaseActiveAtTick(phaseWindows: OrbitForgePhaseWindow[], tick: number) {
  return phaseWindows.some((window) => tick >= window.startTick && tick <= window.endTick);
}

export function replayOrbitForgeGame(config: OrbitForgeSessionConfig, submission: OrbitForgeReplayPayload): OfficialOrbitForgeResult {
  if (submission.configVersion !== config.configVersion) {
    return reject(config, submission, "config_version_mismatch", ["config_version_mismatch"]);
  }

  const swapValidation = validateSwapTicks(submission.payload.swapTicks);
  if (swapValidation) {
    return reject(config, submission, swapValidation, [swapValidation]);
  }

  const phaseValidation = validatePhaseWindows(submission.payload.phaseWindows);
  if (phaseValidation) {
    return reject(config, submission, phaseValidation, [phaseValidation]);
  }

  let state = createInitialOrbitForgeState(config);
  let swapIndex = 0;

  while (!state.collided && state.tick < config.payload.course.maxTicks) {
    const shouldSwap =
      swapIndex < submission.payload.swapTicks.length && submission.payload.swapTicks[swapIndex] === state.tick;
    if (shouldSwap) {
      swapIndex += 1;
    }

    state = stepOrbitForgeState(state, config, {
      shouldSwap,
      phaseActive: isPhaseActiveAtTick(submission.payload.phaseWindows, state.tick)
    });
  }

  const summary = summarizeState(state);

  return {
    sessionId: config.sessionId,
    gameTitleId: config.gameTitleId,
    status: "accepted",
    placement: state.collided ? 2 : 1,
    scoreSortValue: summary.scoreSortValue,
    displayValue: summary.displayValue,
    elapsedMs: summary.survivedMs,
    rewards: evaluateOrbitForgeRewards(summary.gatesCleared, summary.shardsCollected).map((reward) => ({
      ...reward,
      sourceId: config.sessionId
    })),
    flags: [],
    resultSummary: {
      gatesCleared: summary.gatesCleared,
      shardsCollected: summary.shardsCollected,
      survivedMs: summary.survivedMs,
      collisionTick: state.collisionTick
    }
  };
}

export function generateAutoplayOrbitInputs(config: OrbitForgeSessionConfig, targetGates = 12) {
  const swapTicks: number[] = [];
  const phaseWindows: OrbitForgePhaseWindow[] = [];
  let state = createInitialOrbitForgeState(config);
  let eventIndex = 0;
  let lastPhaseEnd = -1;

  while (!state.collided && state.tick < config.payload.course.maxTicks && state.gatesCleared < targetGates) {
    const event = config.payload.course.events[eventIndex];
    let shouldSwap = false;
    let phaseActive = false;

    if (event && event.tick === state.tick + 1) {
      const targetRing = ((1 - event.hazardRing) as OrbitForgeRing);
      if (event.shardRing === event.hazardRing && state.ring === targetRing && state.tick > lastPhaseEnd + 1) {
        phaseWindows.push({ startTick: state.tick, endTick: state.tick + 1 });
        lastPhaseEnd = state.tick + 1;
        phaseActive = true;
      } else if (state.ring === event.hazardRing) {
        swapTicks.push(state.tick);
        shouldSwap = true;
      }
      eventIndex += 1;
    } else {
      phaseActive = isPhaseActiveAtTick(phaseWindows, state.tick);
    }

    state = stepOrbitForgeState(state, config, { shouldSwap, phaseActive });
  }

  return { swapTicks, phaseWindows };
}

export const orbitForgeGameModule: GameModuleServerContract<OrbitForgeSessionPayload, OrbitForgeReplayPayload["payload"], OrbitForgeResultSummary> =
  {
    definition: {
      id: "orbit-forge",
      slug: "orbit-forge",
      name: "Orbit Forge",
      status: "live",
      tagline: "Swap rings, phase hazards, and survive the forge orbit.",
      description:
        "A premium toy-tech orbit runner with server-verified survival gates, shard pickups, and phase timing inside Telegram.",
      coverLabel: "Orbit"
    },
    createSessionConfig: createOrbitForgeSessionConfig,
    parseSubmissionPayload: parseOrbitForgeSubmissionPayload,
    verifySubmission: replayOrbitForgeGame
  };
