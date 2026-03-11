import type { GameSessionConfig, GameSubmissionPayload, OfficialGameResult } from "@telegramplay/game-core";

export type OrbitForgeRing = 0 | 1;

export type OrbitForgeEvent = {
  tick: number;
  hazardRing: OrbitForgeRing;
  shardRing: OrbitForgeRing | null;
};

export type OrbitForgeCourseConfig = {
  ringCount: number;
  worldWidth: number;
  worldHeight: number;
  coreRadius: number;
  ringRadii: [number, number];
  playerRadius: number;
  tickMs: number;
  maxTicks: number;
  angularSpeed: number;
  phaseWindowTicks: number;
  spawnStreamVersion: string;
  events: OrbitForgeEvent[];
};

export type OrbitForgeSessionPayload = {
  course: OrbitForgeCourseConfig;
};

export type OrbitForgeSessionConfig = GameSessionConfig<OrbitForgeSessionPayload>;

export type OrbitForgePhaseWindow = {
  startTick: number;
  endTick: number;
};

export type OrbitForgeSubmissionPayload = {
  swapTicks: number[];
  phaseWindows: OrbitForgePhaseWindow[];
};

export type OrbitForgeReplayPayload = GameSubmissionPayload<OrbitForgeSubmissionPayload>;

export type OrbitForgeResultSummary = {
  gatesCleared: number;
  shardsCollected: number;
  survivedMs: number;
  collisionTick: number | null;
};

export type OfficialOrbitForgeResult = OfficialGameResult<OrbitForgeResultSummary>;

export type OrbitForgeState = {
  tick: number;
  ring: OrbitForgeRing;
  angle: number;
  gatesCleared: number;
  shardsCollected: number;
  nextEventIndex: number;
  collided: boolean;
  collisionTick: number | null;
  phaseActive: boolean;
};
