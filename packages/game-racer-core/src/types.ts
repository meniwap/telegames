import type { GameSessionConfig, GameSubmissionPayload, OfficialGameResult } from "@telegramplay/game-core";

export type Vector2 = {
  x: number;
  y: number;
};

export type TrackWaypoint = Vector2;

export type RaceTrackSnapshot = {
  id: string;
  slug: string;
  name: string;
  version: string;
  laps: number;
  width: number;
  expectedMsRange: {
    min: number;
    max: number;
  };
  startPositions: Array<{
    x: number;
    y: number;
    angle: number;
  }>;
  waypoints: TrackWaypoint[];
};

export type CarPreset = {
  id: string;
  label: string;
  acceleration: number;
  braking: number;
  drag: number;
  offTrackDrag: number;
  turnRate: number;
  maxSpeed: number;
  driftTurnBonus: number;
};

export type CpuProfile = {
  id: string;
  label: string;
  aggression: number;
  precision: number;
  preferredSpeedRatio: number;
};

export type RacerSessionPayload = {
  track: RaceTrackSnapshot;
  trackId: string;
  carPreset: CarPreset;
  cpuProfiles: CpuProfile[];
};

export type RacerSessionConfig = GameSessionConfig<RacerSessionPayload>;

export type RacerKind = "player" | "cpu";

export type RacerState = {
  id: string;
  displayName: string;
  kind: RacerKind;
  x: number;
  y: number;
  angle: number;
  speed: number;
  startDistanceBias: number;
  awaitingLaunchCross: boolean;
  completedLaps: number;
  progressDistance: number;
  trackDistance: number;
  finishedAtMs: number | null;
  place: number | null;
  offTrack: boolean;
  boostHeat: number;
  boostFramesLeft: number;
};

export type RaceState = {
  sessionId: string;
  elapsedMs: number;
  finished: boolean;
  playerFinished: boolean;
  racers: RacerState[];
};

export type InputFrame = {
  frame: number;
  input: number;
};

export type RacerReplayPayload = GameSubmissionPayload<{
  frames: number[];
}>;

export type RacerResultSummary = {
  officialTimeMs: number;
  finishers: Array<{
    racerId: string;
    displayName: string;
    placement: number;
    finishedAtMs: number;
  }>;
};

export type OfficialRacerResult = OfficialGameResult<RacerResultSummary>;
