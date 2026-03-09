import type { GameSessionConfig, GameSubmissionPayload, OfficialGameResult } from "@telegramplay/game-core";

export type MemoryCard = {
  id: number;
  pairId: number;
  symbol: string;
};

export type MemoryBoardConfig = {
  gridSize: number;
  cards: MemoryCard[];
  expectedMsRange: { min: number; max: number };
};

export type MemorySessionPayload = {
  board: MemoryBoardConfig;
};

export type MemorySessionConfig = GameSessionConfig<MemorySessionPayload>;

export type MemoryFlipAction = {
  cardIndex: number;
  timestampMs: number;
};

export type MemorySubmissionPayload = {
  flips: MemoryFlipAction[];
};

export type MemoryReplayPayload = GameSubmissionPayload<MemorySubmissionPayload>;

export type MemoryResultSummary = {
  totalMoves: number;
  officialTimeMs: number;
  pairsFound: number;
};

export type OfficialMemoryResult = OfficialGameResult<MemoryResultSummary>;
