import { z } from "zod";

import type { GameModuleServerContract, RewardGrant } from "@telegramplay/game-core";

import {
  BASE_SPEED,
  BIRD_RADIUS,
  BIRD_START_X,
  BIRD_START_Y,
  FLAP_VELOCITY,
  GRAVITY,
  MAX_GAP_CENTER,
  MAX_GAP_HEIGHT,
  MAX_REPLAY_FLAPS,
  MAX_SPAWN_SPACING,
  MAX_SPEED,
  MAX_TICKS,
  MIN_GAP_CENTER,
  MIN_GAP_HEIGHT,
  MIN_SPAWN_SPACING,
  PIPE_WIDTH,
  SPEED_RAMP,
  STREAM_START_X,
  TICK_MS,
  TICK_SECONDS,
  WORLD_HEIGHT,
  WORLD_PADDING,
  WORLD_WIDTH
} from "./constants";
import { createMulberry32 } from "./prng";
import type {
  HopperCourseConfig,
  HopperObstacle,
  HopperReplayPayload,
  HopperResultSummary,
  HopperSessionConfig,
  HopperSessionPayload,
  HopperState,
  OfficialHopperResult
} from "./types";

function getSpeed(course: HopperCourseConfig, gatesCleared: number) {
  return Math.min(course.baseSpeed + gatesCleared * course.speedRamp, course.maxSpeed);
}

function getObstacleLeft(obstacle: HopperObstacle, distance: number) {
  return obstacle.x - distance;
}

function getScoreSortValue(gatesCleared: number, survivedMs: number) {
  return -(gatesCleared * 1_000_000 + survivedMs);
}

function getDisplayValue(gatesCleared: number, survivedMs: number) {
  return `${gatesCleared} gates · ${(survivedMs / 1000).toFixed(1)}s`;
}

function evaluateHopperRewards(gatesCleared: number, survivedMs: number): Omit<RewardGrant, "sourceId">[] {
  const coins = Math.min(180, 12 + gatesCleared * 4 + Math.floor(survivedMs / 15000) * 2);
  const xp = Math.min(260, 16 + gatesCleared * 6 + Math.floor(survivedMs / 12000) * 3);

  return [
    { entryType: "coins", amount: Math.max(12, coins), sourceType: "game_result" },
    { entryType: "xp", amount: Math.max(16, xp), sourceType: "game_result" }
  ];
}

export function createObstacleStream(seed: number, courseOverrides?: Partial<HopperCourseConfig>) {
  const nextRandom = createMulberry32(seed);
  const maxTicks = courseOverrides?.maxTicks ?? MAX_TICKS;
  const speedBudget = (courseOverrides?.maxSpeed ?? MAX_SPEED) * (maxTicks * TICK_SECONDS);
  const spawnLimit = STREAM_START_X + speedBudget + WORLD_WIDTH * 2;
  const obstacles: HopperObstacle[] = [];

  let x = STREAM_START_X;
  let id = 0;

  while (x <= spawnLimit) {
    const gapHeight =
      (courseOverrides?.gapRange?.min ?? MIN_GAP_HEIGHT) +
      nextRandom() * ((courseOverrides?.gapRange?.max ?? MAX_GAP_HEIGHT) - (courseOverrides?.gapRange?.min ?? MIN_GAP_HEIGHT));
    const gapY =
      MIN_GAP_CENTER +
      nextRandom() * (MAX_GAP_CENTER - MIN_GAP_CENTER);

    obstacles.push({
      id,
      x,
      width: courseOverrides?.pipeWidth ?? PIPE_WIDTH,
      gapY,
      gapHeight
    });

    x +=
      (courseOverrides?.spawnSpacingRange?.min ?? MIN_SPAWN_SPACING) +
      nextRandom() *
        ((courseOverrides?.spawnSpacingRange?.max ?? MAX_SPAWN_SPACING) - (courseOverrides?.spawnSpacingRange?.min ?? MIN_SPAWN_SPACING));
    id += 1;
  }

  return obstacles;
}

export function createHopperSessionConfig(sessionId: string, seed: number): HopperSessionConfig {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const course: HopperCourseConfig = {
    physicsVersion: "hopper-physics-v1",
    obstacleStreamVersion: "hopper-stream-v1",
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    birdStartX: BIRD_START_X,
    birdStartY: BIRD_START_Y,
    birdRadius: BIRD_RADIUS,
    gravity: GRAVITY,
    flapVelocity: FLAP_VELOCITY,
    baseSpeed: BASE_SPEED,
    speedRamp: SPEED_RAMP,
    maxSpeed: MAX_SPEED,
    gapRange: { min: MIN_GAP_HEIGHT, max: MAX_GAP_HEIGHT },
    spawnSpacingRange: { min: MIN_SPAWN_SPACING, max: MAX_SPAWN_SPACING },
    pipeWidth: PIPE_WIDTH,
    maxTicks: MAX_TICKS,
    obstacles: createObstacleStream(seed)
  };

  return {
    sessionId,
    gameTitleId: "skyline-hopper",
    configVersion: "skyline-hopper-v1",
    seed,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    payload: { course }
  };
}

const submissionSchema = z.object({
  sessionId: z.string().min(1),
  configVersion: z.string().min(1),
  payload: z.object({
    flapTicks: z.array(z.number().int().min(0).max(MAX_TICKS - 1)).max(MAX_REPLAY_FLAPS)
  }),
  clientSummary: z.object({
    elapsedMs: z.number().min(0),
    reportedPlacement: z.number().nullable().optional(),
    reportedDisplayValue: z.string().nullable().optional(),
    reportedScoreSortValue: z.number().nullable().optional()
  })
});

export function parseHopperSubmissionPayload(body: unknown): HopperReplayPayload {
  return submissionSchema.parse(body) as HopperReplayPayload;
}

export function createInitialHopperState(config: HopperSessionConfig): HopperState {
  return {
    tick: 0,
    birdX: config.payload.course.birdStartX,
    birdY: config.payload.course.birdStartY,
    birdVelocity: 0,
    distance: 0,
    gatesCleared: 0,
    nextObstacleIndex: 0,
    collided: false,
    collisionTick: null
  };
}

function collidesWithObstacle(state: HopperState, course: HopperCourseConfig) {
  const birdLeft = state.birdX - course.birdRadius;
  const birdRight = state.birdX + course.birdRadius;
  const birdTop = state.birdY - course.birdRadius;
  const birdBottom = state.birdY + course.birdRadius;

  for (let index = state.nextObstacleIndex; index < Math.min(state.nextObstacleIndex + 3, course.obstacles.length); index += 1) {
    const obstacle = course.obstacles[index];
    if (!obstacle) {
      break;
    }

    const left = getObstacleLeft(obstacle, state.distance);
    const right = left + obstacle.width;

    if (birdRight < left || birdLeft > right) {
      continue;
    }

    const gapTop = obstacle.gapY - obstacle.gapHeight / 2;
    const gapBottom = obstacle.gapY + obstacle.gapHeight / 2;

    if (birdTop < gapTop || birdBottom > gapBottom) {
      return true;
    }
  }

  return false;
}

export function stepHopperState(state: HopperState, config: HopperSessionConfig, shouldFlap: boolean): HopperState {
  if (state.collided || state.tick >= config.payload.course.maxTicks) {
    return state;
  }

  const course = config.payload.course;
  const nextState: HopperState = {
    ...state,
    tick: state.tick + 1
  };

  if (shouldFlap) {
    nextState.birdVelocity = course.flapVelocity;
  }

  nextState.birdVelocity += course.gravity * TICK_SECONDS;
  nextState.birdY += nextState.birdVelocity * TICK_SECONDS;
  nextState.distance += getSpeed(course, nextState.gatesCleared) * TICK_SECONDS;

  while (nextState.nextObstacleIndex < course.obstacles.length) {
    const obstacle = course.obstacles[nextState.nextObstacleIndex];
    if (!obstacle) {
      break;
    }

    const right = getObstacleLeft(obstacle, nextState.distance) + obstacle.width;
    if (right < nextState.birdX - course.birdRadius) {
      nextState.gatesCleared += 1;
      nextState.nextObstacleIndex += 1;
      continue;
    }

    break;
  }

  if (
    nextState.birdY - course.birdRadius <= WORLD_PADDING ||
    nextState.birdY + course.birdRadius >= course.worldHeight - WORLD_PADDING ||
    collidesWithObstacle(nextState, course)
  ) {
    nextState.collided = true;
    nextState.collisionTick = nextState.tick;
  }

  return nextState;
}

export function summarizeHopperState(state: HopperState) {
  const survivedMs = Math.round(state.tick * TICK_MS);

  return {
    gatesCleared: state.gatesCleared,
    survivedMs,
    scoreSortValue: getScoreSortValue(state.gatesCleared, survivedMs),
    displayValue: getDisplayValue(state.gatesCleared, survivedMs)
  };
}

export function replayHopperGame(config: HopperSessionConfig, submission: HopperReplayPayload): OfficialHopperResult {
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
      resultSummary: {
        gatesCleared: 0,
        survivedMs: 0,
        collisionTick: null
      }
    };
  }

  const flapTicks = submission.payload.flapTicks;
  const course = config.payload.course;

  for (let index = 0; index < flapTicks.length; index += 1) {
    const tick = flapTicks[index]!;
    if (tick < 0 || tick >= course.maxTicks) {
      return {
        sessionId: submission.sessionId,
        gameTitleId: config.gameTitleId,
        status: "rejected",
        placement: null,
        scoreSortValue: 0,
        displayValue: "Rejected",
        elapsedMs: 0,
        rewards: [],
        flags: ["flap_tick_out_of_bounds"],
        rejectedReason: "flap_tick_out_of_bounds",
        resultSummary: {
          gatesCleared: 0,
          survivedMs: 0,
          collisionTick: null
        }
      };
    }

    if (index > 0 && tick <= flapTicks[index - 1]!) {
      return {
        sessionId: submission.sessionId,
        gameTitleId: config.gameTitleId,
        status: "rejected",
        placement: null,
        scoreSortValue: 0,
        displayValue: "Rejected",
        elapsedMs: 0,
        rewards: [],
        flags: ["non_monotonic_flap_ticks"],
        rejectedReason: "non_monotonic_flap_ticks",
        resultSummary: {
          gatesCleared: 0,
          survivedMs: 0,
          collisionTick: null
        }
      };
    }
  }

  let state = createInitialHopperState(config);
  let flapIndex = 0;
  const flags: string[] = [];

  while (!state.collided && state.tick < course.maxTicks) {
    const shouldFlap = flapIndex < flapTicks.length && flapTicks[flapIndex] === state.tick;
    if (shouldFlap) {
      flapIndex += 1;
    }

    state = stepHopperState(state, config, shouldFlap);
  }

  if (flapIndex < flapTicks.length) {
    return {
      sessionId: submission.sessionId,
      gameTitleId: config.gameTitleId,
      status: "rejected",
      placement: null,
      scoreSortValue: 0,
      displayValue: "Rejected",
      elapsedMs: 0,
      rewards: [],
      flags: ["post_finish_flap_ticks"],
      rejectedReason: "post_finish_flap_ticks",
      resultSummary: {
        gatesCleared: state.gatesCleared,
        survivedMs: Math.round(state.tick * TICK_MS),
        collisionTick: state.collisionTick
      }
    };
  }

  if (!state.collided && state.tick < course.maxTicks) {
    return {
      sessionId: submission.sessionId,
      gameTitleId: config.gameTitleId,
      status: "rejected",
      placement: null,
      scoreSortValue: 0,
      displayValue: "Rejected",
      elapsedMs: 0,
      rewards: [],
      flags: ["invalid_run_termination"],
      rejectedReason: "invalid_run_termination",
      resultSummary: {
        gatesCleared: state.gatesCleared,
        survivedMs: Math.round(state.tick * TICK_MS),
        collisionTick: state.collisionTick
      }
    };
  }

  const summary = summarizeHopperState(state);
  const clientDelta = Math.abs(Math.round(submission.clientSummary.elapsedMs) - summary.survivedMs);
  if (clientDelta > 2500) {
    flags.push("client_summary_mismatch");
  }

  const rewards = evaluateHopperRewards(summary.gatesCleared, summary.survivedMs).map((reward) => ({
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
      gatesCleared: summary.gatesCleared,
      survivedMs: summary.survivedMs,
      collisionTick: state.collisionTick
    }
  };
}

export function generateAutoplayFlapTicks(config: HopperSessionConfig, targetGates = 6) {
  let state = createInitialHopperState(config);
  const flapTicks: number[] = [];
  let cooloff = 0;

  while (!state.collided && state.tick < config.payload.course.maxTicks) {
    const nextObstacle = config.payload.course.obstacles[state.nextObstacleIndex];
    const obstacleDistance = nextObstacle ? getObstacleLeft(nextObstacle, state.distance) - state.birdX : Number.POSITIVE_INFINITY;
    const targetY = nextObstacle && obstacleDistance < 210 ? nextObstacle.gapY + 10 : config.payload.course.birdStartY + 8;
    const shouldFlap = cooloff === 0 && state.birdY > targetY && state.birdVelocity > -135;

    if (shouldFlap) {
      flapTicks.push(state.tick);
      cooloff = 3;
    } else if (cooloff > 0) {
      cooloff -= 1;
    }

    state = stepHopperState(state, config, shouldFlap);

    if (state.gatesCleared >= targetGates && state.tick > 2400) {
      break;
    }
  }

  return flapTicks;
}

export const hopperGameModule: GameModuleServerContract<
  HopperSessionPayload,
  HopperReplayPayload["payload"],
  HopperResultSummary
> = {
  definition: {
    id: "skyline-hopper",
    slug: "skyline-hopper",
    name: "Skyline Hopper",
    status: "live",
    tagline: "Tap through the skyline and clear premium gate runs.",
    description:
      "Touch-driven endless hopper with authoritative server replay, premium obstacle lanes, and short-session leaderboard climbs inside Telegram.",
    coverLabel: "Arcade"
  },
  createSessionConfig: createHopperSessionConfig,
  parseSubmissionPayload: parseHopperSubmissionPayload,
  verifySubmission: replayHopperGame
};
