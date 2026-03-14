import { z } from "zod";

import type { GameModuleServerContract, RewardGrant } from "@telegramplay/game-core";

import {
  BALL_COUNT,
  BALL_RADIUS,
  BASE_BALL_SPEED,
  BUMPER_FLASH_TICKS,
  COMBO_TIMEOUT_TICKS,
  DRAIN_GAP_WIDTH,
  EVENT_FLASH_TICKS,
  FLIPPER_WINDOW_TICKS,
  GRAVITY,
  JACKPOT_SCORE,
  LAUNCH_X,
  LAUNCH_Y,
  LEFT_FLIPPER_PIVOT_X,
  MAX_BALL_SPEED,
  MAX_LEFT_FLIP_TICKS,
  MAX_NUDGE_WINDOWS,
  MAX_RIGHT_FLIP_TICKS,
  MAX_TICKS,
  MIN_BALL_SPEED,
  NUDGE_MAX_TICKS,
  RIGHT_FLIPPER_PIVOT_X,
  SERVE_DELAY_TICKS,
  TARGET_FLASH_TICKS,
  TICK_MS,
  TICK_SECONDS,
  TOP_MARGIN,
  WALL_MARGIN,
  WORLD_HEIGHT,
  WORLD_WIDTH
} from "./constants";
import { createMulberry32 } from "./prng";
import type {
  OfficialPhotonPinballResult,
  PhotonPinballBumper,
  PhotonPinballNudgeWindow,
  PhotonPinballReplayPayload,
  PhotonPinballResultSummary,
  PhotonPinballSessionConfig,
  PhotonPinballSessionPayload,
  PhotonPinballState,
  PhotonPinballSubmissionPayload,
  PhotonPinballTarget
} from "./types";

function getDisplayValue(score: number, jackpotsClaimed: number) {
  return `${score} pts · ${jackpotsClaimed} jackpots`;
}

function getScoreSortValue(score: number, jackpotsClaimed: number, comboPeak: number) {
  return -(score * 1000 + jackpotsClaimed * 100 + comboPeak);
}

function evaluatePhotonRewards(score: number, jackpotsClaimed: number, comboPeak: number): Omit<RewardGrant, "sourceId">[] {
  const coins = Math.min(320, Math.max(12, 18 + Math.round(score / 140) + jackpotsClaimed * 18 + comboPeak * 2));
  const xp = Math.min(360, Math.max(18, 22 + Math.round(score / 120) + jackpotsClaimed * 20 + comboPeak * 3));

  return [
    { entryType: "coins", amount: coins, sourceType: "game_result" },
    { entryType: "xp", amount: xp, sourceType: "game_result" }
  ];
}

function normalizeVelocity(vx: number, vy: number, targetSpeed: number) {
  const length = Math.sqrt(vx * vx + vy * vy) || 1;
  return {
    vx: (vx / length) * targetSpeed,
    vy: (vy / length) * targetSpeed
  };
}

function clampVelocity(vx: number, vy: number) {
  const speed = Math.sqrt(vx * vx + vy * vy) || 0;
  if (speed < 0.001) {
    return { vx, vy };
  }

  const clamped = Math.max(MIN_BALL_SPEED, Math.min(MAX_BALL_SPEED, speed));
  return normalizeVelocity(vx, vy, clamped);
}

function createBumperLayout(seed: number): PhotonPinballBumper[] {
  const nextRandom = createMulberry32(seed);
  const slots = [
    { x: 186, y: 224, radius: 30, score: 120 },
    { x: 352, y: 248, radius: 28, score: 140 },
    { x: 266, y: 364, radius: 34, score: 180 }
  ];

  return slots.map((slot, index) => ({
    id: `bumper_${index}`,
    x: slot.x + Math.round((nextRandom() - 0.5) * 24),
    y: slot.y + Math.round((nextRandom() - 0.5) * 22),
    radius: slot.radius,
    score: slot.score + Math.round(nextRandom() * 30)
  }));
}

function createTargetLayout(seed: number): PhotonPinballTarget[] {
  const nextRandom = createMulberry32(seed + 17);
  const slots = [
    { x: 92, y: 168, width: 56, height: 16, score: 160 },
    { x: 394, y: 172, width: 56, height: 16, score: 160 },
    { x: 74, y: 314, width: 50, height: 16, score: 180 },
    { x: 416, y: 324, width: 50, height: 16, score: 180 },
    { x: 182, y: 118, width: 60, height: 18, score: 220 },
    { x: 302, y: 126, width: 60, height: 18, score: 220 }
  ];

  return slots.map((slot, index) => ({
    id: `target_${index}`,
    x: slot.x + Math.round((nextRandom() - 0.5) * 18),
    y: slot.y + Math.round((nextRandom() - 0.5) * 18),
    width: slot.width,
    height: slot.height,
    score: slot.score + Math.round(nextRandom() * 40)
  }));
}

export function createPhotonPinballSessionConfig(sessionId: string, seed: number): PhotonPinballSessionConfig {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  return {
    sessionId,
    gameTitleId: "photon-pinball",
    configVersion: "photon-pinball-v1",
    seed,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    payload: {
      table: {
        tableVersion: "photon-pinball-table-v1",
        physicsVersion: "photon-pinball-physics-v1",
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        ballCount: BALL_COUNT,
        ballRadius: BALL_RADIUS,
        gravity: GRAVITY,
        baseBallSpeed: BASE_BALL_SPEED,
        maxTicks: MAX_TICKS,
        flipperWindowTicks: FLIPPER_WINDOW_TICKS,
        nudgeMaxTicks: NUDGE_MAX_TICKS,
        bumperLayout: createBumperLayout(seed),
        targetLayout: createTargetLayout(seed)
      }
    }
  };
}

const submissionSchema = z.object({
  sessionId: z.string().min(1),
  configVersion: z.string().min(1),
  payload: z.object({
    leftFlipTicks: z.array(z.number().int().min(0).max(MAX_TICKS - 1)).max(MAX_LEFT_FLIP_TICKS),
    rightFlipTicks: z.array(z.number().int().min(0).max(MAX_TICKS - 1)).max(MAX_RIGHT_FLIP_TICKS),
    nudgeWindows: z
      .array(
        z.object({
          startTick: z.number().int().min(0).max(MAX_TICKS - 1),
          endTick: z.number().int().min(0).max(MAX_TICKS - 1)
        })
      )
      .max(MAX_NUDGE_WINDOWS)
  }),
  clientSummary: z.object({
    elapsedMs: z.number().min(0),
    reportedPlacement: z.number().nullable().optional(),
    reportedDisplayValue: z.string().nullable().optional(),
    reportedScoreSortValue: z.number().nullable().optional()
  })
});

export function parsePhotonPinballSubmissionPayload(body: unknown): PhotonPinballReplayPayload {
  return submissionSchema.parse(body) as PhotonPinballReplayPayload;
}

export function createInitialPhotonPinballState(config: PhotonPinballSessionConfig): PhotonPinballState {
  return {
    tick: 0,
    ballsRemaining: config.payload.table.ballCount,
    ballsDrained: 0,
    ballActive: false,
    ballX: LAUNCH_X,
    ballY: LAUNCH_Y,
    ballVx: 0,
    ballVy: 0,
    serveTicks: 0,
    score: 0,
    jackpotsClaimed: 0,
    comboCurrent: 0,
    comboPeak: 0,
    comboTicksRemaining: 0,
    targetStates: config.payload.table.targetLayout.map((target) => ({ id: target.id, lit: true })),
    bumperFlashTicks: config.payload.table.bumperLayout.map(() => 0),
    targetFlashTicks: config.payload.table.targetLayout.map(() => 0),
    leftFlipTicksRemaining: 0,
    rightFlipTicksRemaining: 0,
    nudgeTicksRemaining: 0,
    lastEventLabel: "Ball 1",
    lastEventPoints: 0,
    lastEventTicks: EVENT_FLASH_TICKS,
    finishReason: null
  };
}

function summarizeState(state: PhotonPinballState) {
  const survivedMs = Math.round(state.tick * TICK_MS);

  return {
    score: state.score,
    jackpotsClaimed: state.jackpotsClaimed,
    comboPeak: state.comboPeak,
    ballsDrained: state.ballsDrained,
    survivedMs,
    finishReason: state.finishReason,
    scoreSortValue: getScoreSortValue(state.score, state.jackpotsClaimed, state.comboPeak),
    displayValue: getDisplayValue(state.score, state.jackpotsClaimed)
  };
}

export function summarizePhotonPinballState(state: PhotonPinballState) {
  return summarizeState(state);
}

function isCircleRectCollision(x: number, y: number, radius: number, target: PhotonPinballTarget) {
  const nearestX = Math.max(target.x, Math.min(x, target.x + target.width));
  const nearestY = Math.max(target.y, Math.min(y, target.y + target.height));
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function isFlipActiveAtTick(flipTicks: number[], tick: number, windowTicks: number) {
  for (let index = flipTicks.length - 1; index >= 0; index -= 1) {
    const trigger = flipTicks[index]!;
    if (trigger > tick) {
      continue;
    }
    if (tick <= trigger + windowTicks - 1) {
      return true;
    }
    if (tick - trigger > windowTicks) {
      return false;
    }
  }
  return false;
}

function isNudgeActiveAtTick(windows: PhotonPinballNudgeWindow[], tick: number) {
  return windows.some((window) => tick >= window.startTick && tick <= window.endTick);
}

function reject(config: PhotonPinballSessionConfig, submission: PhotonPinballReplayPayload, reason: string, flags: string[]) {
  const elapsedMs = Math.min(Math.round(submission.clientSummary.elapsedMs), config.payload.table.maxTicks * TICK_MS);

  return {
    sessionId: config.sessionId,
    gameTitleId: config.gameTitleId,
    status: "rejected" as const,
    placement: null,
    scoreSortValue: getScoreSortValue(0, 0, 0),
    displayValue: "Run rejected",
    elapsedMs,
    rewards: [],
    flags,
    rejectedReason: reason,
    resultSummary: {
      score: 0,
      jackpotsClaimed: 0,
      comboPeak: 0,
      ballsDrained: 0,
      survivedMs: elapsedMs,
      finishReason: null
    }
  };
}

function validateFlipTicks(ticks: number[], label: "left" | "right") {
  let lastTick = -1;
  for (const tick of ticks) {
    if (tick <= lastTick) {
      return `non_monotonic_${label}_flip_ticks`;
    }
    lastTick = tick;
  }
  return null;
}

function validateNudgeWindows(windows: PhotonPinballNudgeWindow[]) {
  let lastEnd = -1;
  for (const window of windows) {
    if (window.endTick < window.startTick) {
      return "nudge_window_inverted";
    }
    if (window.endTick - window.startTick + 1 > NUDGE_MAX_TICKS) {
      return "nudge_window_too_long";
    }
    if (window.startTick <= lastEnd) {
      return "overlapping_nudge_windows";
    }
    lastEnd = window.endTick;
  }
  return null;
}

export function stepPhotonPinballState(
  state: PhotonPinballState,
  config: PhotonPinballSessionConfig,
  input: { leftFlip: boolean; rightFlip: boolean; nudge: boolean }
): PhotonPinballState {
  if (state.finishReason) {
    return state;
  }

  const table = config.payload.table;
  const next: PhotonPinballState = {
    ...state,
    tick: state.tick + 1,
    bumperFlashTicks: state.bumperFlashTicks.map((ticks) => Math.max(0, ticks - 1)),
    targetFlashTicks: state.targetFlashTicks.map((ticks) => Math.max(0, ticks - 1)),
    leftFlipTicksRemaining: input.leftFlip ? table.flipperWindowTicks : Math.max(0, state.leftFlipTicksRemaining - 1),
    rightFlipTicksRemaining: input.rightFlip ? table.flipperWindowTicks : Math.max(0, state.rightFlipTicksRemaining - 1),
    nudgeTicksRemaining: input.nudge ? table.nudgeMaxTicks : Math.max(0, state.nudgeTicksRemaining - 1),
    lastEventTicks: Math.max(0, state.lastEventTicks - 1)
  };

  if (next.comboTicksRemaining > 0) {
    next.comboTicksRemaining -= 1;
    if (next.comboTicksRemaining === 0) {
      next.comboCurrent = 0;
    }
  }

  if (next.lastEventTicks === 0) {
    next.lastEventLabel = null;
    next.lastEventPoints = 0;
  }

  if (!state.ballActive) {
    if (state.ballsRemaining <= 0) {
      next.finishReason = "balls_drained";
      return next;
    }

    if (state.serveTicks + 1 < SERVE_DELAY_TICKS) {
      next.serveTicks = state.serveTicks + 1;
      next.ballX = LAUNCH_X;
      next.ballY = LAUNCH_Y;
      next.ballVx = 0;
      next.ballVy = 0;
      return next;
    }

    const ballNumber = table.ballCount - state.ballsRemaining + 1;
    next.ballActive = true;
    next.serveTicks = 0;
    next.ballX = LAUNCH_X;
    next.ballY = LAUNCH_Y;
    next.ballVx = -(table.baseBallSpeed * (0.36 + ballNumber * 0.04));
    next.ballVy = -(table.baseBallSpeed * (1 + ballNumber * 0.03));
    next.lastEventLabel = `Ball ${ballNumber}`;
    next.lastEventPoints = 0;
    next.lastEventTicks = EVENT_FLASH_TICKS;
    return next;
  }

  let ballX = state.ballX;
  let ballY = state.ballY;
  let ballVx = state.ballVx;
  let ballVy = state.ballVy;

  if (next.nudgeTicksRemaining > 0) {
    ballVy -= 18;
    ballVx += ballX < WORLD_WIDTH / 2 ? 4 : -4;
  }

  ballVy += table.gravity * TICK_SECONDS;
  ballX += ballVx * TICK_SECONDS;
  ballY += ballVy * TICK_SECONDS;

  if (ballX < WALL_MARGIN + table.ballRadius) {
    ballX = WALL_MARGIN + table.ballRadius;
    ballVx = Math.abs(ballVx) * 0.96;
  }
  if (ballX > table.worldWidth - WALL_MARGIN - table.ballRadius) {
    ballX = table.worldWidth - WALL_MARGIN - table.ballRadius;
    ballVx = -Math.abs(ballVx) * 0.96;
  }
  if (ballY < TOP_MARGIN + table.ballRadius) {
    ballY = TOP_MARGIN + table.ballRadius;
    ballVy = Math.abs(ballVy) * 0.96;
  }

  let scoringEvent = false;

  for (const [index, bumper] of table.bumperLayout.entries()) {
    const dx = ballX - bumper.x;
    const dy = ballY - bumper.y;
    const minDistance = table.ballRadius + bumper.radius;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > minDistance * minDistance) {
      continue;
    }

    const distance = Math.sqrt(distanceSq) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    ballX = bumper.x + nx * (minDistance + 1.5);
    ballY = bumper.y + ny * (minDistance + 1.5);
    const dot = ballVx * nx + ballVy * ny;
    ballVx = ballVx - 2 * dot * nx + nx * 42;
    ballVy = ballVy - 2 * dot * ny + ny * 42;
    const velocity = normalizeVelocity(ballVx, ballVy, Math.max(table.baseBallSpeed * 1.24, Math.hypot(ballVx, ballVy) + 88));
    ballVx = velocity.vx;
    ballVy = velocity.vy;

    const comboValue = next.comboCurrent + 1;
    const awarded = Math.round(bumper.score * (1 + Math.min(comboValue - 1, 4) * 0.18));
    next.score += awarded;
    next.comboCurrent = comboValue;
    next.comboPeak = Math.max(next.comboPeak, comboValue);
    next.comboTicksRemaining = COMBO_TIMEOUT_TICKS;
    next.bumperFlashTicks[index] = BUMPER_FLASH_TICKS;
    next.lastEventLabel = comboValue > 1 ? `Bumper x${comboValue}` : "Bumper";
    next.lastEventPoints = awarded;
    next.lastEventTicks = EVENT_FLASH_TICKS;
    scoringEvent = true;
    break;
  }

  for (const [index, target] of table.targetLayout.entries()) {
    if (!next.targetStates[index]?.lit) {
      continue;
    }
    if (!isCircleRectCollision(ballX, ballY, table.ballRadius, target)) {
      continue;
    }

    next.targetStates[index] = { ...next.targetStates[index], lit: false };
    next.targetFlashTicks[index] = TARGET_FLASH_TICKS;
    const comboValue = next.comboCurrent + 1;
    const awarded = Math.round(target.score * (1 + Math.min(comboValue - 1, 4) * 0.22));
    next.score += awarded;
    next.comboCurrent = comboValue;
    next.comboPeak = Math.max(next.comboPeak, comboValue);
    next.comboTicksRemaining = COMBO_TIMEOUT_TICKS;
    next.lastEventLabel = "Target";
    next.lastEventPoints = awarded;
    next.lastEventTicks = EVENT_FLASH_TICKS;
    scoringEvent = true;

    if (Math.abs(ballY - (target.y + target.height / 2)) > Math.abs(ballX - (target.x + target.width / 2))) {
      ballVy = -ballVy * 0.94;
    } else {
      ballVx = -ballVx * 0.94;
    }

    if (next.targetStates.every((stateEntry) => !stateEntry.lit)) {
      next.jackpotsClaimed += 1;
      const jackpotBonus = JACKPOT_SCORE + next.comboCurrent * 80;
      next.score += jackpotBonus;
      next.targetStates = next.targetStates.map((stateEntry) => ({ ...stateEntry, lit: true }));
      next.lastEventLabel = "Jackpot";
      next.lastEventPoints = jackpotBonus;
      next.lastEventTicks = EVENT_FLASH_TICKS;
    }
    break;
  }

  if (ballY > 720 && ballY < 850) {
    if (next.leftFlipTicksRemaining > 0 && ballX < WORLD_WIDTH / 2 + 12) {
      ballX = Math.max(ballX, LEFT_FLIPPER_PIVOT_X - 22);
      ballVx = Math.max(164, Math.abs(ballVx) * 0.28 + 250);
      ballVy = -Math.max(440, Math.abs(ballVy) * 0.45 + 220);
      const comboValue = next.comboCurrent + 1;
      const awarded = 90 + Math.min(comboValue - 1, 4) * 18;
      next.score += awarded;
      next.comboCurrent = comboValue;
      next.comboPeak = Math.max(next.comboPeak, comboValue);
      next.comboTicksRemaining = COMBO_TIMEOUT_TICKS;
      next.lastEventLabel = "Flip Save";
      next.lastEventPoints = awarded;
      next.lastEventTicks = EVENT_FLASH_TICKS;
      scoringEvent = true;
    } else if (next.rightFlipTicksRemaining > 0 && ballX > WORLD_WIDTH / 2 - 12) {
      ballX = Math.min(ballX, RIGHT_FLIPPER_PIVOT_X + 22);
      ballVx = -Math.max(164, Math.abs(ballVx) * 0.28 + 250);
      ballVy = -Math.max(440, Math.abs(ballVy) * 0.45 + 220);
      const comboValue = next.comboCurrent + 1;
      const awarded = 90 + Math.min(comboValue - 1, 4) * 18;
      next.score += awarded;
      next.comboCurrent = comboValue;
      next.comboPeak = Math.max(next.comboPeak, comboValue);
      next.comboTicksRemaining = COMBO_TIMEOUT_TICKS;
      next.lastEventLabel = "Flip Save";
      next.lastEventPoints = awarded;
      next.lastEventTicks = EVENT_FLASH_TICKS;
      scoringEvent = true;
    }
  }

  const clamped = clampVelocity(ballVx, ballVy);
  ballVx = clamped.vx;
  ballVy = clamped.vy;

  next.ballX = ballX;
  next.ballY = ballY;
  next.ballVx = ballVx;
  next.ballVy = ballVy;

  if (
    (ballY > table.worldHeight - 22 && Math.abs(ballX - table.worldWidth / 2) < DRAIN_GAP_WIDTH / 2) ||
    ballY > table.worldHeight + table.ballRadius
  ) {
    next.ballActive = false;
    next.ballX = LAUNCH_X;
    next.ballY = LAUNCH_Y;
    next.ballVx = 0;
    next.ballVy = 0;
    next.serveTicks = 0;
    next.ballsRemaining = Math.max(0, next.ballsRemaining - 1);
    next.ballsDrained += 1;
    next.comboCurrent = 0;
    next.comboTicksRemaining = 0;
    next.leftFlipTicksRemaining = 0;
    next.rightFlipTicksRemaining = 0;
    next.nudgeTicksRemaining = 0;
    next.lastEventLabel = next.ballsRemaining > 0 ? `Ball ${table.ballCount - next.ballsRemaining + 1}` : "Run End";
    next.lastEventPoints = 0;
    next.lastEventTicks = EVENT_FLASH_TICKS;
    if (next.ballsRemaining === 0) {
      next.finishReason = "balls_drained";
    }
    return next;
  }

  if (!scoringEvent && next.comboTicksRemaining === 0) {
    next.comboCurrent = 0;
  }

  if (next.tick >= table.maxTicks) {
    next.finishReason = "max_ticks";
    next.ballActive = false;
  }

  return next;
}

export function replayPhotonPinballGame(config: PhotonPinballSessionConfig, submission: PhotonPinballReplayPayload): OfficialPhotonPinballResult {
  if (submission.sessionId !== config.sessionId) {
    return reject(config, submission, "session_mismatch", ["session_mismatch"]);
  }

  if (submission.configVersion !== config.configVersion) {
    return reject(config, submission, "config_version_mismatch", ["config_version_mismatch"]);
  }

  const leftError = validateFlipTicks(submission.payload.leftFlipTicks, "left");
  if (leftError) {
    return reject(config, submission, leftError, [leftError]);
  }

  const rightError = validateFlipTicks(submission.payload.rightFlipTicks, "right");
  if (rightError) {
    return reject(config, submission, rightError, [rightError]);
  }

  const nudgeError = validateNudgeWindows(submission.payload.nudgeWindows);
  if (nudgeError) {
    return reject(config, submission, nudgeError, [nudgeError]);
  }

  let state = createInitialPhotonPinballState(config);

  while (!state.finishReason && state.tick < config.payload.table.maxTicks) {
    state = stepPhotonPinballState(state, config, {
      leftFlip: isFlipActiveAtTick(submission.payload.leftFlipTicks, state.tick, config.payload.table.flipperWindowTicks),
      rightFlip: isFlipActiveAtTick(submission.payload.rightFlipTicks, state.tick, config.payload.table.flipperWindowTicks),
      nudge: isNudgeActiveAtTick(submission.payload.nudgeWindows, state.tick)
    });
  }

  const summary = summarizeState(state);
  const rewards = evaluatePhotonRewards(summary.score, summary.jackpotsClaimed, summary.comboPeak).map((reward) => ({
    ...reward,
    sourceId: config.sessionId
  }));

  return {
    sessionId: config.sessionId,
    gameTitleId: config.gameTitleId,
    status: "accepted",
    placement: 1,
    scoreSortValue: summary.scoreSortValue,
    displayValue: summary.displayValue,
    elapsedMs: summary.survivedMs,
    rewards,
    flags: [],
    resultSummary: {
      score: summary.score,
      jackpotsClaimed: summary.jackpotsClaimed,
      comboPeak: summary.comboPeak,
      ballsDrained: summary.ballsDrained,
      survivedMs: summary.survivedMs,
      finishReason: summary.finishReason
    }
  };
}

export function generateAutoplayPhotonPinballInputs(config: PhotonPinballSessionConfig, stopAtScore = 3200): PhotonPinballSubmissionPayload {
  const leftFlipTicks: number[] = [];
  const rightFlipTicks: number[] = [];
  const nudgeWindows: PhotonPinballNudgeWindow[] = [];

  let state = createInitialPhotonPinballState(config);
  let stopPiloting = false;

  while (!state.finishReason && state.tick < Math.min(config.payload.table.maxTicks, 2_000)) {
    let leftFlip = false;
    let rightFlip = false;
    let nudge = false;

    if (!stopPiloting && state.ballActive) {
      if (state.ballY > 736 && state.ballVy > 90) {
        if (state.ballX < WORLD_WIDTH / 2 && leftFlipTicks[leftFlipTicks.length - 1] !== state.tick) {
          leftFlipTicks.push(state.tick);
          leftFlip = true;
        }
        if (state.ballX >= WORLD_WIDTH / 2 && rightFlipTicks[rightFlipTicks.length - 1] !== state.tick) {
          rightFlipTicks.push(state.tick);
          rightFlip = true;
        }
      }

      if (
        state.ballY > WORLD_HEIGHT - 110 &&
        Math.abs(state.ballX - WORLD_WIDTH / 2) < DRAIN_GAP_WIDTH / 2 + 22 &&
        state.ballVy > 160
      ) {
        const lastWindow = nudgeWindows[nudgeWindows.length - 1];
        if (!lastWindow || state.tick > lastWindow.endTick + 12) {
          const endTick = Math.min(state.tick + 3, config.payload.table.maxTicks - 1);
          nudgeWindows.push({ startTick: state.tick, endTick });
          nudge = true;
        }
      }
    }

    if (state.score >= stopAtScore || state.jackpotsClaimed >= 2) {
      stopPiloting = true;
    }

    state = stepPhotonPinballState(state, config, {
      leftFlip,
      rightFlip,
      nudge: nudge || isNudgeActiveAtTick(nudgeWindows, state.tick)
    });
  }

  return {
    leftFlipTicks,
    rightFlipTicks,
    nudgeWindows
  };
}

export const photonPinballGameModule: GameModuleServerContract<
  PhotonPinballSessionPayload,
  PhotonPinballSubmissionPayload,
  PhotonPinballResultSummary
> = {
  definition: {
    id: "photon-pinball",
    slug: "photon-pinball",
    name: "Photon Pinball",
    status: "live",
    tagline: "Rip premium rebounds through a toy-tech pinball chamber.",
    description:
      "A three-ball premium pinball run with authoritative server replay, left/right flippers, controlled nudges, jackpots, and official Telegram leaderboard results.",
    coverLabel: "Pinball"
  },
  createSessionConfig: createPhotonPinballSessionConfig,
  parseSubmissionPayload: parsePhotonPinballSubmissionPayload,
  verifySubmission: replayPhotonPinballGame
};
