import { z } from "zod";

import type { GameModuleServerContract, RewardGrant } from "@telegramplay/game-core";

import {
  BALL_RADIUS,
  BASE_BALL_SPEED,
  BLOCK_GAP,
  BLOCK_HEIGHT,
  BLOCK_WIDTH,
  GRID_COLS,
  GRID_ROWS,
  GRID_TOP,
  LANE_COUNT,
  MAGNET_MAX_TICKS,
  MAX_DEFLECTOR_CHANGES,
  MAX_MAGNET_WINDOWS,
  MAX_TICKS,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_Y,
  SPEED_RAMP,
  TICK_MS,
  TICK_SECONDS,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "./constants";
import { createMulberry32 } from "./prng";
import type {
  OfficialPrismBreakResult,
  PrismBreakDeflectorChange,
  PrismBreakLane,
  PrismBreakMagnetWindow,
  PrismBreakReplayPayload,
  PrismBreakResultSummary,
  PrismBreakSessionConfig,
  PrismBreakSessionPayload,
  PrismBreakState,
  PrismKind,
  PrismTile
} from "./types";

function getDisplayValue(prismsShattered: number, survivedMs: number) {
  return `${prismsShattered} prisms · ${(survivedMs / 1000).toFixed(1)}s`;
}

function getScoreSortValue(prismsShattered: number, chainBursts: number, survivedMs: number) {
  return -(prismsShattered * 1_000_000 + chainBursts * 10_000 + survivedMs);
}

function evaluatePrismBreakRewards(prismsShattered: number, chainBursts: number): Omit<RewardGrant, "sourceId">[] {
  const coins = Math.min(260, Math.max(14, 16 + prismsShattered * 2 + chainBursts * 4));
  const xp = Math.min(320, Math.max(18, 18 + prismsShattered * 3 + chainBursts * 5));

  return [
    { entryType: "coins", amount: coins, sourceType: "game_result" },
    { entryType: "xp", amount: xp, sourceType: "game_result" }
  ];
}

export function getLaneCenter(lane: PrismBreakLane) {
  return WORLD_WIDTH * (0.2 + lane * 0.3);
}

function clampLane(value: number): PrismBreakLane {
  return Math.max(0, Math.min(LANE_COUNT - 1, value)) as PrismBreakLane;
}

function getWaveSeed(seed: number, waveIndex: number) {
  return seed + waveIndex * 7919;
}

export function createPrismWave(seed: number, waveIndex: number): PrismTile[] {
  const nextRandom = createMulberry32(getWaveSeed(seed, waveIndex));
  const leftPadding = (WORLD_WIDTH - (GRID_COLS * BLOCK_WIDTH + (GRID_COLS - 1) * BLOCK_GAP)) / 2;
  const tiles: PrismTile[] = [];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      if (nextRandom() < 0.12) {
        continue;
      }

      const kind = Math.floor(nextRandom() * 3) as PrismKind;
      tiles.push({
        id: `wave_${waveIndex}_${row}_${col}`,
        row,
        col,
        x: leftPadding + col * (BLOCK_WIDTH + BLOCK_GAP),
        y: GRID_TOP + row * (BLOCK_HEIGHT + BLOCK_GAP),
        width: BLOCK_WIDTH,
        height: BLOCK_HEIGHT,
        kind
      });
    }
  }

  return tiles.length > 0 ? tiles : createPrismWave(seed + 1, waveIndex);
}

export function createPrismBreakSessionConfig(sessionId: string, seed: number): PrismBreakSessionConfig {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  return {
    sessionId,
    gameTitleId: "prism-break",
    configVersion: "prism-break-v1",
    seed,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    payload: {
      chamber: {
        waveVersion: "prism-wave-v1",
        laneCount: LANE_COUNT,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        paddleY: PADDLE_Y,
        paddleWidth: PADDLE_WIDTH,
        paddleHeight: PADDLE_HEIGHT,
        ballRadius: BALL_RADIUS,
        baseBallSpeed: BASE_BALL_SPEED,
        rampCurve: SPEED_RAMP,
        maxTicks: MAX_TICKS,
        magnetMaxTicks: MAGNET_MAX_TICKS,
        launchLane: 1,
        initialWave: createPrismWave(seed, 0)
      }
    }
  };
}

const submissionSchema = z.object({
  sessionId: z.string().min(1),
  configVersion: z.string().min(1),
  payload: z.object({
    deflectorChanges: z
      .array(
        z.object({
          tick: z.number().int().min(0).max(MAX_TICKS - 1),
          lane: z.union([z.literal(0), z.literal(1), z.literal(2)])
        })
      )
      .max(MAX_DEFLECTOR_CHANGES),
    magnetWindows: z
      .array(
        z.object({
          startTick: z.number().int().min(0).max(MAX_TICKS - 1),
          endTick: z.number().int().min(0).max(MAX_TICKS - 1)
        })
      )
      .max(MAX_MAGNET_WINDOWS)
  }),
  clientSummary: z.object({
    elapsedMs: z.number().min(0),
    reportedPlacement: z.number().nullable().optional(),
    reportedDisplayValue: z.string().nullable().optional(),
    reportedScoreSortValue: z.number().nullable().optional()
  })
});

export function parsePrismBreakSubmissionPayload(body: unknown): PrismBreakReplayPayload {
  return submissionSchema.parse(body) as PrismBreakReplayPayload;
}

export function createInitialPrismBreakState(config: PrismBreakSessionConfig): PrismBreakState {
  const lane = config.payload.chamber.launchLane;
  return {
    tick: 0,
    deflectorLane: lane,
    ballX: getLaneCenter(lane),
    ballY: config.payload.chamber.paddleY - config.payload.chamber.paddleHeight / 2 - config.payload.chamber.ballRadius - 4,
    ballVx: 0,
    ballVy: 0,
    attached: true,
    attachedReason: "serve",
    attachedTicks: 0,
    waveIndex: 0,
    prisms: config.payload.chamber.initialWave,
    prismsShattered: 0,
    chainBursts: 0,
    burstFlashTicks: 0,
    lastBurstSize: 0,
    missed: false,
    finishReason: null
  };
}

function summarizeState(state: PrismBreakState) {
  const survivedMs = Math.round(state.tick * TICK_MS);

  return {
    prismsShattered: state.prismsShattered,
    chainBursts: state.chainBursts,
    survivedMs,
    finishReason: state.finishReason,
    scoreSortValue: getScoreSortValue(state.prismsShattered, state.chainBursts, survivedMs),
    displayValue: getDisplayValue(state.prismsShattered, survivedMs)
  };
}

export function summarizePrismBreakState(state: PrismBreakState) {
  return summarizeState(state);
}

function normalizeVelocity(vx: number, vy: number, speed: number) {
  const len = Math.sqrt(vx * vx + vy * vy) || 1;
  return {
    vx: (vx / len) * speed,
    vy: (vy / len) * speed
  };
}

function launchBall(state: PrismBreakState, lane: PrismBreakLane, speed: number) {
  const paddleCenter = getLaneCenter(lane);
  const offset = Math.max(-1, Math.min(1, (state.ballX - paddleCenter) / (PADDLE_WIDTH / 2)));
  const laneBias = lane === 0 ? -0.38 : lane === 2 ? 0.38 : 0;
  const horizontal = Math.max(-0.92, Math.min(0.92, offset * 0.85 + laneBias));
  const vx = horizontal * speed;
  const vy = -Math.sqrt(Math.max(24, speed * speed - vx * vx));

  return {
    ...state,
    attached: false,
    attachedTicks: 0,
    ballX: paddleCenter,
    ballY: PADDLE_Y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 4,
    ballVx: vx,
    ballVy: vy
  };
}

function getSpeed(state: PrismBreakState, config: PrismBreakSessionConfig) {
  return config.payload.chamber.baseBallSpeed + state.waveIndex * config.payload.chamber.rampCurve;
}

function findCluster(prisms: PrismTile[], hit: PrismTile) {
  const key = (tile: PrismTile) => `${tile.row}:${tile.col}`;
  const lookup = new Map(prisms.map((tile) => [key(tile), tile]));
  const queue = [hit];
  const visited = new Set<string>();
  const cluster: PrismTile[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = key(current);
    if (visited.has(currentKey)) {
      continue;
    }
    visited.add(currentKey);
    cluster.push(current);

    const neighbors = [
      `${current.row - 1}:${current.col}`,
      `${current.row + 1}:${current.col}`,
      `${current.row}:${current.col - 1}`,
      `${current.row}:${current.col + 1}`
    ];
    for (const neighborKey of neighbors) {
      const neighbor = lookup.get(neighborKey);
      if (neighbor && neighbor.kind === hit.kind && !visited.has(neighborKey)) {
        queue.push(neighbor);
      }
    }
  }

  return cluster;
}

function circleRectCollision(x: number, y: number, radius: number, tile: PrismTile) {
  const nearestX = Math.max(tile.x, Math.min(x, tile.x + tile.width));
  const nearestY = Math.max(tile.y, Math.min(y, tile.y + tile.height));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function getMagnetActiveAtTick(windows: PrismBreakMagnetWindow[], tick: number) {
  return windows.some((window) => tick >= window.startTick && tick <= window.endTick);
}

function reject(config: PrismBreakSessionConfig, submission: PrismBreakReplayPayload, reason: string, flags: string[]) {
  const elapsedMs = Math.min(Math.round(submission.clientSummary.elapsedMs), config.payload.chamber.maxTicks * TICK_MS);

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
      prismsShattered: 0,
      chainBursts: 0,
      survivedMs: elapsedMs,
      finishReason: null
    }
  };
}

function validateChanges(changes: PrismBreakDeflectorChange[]) {
  let lastTick = -1;
  for (const change of changes) {
    if (change.tick <= lastTick) {
      return "non_monotonic_deflector_changes";
    }
    lastTick = change.tick;
  }
  return null;
}

function validateMagnetWindows(windows: PrismBreakMagnetWindow[]) {
  let lastEnd = -1;
  for (const window of windows) {
    if (window.endTick < window.startTick) {
      return "magnet_window_inverted";
    }
    if (window.startTick <= lastEnd) {
      return "magnet_windows_overlap";
    }
    if (window.endTick - window.startTick + 1 > MAGNET_MAX_TICKS) {
      return "magnet_window_too_long";
    }
    lastEnd = window.endTick;
  }
  return null;
}

export function stepPrismBreakState(
  state: PrismBreakState,
  config: PrismBreakSessionConfig,
  input: { laneChange: PrismBreakLane | null; magnetActive: boolean }
): PrismBreakState {
  if (state.missed || state.tick >= config.payload.chamber.maxTicks) {
    return state;
  }

  const speed = getSpeed(state, config);
  const nextState: PrismBreakState = {
    ...state,
    tick: state.tick + 1,
    deflectorLane: input.laneChange ?? state.deflectorLane,
    burstFlashTicks: Math.max(0, state.burstFlashTicks - 1)
  };

  if (nextState.attached) {
    nextState.ballX = getLaneCenter(nextState.deflectorLane);
    nextState.ballY = config.payload.chamber.paddleY - config.payload.chamber.paddleHeight / 2 - config.payload.chamber.ballRadius - 4;

    if (nextState.attachedReason === "serve") {
      if (input.laneChange !== null) {
        return launchBall(nextState, nextState.deflectorLane, speed);
      }
      return nextState;
    }

    nextState.attachedTicks = state.attachedTicks + 1;
    if (!input.magnetActive || nextState.attachedTicks >= config.payload.chamber.magnetMaxTicks) {
      return launchBall(nextState, nextState.deflectorLane, speed);
    }

    return nextState;
  }

  const previousX = state.ballX;
  const previousY = state.ballY;
  nextState.ballX += nextState.ballVx * TICK_SECONDS;
  nextState.ballY += nextState.ballVy * TICK_SECONDS;

  if (nextState.ballX - BALL_RADIUS <= 0 || nextState.ballX + BALL_RADIUS >= config.payload.chamber.worldWidth) {
    nextState.ballVx *= -1;
    nextState.ballX = Math.max(BALL_RADIUS, Math.min(config.payload.chamber.worldWidth - BALL_RADIUS, nextState.ballX));
  }

  if (nextState.ballY - BALL_RADIUS <= 0) {
    nextState.ballVy = Math.abs(nextState.ballVy);
    nextState.ballY = BALL_RADIUS;
  }

  const hit = nextState.prisms.find((tile) => circleRectCollision(nextState.ballX, nextState.ballY, BALL_RADIUS, tile));
  if (hit) {
    const cluster = findCluster(nextState.prisms, hit);
    const removedIds = new Set(cluster.map((tile) => tile.id));
    nextState.prisms = nextState.prisms.filter((tile) => !removedIds.has(tile.id));
    nextState.prismsShattered += cluster.length;
    nextState.chainBursts += Math.max(0, cluster.length - 1);
    nextState.lastBurstSize = cluster.length;
    nextState.burstFlashTicks = 8;

    const hitCenterX = hit.x + hit.width / 2;
    const hitCenterY = hit.y + hit.height / 2;
    if (Math.abs(previousY - hitCenterY) > Math.abs(previousX - hitCenterX)) {
      nextState.ballVy *= -1;
    } else {
      nextState.ballVx *= -1;
    }
  }

  const paddleCenter = getLaneCenter(nextState.deflectorLane);
  const paddleLeft = paddleCenter - config.payload.chamber.paddleWidth / 2;
  const paddleRight = paddleCenter + config.payload.chamber.paddleWidth / 2;
  const paddleTop = config.payload.chamber.paddleY - config.payload.chamber.paddleHeight / 2;
  const crossedPaddle =
    previousY + BALL_RADIUS <= paddleTop &&
    nextState.ballY + BALL_RADIUS >= paddleTop &&
    nextState.ballX >= paddleLeft - BALL_RADIUS &&
    nextState.ballX <= paddleRight + BALL_RADIUS &&
    nextState.ballVy > 0;

  if (crossedPaddle) {
    if (input.magnetActive) {
      nextState.attached = true;
      nextState.attachedReason = "magnet";
      nextState.attachedTicks = 0;
      nextState.ballVx = 0;
      nextState.ballVy = 0;
      nextState.ballX = paddleCenter;
      nextState.ballY = paddleTop - BALL_RADIUS - 4;
      return nextState;
    }

    const offset = (nextState.ballX - paddleCenter) / (config.payload.chamber.paddleWidth / 2);
    const laneBias = nextState.deflectorLane === 0 ? -0.34 : nextState.deflectorLane === 2 ? 0.34 : 0;
    const horizontal = Math.max(-0.94, Math.min(0.94, offset * 0.75 + laneBias));
    const normalized = normalizeVelocity(horizontal, -1, speed);
    nextState.ballVx = normalized.vx;
    nextState.ballVy = normalized.vy;
    nextState.ballY = paddleTop - BALL_RADIUS - 2;
  }

  if (nextState.prisms.length === 0) {
    nextState.waveIndex += 1;
    nextState.prisms = createPrismWave(config.seed, nextState.waveIndex);
    nextState.attached = true;
    nextState.attachedReason = "serve";
    nextState.attachedTicks = 0;
    nextState.ballVx = 0;
    nextState.ballVy = 0;
    nextState.ballX = getLaneCenter(nextState.deflectorLane);
    nextState.ballY = paddleTop - BALL_RADIUS - 4;
  }

  if (nextState.ballY - BALL_RADIUS > config.payload.chamber.worldHeight + 6) {
    nextState.missed = true;
    nextState.finishReason = "miss";
  }

  return nextState;
}

export function replayPrismBreakGame(config: PrismBreakSessionConfig, submission: PrismBreakReplayPayload): OfficialPrismBreakResult {
  if (submission.configVersion !== config.configVersion) {
    return reject(config, submission, "config_version_mismatch", ["config_version_mismatch"]);
  }

  const changesValidation = validateChanges(submission.payload.deflectorChanges);
  if (changesValidation) {
    return reject(config, submission, changesValidation, [changesValidation]);
  }

  const magnetValidation = validateMagnetWindows(submission.payload.magnetWindows);
  if (magnetValidation) {
    return reject(config, submission, magnetValidation, [magnetValidation]);
  }

  let state = createInitialPrismBreakState(config);
  let changeIndex = 0;

  while (!state.missed && state.tick < config.payload.chamber.maxTicks) {
    const scheduled = submission.payload.deflectorChanges[changeIndex];
    const laneChange = scheduled && scheduled.tick === state.tick ? scheduled.lane : null;
    if (laneChange !== null) {
      changeIndex += 1;
    }

    state = stepPrismBreakState(state, config, {
      laneChange,
      magnetActive: getMagnetActiveAtTick(submission.payload.magnetWindows, state.tick)
    });
  }

  if (state.tick >= config.payload.chamber.maxTicks && !state.finishReason) {
    state = {
      ...state,
      finishReason: "max_ticks"
    };
  }

  const summary = summarizeState(state);

  return {
    sessionId: config.sessionId,
    gameTitleId: config.gameTitleId,
    status: "accepted",
    placement: state.missed ? 2 : 1,
    scoreSortValue: summary.scoreSortValue,
    displayValue: summary.displayValue,
    elapsedMs: summary.survivedMs,
    rewards: evaluatePrismBreakRewards(summary.prismsShattered, summary.chainBursts).map((reward) => ({
      ...reward,
      sourceId: config.sessionId
    })),
    flags: [],
    resultSummary: {
      prismsShattered: summary.prismsShattered,
      chainBursts: summary.chainBursts,
      survivedMs: summary.survivedMs,
      finishReason: summary.finishReason
    }
  };
}

export function generateAutoplayPrismInputs(config: PrismBreakSessionConfig, targetPrisms = 12) {
  const deflectorChanges: PrismBreakDeflectorChange[] = [];
  const magnetWindows: PrismBreakMagnetWindow[] = [];
  let state = createInitialPrismBreakState(config);
  let lastMagnetEnd = -1;

  const queueLaneChange = (tick: number, lane: PrismBreakLane) => {
    const last = deflectorChanges[deflectorChanges.length - 1];
    if (!last || last.tick !== tick || last.lane !== lane) {
      deflectorChanges.push({ tick, lane });
    }
  };

  while (!state.missed && state.tick < config.payload.chamber.maxTicks && state.prismsShattered < targetPrisms) {
    let laneChange: PrismBreakLane | null = null;
    let magnetActive = false;

    if (state.attached) {
      laneChange = state.deflectorLane;
      queueLaneChange(state.tick, state.deflectorLane);
    } else if (state.ballVy > 0 && state.ballY > PADDLE_Y - 140) {
      const timeToPaddle = Math.max(0, (PADDLE_Y - state.ballY) / Math.max(1, state.ballVy));
      const predictedX = state.ballX + state.ballVx * timeToPaddle;
      const desiredLane = clampLane(Math.round((predictedX - WORLD_WIDTH * 0.2) / (WORLD_WIDTH * 0.3)));
      if (desiredLane !== state.deflectorLane) {
        laneChange = desiredLane;
        queueLaneChange(state.tick, desiredLane);
      }
      const targetCenter = getLaneCenter(desiredLane);
      if (Math.abs(predictedX - targetCenter) > PADDLE_WIDTH * 0.4 && state.tick > lastMagnetEnd + 2) {
        magnetWindows.push({ startTick: state.tick, endTick: state.tick + 5 });
        lastMagnetEnd = state.tick + 5;
        magnetActive = true;
      } else {
        magnetActive = getMagnetActiveAtTick(magnetWindows, state.tick);
      }
    } else {
      magnetActive = getMagnetActiveAtTick(magnetWindows, state.tick);
    }

    state = stepPrismBreakState(state, config, { laneChange, magnetActive });
  }

  return { deflectorChanges, magnetWindows };
}

export const prismBreakGameModule: GameModuleServerContract<PrismBreakSessionPayload, PrismBreakReplayPayload["payload"], PrismBreakResultSummary> =
  {
    definition: {
      id: "prism-break",
      slug: "prism-break",
      name: "Prism Break",
      status: "live",
      tagline: "Shatter premium prisms and redirect the chamber core.",
      description:
        "A server-verified toy-tech breaker with lane-swapped deflectors, magnetic catches, and crisp prism burst chains inside Telegram.",
      coverLabel: "Breaker"
    },
    createSessionConfig: createPrismBreakSessionConfig,
    parseSubmissionPayload: parsePrismBreakSubmissionPayload,
    verifySubmission: replayPrismBreakGame
  };
