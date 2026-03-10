import type { GameSessionConfig, GameSubmissionPayload, OfficialGameResult } from "@telegramplay/game-core";

export type HopperObstacle = {
  id: number;
  x: number;
  width: number;
  gapY: number;
  gapHeight: number;
};

export type HopperCourseConfig = {
  physicsVersion: string;
  obstacleStreamVersion: string;
  worldWidth: number;
  worldHeight: number;
  birdStartX: number;
  birdStartY: number;
  birdRadius: number;
  gravity: number;
  flapVelocity: number;
  baseSpeed: number;
  speedRamp: number;
  maxSpeed: number;
  gapRange: { min: number; max: number };
  spawnSpacingRange: { min: number; max: number };
  pipeWidth: number;
  maxTicks: number;
  obstacles: HopperObstacle[];
};

export type HopperSessionPayload = {
  course: HopperCourseConfig;
};

export type HopperSessionConfig = GameSessionConfig<HopperSessionPayload>;

export type HopperSubmissionPayload = {
  flapTicks: number[];
};

export type HopperReplayPayload = GameSubmissionPayload<HopperSubmissionPayload>;

export type HopperResultSummary = {
  gatesCleared: number;
  survivedMs: number;
  collisionTick: number | null;
};

export type OfficialHopperResult = OfficialGameResult<HopperResultSummary>;

export type HopperState = {
  tick: number;
  birdX: number;
  birdY: number;
  birdVelocity: number;
  distance: number;
  gatesCleared: number;
  nextObstacleIndex: number;
  collided: boolean;
  collisionTick: number | null;
};
