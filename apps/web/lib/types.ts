import type {
  GamePlayerStat,
  GameSessionConfig,
  GameSessionStatus,
  GameSubmissionPayload,
  LeaderboardWindow,
  OfficialGameResult
} from "@telegramplay/game-core";

export type PlayerRecord = {
  id: string;
  telegramUserId: string;
  usernameSnapshot: string | null;
  displayNameSnapshot: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  totalXp: number;
  totalCoins: number;
  level: number;
};

export type AuthSessionRecord = {
  id: string;
  playerId: string;
  sessionTokenHash: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
};

export type PlayerContext = {
  player: PlayerRecord;
  isAdmin: boolean;
  session: AuthSessionRecord;
};

export type GameCatalogEntry = {
  id: string;
  slug: string;
  name: string;
  status: "live" | "coming_soon";
  tagline: string;
  description: string;
  coverLabel: string;
};

export type GameProfileRecord = {
  playerId: string;
  gameTitleId: string;
  gameSlug: string;
  gameName: string;
  xp: number;
  level: number;
  createdAt: string;
  updatedAt: string;
};

export type RacerPlayerStatsRecord = {
  playerId: string;
  gameTitleId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  bestScoreSortValue: number | null;
  bestDisplayValue: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoryPlayerStatsRecord = {
  playerId: string;
  gameTitleId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  bestScoreSortValue: number | null;
  bestDisplayValue: string | null;
  bestMoves: number | null;
  bestTimeMs: number | null;
  createdAt: string;
  updatedAt: string;
};

export type HopperPlayerStatsRecord = {
  playerId: string;
  gameTitleId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  bestScoreSortValue: number | null;
  bestDisplayValue: string | null;
  bestGates: number | null;
  bestSurvivalMs: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SignalStackerPlayerStatsRecord = {
  playerId: string;
  gameTitleId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  bestScoreSortValue: number | null;
  bestDisplayValue: string | null;
  bestFloors: number | null;
  bestPerfectDrops: number | null;
  createdAt: string;
  updatedAt: string;
};

export type VectorShiftPlayerStatsRecord = {
  playerId: string;
  gameTitleId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  bestScoreSortValue: number | null;
  bestDisplayValue: string | null;
  bestSectors: number | null;
  bestCharges: number | null;
  createdAt: string;
  updatedAt: string;
};

export type OrbitForgePlayerStatsRecord = {
  playerId: string;
  gameTitleId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  bestScoreSortValue: number | null;
  bestDisplayValue: string | null;
  bestGates: number | null;
  bestShards: number | null;
  bestSurvivalMs: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PrismBreakPlayerStatsRecord = {
  playerId: string;
  gameTitleId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  bestScoreSortValue: number | null;
  bestDisplayValue: string | null;
  bestPrisms: number | null;
  bestChainBursts: number | null;
  bestSurvivalMs: number | null;
  createdAt: string;
  updatedAt: string;
};

export type WalletRecord = {
  playerId: string;
  coins: number;
};

export type WalletLedgerEntry = {
  id: string;
  playerId: string;
  entryType: "xp" | "coins";
  amount: number;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};

export type GameSessionRecord = {
  id: string;
  playerId: string;
  gameTitleId: string;
  gameSlug: string;
  configVersion: string;
  seed: number;
  config: GameSessionConfig;
  status: GameSessionStatus;
  expiresAt: string;
  createdAt: string;
  submittedAt: string | null;
  resultId: string | null;
};

export type GameSubmissionRecord = {
  sessionId: string;
  payload: GameSubmissionPayload;
  createdAt: string;
};

export type GameResultRecord = OfficialGameResult & {
  id: string;
  playerId: string;
  createdAt: string;
};

export type LeaderboardEntry = {
  placement: number;
  playerId: string;
  displayName: string;
  scoreSortValue: number;
  displayValue: string;
  level: number;
  totalCoins: number;
};

export type ClientErrorRecord = {
  id: string;
  playerId: string | null;
  route: string;
  message: string;
  stack: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AuditEventRecord = {
  id: string;
  playerId: string | null;
  sessionId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type CheatFlagRecord = {
  id: string;
  playerId: string;
  sessionId: string;
  gameTitleId: string;
  flag: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AnalyticsRollup = {
  dateKey: string;
  gameTitleId: string;
  newPlayers: number;
  dau: number;
  wau: number;
  sessionStarts: number;
  sessionFinishes: number;
  rewardsGranted: number;
  suspiciousRuns: number;
  rejectedSubmissions: number;
  clientErrors: number;
};

export type BootstrapPayload = {
  appName: string;
  themeId: string;
  deploymentVersion: string;
  commitSha: string;
  player: PlayerRecord | null;
  wallet: WalletRecord | null;
  isAdmin: boolean;
  catalog: GameCatalogEntry[];
  gameProfiles: GameProfileRecord[];
  featuredGameSlug: string | null;
};

export type ProfilePayload = {
  player: PlayerRecord;
  wallet: WalletRecord;
  gameProfiles: GameProfileRecord[];
  selectedGameSlug: string | null;
  selectedGameStats: GamePlayerStat[];
  recentLedger: WalletLedgerEntry[];
};

export type LeaderboardPayload = {
  gameTitleId: string;
  gameSlug: string;
  window: LeaderboardWindow;
  entries: LeaderboardEntry[];
};

export type OpsDashboardPayload = {
  filters: {
    selectedGameSlug: string | null;
    games: Array<{
      slug: string;
      name: string;
    }>;
  };
  kpis: Array<{ label: string; value: string; hint: string }>;
  topPlayers: LeaderboardEntry[];
  recentSessions: GameSessionRecord[];
  suspiciousRuns: CheatFlagRecord[];
  clientErrors: ClientErrorRecord[];
  gameStats: GamePlayerStat[];
};

export type TelegramIdentity = {
  telegramUserId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  authDate: number;
};
