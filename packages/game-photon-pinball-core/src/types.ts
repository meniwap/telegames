import type { GameSessionConfig, GameSubmissionPayload, OfficialGameResult } from "@telegramplay/game-core";

export type PhotonPinballBumper = {
  id: string;
  x: number;
  y: number;
  radius: number;
  score: number;
};

export type PhotonPinballTarget = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
};

export type PhotonPinballTableConfig = {
  tableVersion: string;
  physicsVersion: string;
  worldWidth: number;
  worldHeight: number;
  ballCount: number;
  ballRadius: number;
  gravity: number;
  baseBallSpeed: number;
  maxTicks: number;
  flipperWindowTicks: number;
  nudgeMaxTicks: number;
  bumperLayout: PhotonPinballBumper[];
  targetLayout: PhotonPinballTarget[];
};

export type PhotonPinballSessionPayload = {
  table: PhotonPinballTableConfig;
};

export type PhotonPinballSessionConfig = GameSessionConfig<PhotonPinballSessionPayload>;

export type PhotonPinballNudgeWindow = {
  startTick: number;
  endTick: number;
};

export type PhotonPinballSubmissionPayload = {
  leftFlipTicks: number[];
  rightFlipTicks: number[];
  nudgeWindows: PhotonPinballNudgeWindow[];
};

export type PhotonPinballReplayPayload = GameSubmissionPayload<PhotonPinballSubmissionPayload>;

export type PhotonPinballResultSummary = {
  score: number;
  jackpotsClaimed: number;
  comboPeak: number;
  ballsDrained: number;
  survivedMs: number;
  finishReason: "balls_drained" | "max_ticks" | null;
};

export type OfficialPhotonPinballResult = OfficialGameResult<PhotonPinballResultSummary>;

export type PhotonPinballState = {
  tick: number;
  ballsRemaining: number;
  ballsDrained: number;
  ballActive: boolean;
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  serveTicks: number;
  score: number;
  jackpotsClaimed: number;
  comboCurrent: number;
  comboPeak: number;
  comboTicksRemaining: number;
  targetStates: Array<{
    id: string;
    lit: boolean;
  }>;
  bumperFlashTicks: number[];
  targetFlashTicks: number[];
  leftFlipTicksRemaining: number;
  rightFlipTicksRemaining: number;
  nudgeTicksRemaining: number;
  lastEventLabel: string | null;
  lastEventPoints: number;
  lastEventTicks: number;
  finishReason: "balls_drained" | "max_ticks" | null;
};
