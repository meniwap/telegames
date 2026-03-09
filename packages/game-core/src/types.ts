export type LeaderboardWindow = "daily" | "weekly" | "all_time";

export type RewardGrant = {
  entryType: "xp" | "coins";
  amount: number;
  sourceType: "game_result";
  sourceId: string;
};

export type GameDefinition = {
  id: string;
  slug: string;
  name: string;
  status: "live" | "coming_soon";
  tagline: string;
  description: string;
  coverLabel: string;
};

export type GameSessionStatus = "created" | "submitted" | "accepted" | "rejected" | "expired";

export type GameSessionConfig<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  sessionId: string;
  gameTitleId: string;
  configVersion: string;
  seed: number;
  createdAt: string;
  expiresAt: string;
  payload: TPayload;
};

export type GameClientSummary = {
  elapsedMs: number;
  reportedPlacement?: number | null;
  reportedDisplayValue?: string | null;
  reportedScoreSortValue?: number | null;
};

export type GameSubmissionPayload<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  sessionId: string;
  configVersion: string;
  payload: TPayload;
  clientSummary: GameClientSummary;
};

export type OfficialGameResult<TSummary extends Record<string, unknown> = Record<string, unknown>> = {
  sessionId: string;
  gameTitleId: string;
  status: "accepted" | "rejected";
  placement: number | null;
  scoreSortValue: number;
  displayValue: string;
  elapsedMs: number;
  rewards: RewardGrant[];
  flags: string[];
  rejectedReason?: string;
  resultSummary: TSummary;
};

export type GamePlayerStat = {
  label: string;
  value: string;
  hint: string;
};

export type GameOpsSlice = {
  stats: GamePlayerStat[];
  recentFlags: Array<{
    id: string;
    label: string;
    hint: string;
  }>;
};

export type GameModuleServerContract<
  TSessionPayload extends Record<string, unknown> = Record<string, unknown>,
  TSubmissionPayload extends Record<string, unknown> = Record<string, unknown>,
  TResultSummary extends Record<string, unknown> = Record<string, unknown>
> = {
  definition: GameDefinition;
  createSessionConfig: (sessionId: string, seed: number) => GameSessionConfig<TSessionPayload>;
  parseSubmissionPayload: (body: unknown) => GameSubmissionPayload<TSubmissionPayload>;
  verifySubmission: (
    config: GameSessionConfig<TSessionPayload>,
    submission: GameSubmissionPayload<TSubmissionPayload>
  ) => OfficialGameResult<TResultSummary>;
};
