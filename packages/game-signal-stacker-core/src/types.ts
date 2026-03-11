import type { GameSessionConfig, GameSubmissionPayload, OfficialGameResult } from "@telegramplay/game-core";

export type SignalTowerBlock = {
  centerX: number;
  width: number;
  dropTick: number;
  perfect: boolean;
};

export type SignalTowerConfig = {
  worldWidth: number;
  worldHeight: number;
  baseBlockWidth: number;
  blockHeight: number;
  maxDrops: number;
  perfectWindowPx: number;
  minWidthPx: number;
  baseSweepTicks: number;
  speedRampPerLayer: number;
  directionPatternVersion: string;
};

export type SignalStackerSessionPayload = {
  tower: SignalTowerConfig;
};

export type SignalStackerSessionConfig = GameSessionConfig<SignalStackerSessionPayload>;

export type SignalStackerSubmissionPayload = {
  dropTicks: number[];
};

export type SignalStackerReplayPayload = GameSubmissionPayload<SignalStackerSubmissionPayload>;

export type SignalStackerResultSummary = {
  floorsStacked: number;
  perfectDrops: number;
  topWidthPct: number;
  missTick: number | null;
};

export type OfficialSignalStackerResult = OfficialGameResult<SignalStackerResultSummary>;

export type SignalActiveBlock = {
  centerX: number;
  width: number;
  sweepTicks: number;
  travelProgress: number;
};

export type SignalStackerState = {
  tick: number;
  floorsStacked: number;
  perfectDrops: number;
  towerBlocks: SignalTowerBlock[];
  layerStartTick: number;
  missTick: number | null;
  ended: boolean;
  finishReason: "miss" | "max_drops" | "timeout" | null;
};
