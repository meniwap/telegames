import type { GameSessionConfig, GameSubmissionPayload, OfficialGameResult } from "@telegramplay/game-core";

export type VectorShiftLane = 0 | 1 | 2;

export type VectorShiftRow = {
  tick: number;
  blockedLanes: VectorShiftLane[];
  chargeLane?: VectorShiftLane | null;
};

export type VectorShiftCourseConfig = {
  laneCount: number;
  worldWidth: number;
  worldHeight: number;
  startLane: VectorShiftLane;
  tickMs: number;
  maxTicks: number;
  baseSpeed: number;
  speedRamp: number;
  obstacleStreamVersion: string;
  rows: VectorShiftRow[];
};

export type VectorShiftSessionPayload = {
  course: VectorShiftCourseConfig;
};

export type VectorShiftSessionConfig = GameSessionConfig<VectorShiftSessionPayload>;

export type VectorShiftLaneChange = {
  tick: number;
  targetLane: VectorShiftLane;
};

export type VectorShiftSubmissionPayload = {
  laneChanges: VectorShiftLaneChange[];
};

export type VectorShiftReplayPayload = GameSubmissionPayload<VectorShiftSubmissionPayload>;

export type VectorShiftResultSummary = {
  sectorsCleared: number;
  chargesCollected: number;
  survivedMs: number;
  collisionTick: number | null;
};

export type OfficialVectorShiftResult = OfficialGameResult<VectorShiftResultSummary>;

export type VectorShiftState = {
  tick: number;
  lane: VectorShiftLane;
  sectorsCleared: number;
  chargesCollected: number;
  distance: number;
  nextRowIndex: number;
  collided: boolean;
  collisionTick: number | null;
};
