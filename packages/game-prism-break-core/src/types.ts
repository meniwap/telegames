import type { GameSessionConfig, GameSubmissionPayload, OfficialGameResult } from "@telegramplay/game-core";

export type PrismBreakLane = 0 | 1 | 2;
export type PrismKind = 0 | 1 | 2;

export type PrismTile = {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: PrismKind;
};

export type PrismBreakWaveConfig = {
  waveVersion: string;
  laneCount: number;
  worldWidth: number;
  worldHeight: number;
  paddleY: number;
  paddleWidth: number;
  paddleHeight: number;
  ballRadius: number;
  baseBallSpeed: number;
  rampCurve: number;
  maxTicks: number;
  magnetMaxTicks: number;
  launchLane: PrismBreakLane;
  initialWave: PrismTile[];
};

export type PrismBreakSessionPayload = {
  chamber: PrismBreakWaveConfig;
};

export type PrismBreakSessionConfig = GameSessionConfig<PrismBreakSessionPayload>;

export type PrismBreakDeflectorChange = {
  tick: number;
  lane: PrismBreakLane;
};

export type PrismBreakMagnetWindow = {
  startTick: number;
  endTick: number;
};

export type PrismBreakSubmissionPayload = {
  deflectorChanges: PrismBreakDeflectorChange[];
  magnetWindows: PrismBreakMagnetWindow[];
};

export type PrismBreakReplayPayload = GameSubmissionPayload<PrismBreakSubmissionPayload>;

export type PrismBreakResultSummary = {
  prismsShattered: number;
  chainBursts: number;
  survivedMs: number;
  finishReason: "miss" | "max_ticks" | null;
};

export type OfficialPrismBreakResult = OfficialGameResult<PrismBreakResultSummary>;

export type PrismBreakState = {
  tick: number;
  deflectorLane: PrismBreakLane;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  attached: boolean;
  attachedReason: "serve" | "magnet";
  attachedTicks: number;
  waveIndex: number;
  prisms: PrismTile[];
  prismsShattered: number;
  chainBursts: number;
  burstFlashTicks: number;
  lastBurstSize: number;
  missed: boolean;
  finishReason: "miss" | "max_ticks" | null;
};
