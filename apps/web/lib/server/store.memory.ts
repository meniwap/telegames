import type { GameSessionConfig, GameSubmissionPayload, LeaderboardWindow, OfficialGameResult } from "@telegramplay/game-core";
import { createRequestLogger } from "@telegramplay/telemetry";

import { createRecordId } from "../auth/session";
import { getEnv } from "../env";
import type {
  AuditEventRecord,
  BootstrapPayload,
  CheatFlagRecord,
  ClientErrorRecord,
  GameCatalogEntry,
  GameProfileRecord,
  GameResultRecord,
  GameSessionRecord,
  GameSubmissionRecord,
  LeaderboardEntry,
  LeaderboardPayload,
  OpsDashboardPayload,
  PlayerContext,
  PlayerRecord,
  ProfilePayload,
  RacerPlayerStatsRecord,
  TelegramIdentity,
  WalletLedgerEntry,
  WalletRecord
} from "../types";

type GameProfileState = {
  playerId: string;
  gameTitleId: string;
  xp: number;
  level: number;
  createdAt: string;
  updatedAt: string;
};

type RacerPlayerStatsState = {
  playerId: string;
  gameTitleId: string;
  sessionsStarted: number;
  sessionsCompleted: number;
  bestScoreSortValue: number | null;
  bestDisplayValue: string | null;
  createdAt: string;
  updatedAt: string;
};

type MemoryState = {
  players: PlayerRecord[];
  sessions: Array<{
    id: string;
    playerId: string;
    sessionTokenHash: string;
    expiresAt: string;
    createdAt: string;
    lastSeenAt: string;
  }>;
  gameProfiles: GameProfileState[];
  wallets: WalletRecord[];
  ledger: WalletLedgerEntry[];
  gameSessions: GameSessionRecord[];
  gameSubmissions: GameSubmissionRecord[];
  gameResults: GameResultRecord[];
  racerPlayerStats: RacerPlayerStatsState[];
  cheatFlags: CheatFlagRecord[];
  auditEvents: AuditEventRecord[];
  clientErrors: ClientErrorRecord[];
  catalog: GameCatalogEntry[];
};

declare global {
  var __telegramplayMemoryState: MemoryState | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function getLevel(totalXp: number) {
  return Math.floor(totalXp / 250) + 1;
}

function ensureMemoryState(): MemoryState {
  if (!global.__telegramplayMemoryState) {
    global.__telegramplayMemoryState = {
      players: [],
      sessions: [],
      gameProfiles: [],
      wallets: [],
      ledger: [],
      gameSessions: [],
      gameSubmissions: [],
      gameResults: [],
      racerPlayerStats: [],
      cheatFlags: [],
      auditEvents: [],
      clientErrors: [],
      catalog: [
        {
          id: "racer-poc",
          slug: "racer-poc",
          name: "Blockshift Circuit",
          status: "live",
          tagline: "A premium single-player toy-racer sprint inside Telegram.",
          description:
            "Tilted top-down voxel-inspired arcade racing with official server-validated placements, XP, coins, and leaderboard flow.",
          coverLabel: "Premium POC"
        }
      ]
    };
  }

  return global.__telegramplayMemoryState;
}

function ensureCatalogProfile(state: MemoryState, playerId: string, gameTitleId: string) {
  const existing = state.gameProfiles.find((profile) => profile.playerId === playerId && profile.gameTitleId === gameTitleId);
  if (existing) {
    return existing;
  }

  const created: GameProfileState = {
    playerId,
    gameTitleId,
    xp: 0,
    level: 1,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.gameProfiles.push(created);
  return created;
}

function findOrCreateWallet(state: MemoryState, playerId: string): WalletRecord {
  const existing = state.wallets.find((wallet) => wallet.playerId === playerId);
  if (existing) {
    return existing;
  }

  const wallet: WalletRecord = {
    playerId,
    coins: 0
  };
  state.wallets.push(wallet);
  return wallet;
}

function findOrCreateRacerStats(state: MemoryState, playerId: string, gameTitleId: string) {
  const existing = state.racerPlayerStats.find((stats) => stats.playerId === playerId && stats.gameTitleId === gameTitleId);
  if (existing) {
    return existing;
  }

  const created: RacerPlayerStatsState = {
    playerId,
    gameTitleId,
    sessionsStarted: 0,
    sessionsCompleted: 0,
    bestScoreSortValue: null,
    bestDisplayValue: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.racerPlayerStats.push(created);
  return created;
}

function buildPlayerContext(state: MemoryState, sessionTokenHash: string): PlayerContext | null {
  const session = state.sessions.find((candidate) => candidate.sessionTokenHash === sessionTokenHash);
  if (!session) {
    return null;
  }

  const player = state.players.find((candidate) => candidate.id === session.playerId);
  if (!player) {
    return null;
  }

  const env = getEnv();
  const isAdmin = env.OPS_ADMIN_TELEGRAM_IDS.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(player.telegramUserId);

  session.lastSeenAt = nowIso();
  player.lastSeenAt = nowIso();

  return {
    player,
    isAdmin,
    session
  };
}

function buildGameProfileRecord(state: MemoryState, profile: GameProfileState): GameProfileRecord {
  const catalogEntry = state.catalog.find((game) => game.id === profile.gameTitleId)!;

  return {
    playerId: profile.playerId,
    gameTitleId: profile.gameTitleId,
    gameSlug: catalogEntry.slug,
    gameName: catalogEntry.name,
    xp: profile.xp,
    level: profile.level,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function buildGameProfileState(state: MemoryState, playerId: string, gameSlug: string): RacerPlayerStatsRecord | null {
  const catalogEntry = state.catalog.find((game) => game.slug === gameSlug);
  if (!catalogEntry || gameSlug !== "racer-poc") {
    return null;
  }

  const racerStats = state.racerPlayerStats.find((stats) => stats.playerId === playerId && stats.gameTitleId === catalogEntry.id);

  if (!racerStats) {
    return null;
  }

  return {
    ...racerStats
  };
}

function getLeaderboardEntries(state: MemoryState, gameSlug: string, window: LeaderboardWindow): LeaderboardEntry[] {
  const catalogEntry = state.catalog.find((game) => game.slug === gameSlug);
  if (!catalogEntry) {
    return [];
  }

  const now = Date.now();
  const threshold =
    window === "daily" ? now - 86400000 : window === "weekly" ? now - 86400000 * 7 : Number.NEGATIVE_INFINITY;

  const bestByPlayer = new Map<string, GameResultRecord>();

  state.gameResults
    .filter((result) => result.gameTitleId === catalogEntry.id)
    .filter((result) => result.status === "accepted")
    .filter((result) => new Date(result.createdAt).getTime() >= threshold)
    .forEach((result) => {
      const existing = bestByPlayer.get(result.playerId);
      if (!existing || result.scoreSortValue < existing.scoreSortValue) {
        bestByPlayer.set(result.playerId, result);
      }
    });

  return [...bestByPlayer.values()]
    .sort((left, right) => left.scoreSortValue - right.scoreSortValue)
    .map((result, index) => {
      const player = state.players.find((candidate) => candidate.id === result.playerId)!;
      return {
        placement: index + 1,
        playerId: player.id,
        displayName: player.displayNameSnapshot,
        scoreSortValue: result.scoreSortValue,
        displayValue: result.displayValue,
        level: player.level,
        totalCoins: player.totalCoins
      };
    });
}

export function createMemoryStore() {
  const logger = createRequestLogger({ route: "store.memory" });

  return {
    async upsertTelegramIdentity(identity: TelegramIdentity, sessionTokenHash: string) {
      const state = ensureMemoryState();
      const now = nowIso();
      let player = state.players.find((candidate) => candidate.telegramUserId === identity.telegramUserId);

      if (!player) {
        player = {
          id: createRecordId("player"),
          telegramUserId: identity.telegramUserId,
          usernameSnapshot: identity.username,
          displayNameSnapshot: identity.displayName,
          avatarUrl: identity.avatarUrl,
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
          totalXp: 0,
          totalCoins: 0,
          level: 1
        };
        state.players.push(player);
      } else {
        player.usernameSnapshot = identity.username;
        player.displayNameSnapshot = identity.displayName;
        player.avatarUrl = identity.avatarUrl;
        player.updatedAt = now;
        player.lastSeenAt = now;
      }

      state.catalog.forEach((game) => {
        ensureCatalogProfile(state, player.id, game.id);
        if (game.slug === "racer-poc") {
          findOrCreateRacerStats(state, player.id, game.id);
        }
      });
      findOrCreateWallet(state, player.id);

      const session = {
        id: createRecordId("sess"),
        playerId: player.id,
        sessionTokenHash,
        expiresAt: new Date(Date.now() + getEnv().SESSION_TTL_HOURS * 3600000).toISOString(),
        createdAt: now,
        lastSeenAt: now
      };
      state.sessions.push(session);
      logger.info({ playerId: player.id }, "telegram auth session created");

      return buildPlayerContext(state, sessionTokenHash)!;
    },

    async getPlayerContextBySessionHash(sessionTokenHash: string) {
      return buildPlayerContext(ensureMemoryState(), sessionTokenHash);
    },

    async getBootstrapPayload(playerId: string | null): Promise<BootstrapPayload> {
      const state = ensureMemoryState();
      const player = playerId ? state.players.find((candidate) => candidate.id === playerId) ?? null : null;
      const wallet = player ? findOrCreateWallet(state, player.id) : null;
      const env = getEnv();
      const gameProfiles = player
        ? state.catalog.map((game) => buildGameProfileRecord(state, ensureCatalogProfile(state, player.id, game.id)))
        : [];

      return {
        appName: env.APP_NAME,
        themeId: env.NEXT_PUBLIC_APP_THEME,
        deploymentVersion: env.DEPLOYMENT_VERSION,
        commitSha: env.VERCEL_GIT_COMMIT_SHA,
        player,
        wallet,
        isAdmin: Boolean(player && env.OPS_ADMIN_TELEGRAM_IDS.includes(player.telegramUserId)),
        catalog: state.catalog,
        gameProfiles,
        featuredGameSlug: state.catalog[0]?.slug ?? null
      };
    },

    async getCatalogEntries() {
      return ensureMemoryState().catalog;
    },

    async getCatalogEntryBySlug(gameSlug: string) {
      return ensureMemoryState().catalog.find((candidate) => candidate.slug === gameSlug) ?? null;
    },

    async getProfilePayload(playerId: string): Promise<ProfilePayload> {
      const state = ensureMemoryState();
      const player = state.players.find((candidate) => candidate.id === playerId)!;
      const wallet = findOrCreateWallet(state, playerId);
      const gameProfiles = state.catalog.map((game) => buildGameProfileRecord(state, ensureCatalogProfile(state, playerId, game.id)));
      const recentLedger = state.ledger.filter((entry) => entry.playerId === playerId).slice(-10).reverse();

      return { player, wallet, gameProfiles, selectedGameSlug: null, selectedGameStats: [], recentLedger };
    },

    async getGameProfileState(playerId: string, gameSlug: string) {
      const state = ensureMemoryState();
      return buildGameProfileState(state, playerId, gameSlug);
    },

    async createGameSession(playerId: string, config: GameSessionConfig) {
      const state = ensureMemoryState();
      const catalogEntry = state.catalog.find((game) => game.id === config.gameTitleId);
      if (!catalogEntry) {
        throw new Error("game_not_found");
      }

      const session: GameSessionRecord = {
        id: config.sessionId,
        playerId,
        gameTitleId: config.gameTitleId,
        gameSlug: catalogEntry.slug,
        configVersion: config.configVersion,
        seed: config.seed,
        config,
        status: "created",
        expiresAt: config.expiresAt,
        createdAt: config.createdAt,
        submittedAt: null,
        resultId: null
      };
      state.gameSessions.push(session);

      if (catalogEntry.slug === "racer-poc") {
        const stats = findOrCreateRacerStats(state, playerId, config.gameTitleId);
        stats.sessionsStarted += 1;
        stats.updatedAt = nowIso();
      }

      state.auditEvents.push({
        id: createRecordId("audit"),
        playerId,
        sessionId: session.id,
        eventType: "game_session_created",
        payload: {
          gameTitleId: session.gameTitleId,
          gameSlug: session.gameSlug,
          configVersion: session.configVersion
        },
        createdAt: nowIso()
      });

      return session;
    },

    async getGameSessionById(sessionId: string) {
      return ensureMemoryState().gameSessions.find((session) => session.id === sessionId) ?? null;
    },

    async finalizeGameSession(
      playerId: string,
      session: GameSessionRecord,
      payload: GameSubmissionPayload,
      result: OfficialGameResult
    ): Promise<GameResultRecord> {
      const state = ensureMemoryState();
      const existingResult = state.gameResults.find((candidate) => candidate.sessionId === session.id);
      if (existingResult) {
        return existingResult;
      }

      if (new Date(session.expiresAt).getTime() < Date.now()) {
        throw new Error("session_expired");
      }

      session.status = result.status;
      session.submittedAt = nowIso();
      state.gameSubmissions.push({
        sessionId: session.id,
        payload,
        createdAt: nowIso()
      });
      state.auditEvents.push({
        id: createRecordId("audit"),
        playerId,
        sessionId: session.id,
        eventType: "game_submission_received",
        payload: {
          gameTitleId: session.gameTitleId,
          gameSlug: session.gameSlug
        },
        createdAt: nowIso()
      });

      const gameResult: GameResultRecord = {
        ...result,
        id: createRecordId("result"),
        playerId,
        createdAt: nowIso()
      };
      state.gameResults.push(gameResult);
      session.resultId = gameResult.id;

      const profile = ensureCatalogProfile(state, playerId, session.gameTitleId);
      const player = state.players.find((candidate) => candidate.id === playerId)!;
      const wallet = findOrCreateWallet(state, playerId);

      if (result.status === "accepted") {
        profile.xp += result.rewards.find((reward) => reward.entryType === "xp")?.amount ?? 0;
        profile.level = getLevel(profile.xp);
        profile.updatedAt = nowIso();

        result.rewards.forEach((reward) => {
          state.ledger.push({
            id: createRecordId("ledger"),
            playerId,
            entryType: reward.entryType,
            amount: reward.amount,
            sourceType: reward.sourceType,
            sourceId: reward.sourceId,
            createdAt: nowIso()
          });

          if (reward.entryType === "xp") {
            player.totalXp += reward.amount;
          }

          if (reward.entryType === "coins") {
            player.totalCoins += reward.amount;
            wallet.coins += reward.amount;
          }
        });

        player.level = getLevel(player.totalXp);

        if (session.gameSlug === "racer-poc") {
          const stats = findOrCreateRacerStats(state, playerId, session.gameTitleId);
          stats.sessionsCompleted += 1;
          if (stats.bestScoreSortValue === null || result.scoreSortValue < stats.bestScoreSortValue) {
            stats.bestScoreSortValue = result.scoreSortValue;
            stats.bestDisplayValue = result.displayValue;
          }
          stats.updatedAt = nowIso();
        }
      }

      result.flags.forEach((flag) => {
        state.cheatFlags.push({
          id: createRecordId("flag"),
          playerId,
          sessionId: session.id,
          gameTitleId: session.gameTitleId,
          flag,
          payload: {
            resultStatus: result.status
          },
          createdAt: nowIso()
        });
      });

      state.auditEvents.push({
        id: createRecordId("audit"),
        playerId,
        sessionId: session.id,
        eventType: "game_result_finalized",
        payload: {
          gameTitleId: session.gameTitleId,
          gameSlug: session.gameSlug,
          status: result.status,
          placement: result.placement,
          scoreSortValue: result.scoreSortValue
        },
        createdAt: nowIso()
      });

      logger.info({ playerId, gameSessionId: session.id, status: result.status }, "game session finalized");
      return gameResult;
    },

    async getLeaderboardPayload(gameSlug: string, window: LeaderboardWindow): Promise<LeaderboardPayload> {
      const state = ensureMemoryState();
      const game = state.catalog.find((candidate) => candidate.slug === gameSlug);
      if (!game) {
        throw new Error("game_not_found");
      }

      return {
        gameTitleId: game.id,
        gameSlug,
        window,
        entries: getLeaderboardEntries(state, gameSlug, window)
      };
    },

    async getOpsDashboardPayload(gameSlug: string | null): Promise<OpsDashboardPayload> {
      const state = ensureMemoryState();
      const selectedGameSlug = gameSlug ?? state.catalog[0]?.slug ?? null;
      const filteredSessions = selectedGameSlug
        ? state.gameSessions.filter((session) => session.gameSlug === selectedGameSlug)
        : state.gameSessions;
      const filteredResults = state.gameResults.filter(
        (result) => result.status === "accepted" && (!selectedGameSlug || state.gameSessions.find((session) => session.id === result.sessionId)?.gameSlug === selectedGameSlug)
      );
      const topPlayers = selectedGameSlug ? getLeaderboardEntries(state, selectedGameSlug, "all_time") : [];
      const completionRate = filteredSessions.length === 0 ? 0 : Math.round((filteredResults.length / filteredSessions.length) * 100);
      const avgDuration =
        filteredResults.length === 0
          ? "0.00s"
          : `${(filteredResults.reduce((sum, result) => sum + result.elapsedMs, 0) / filteredResults.length / 1000).toFixed(2)}s`;

      return {
        filters: {
          selectedGameSlug,
          games: state.catalog.map((game) => ({
            slug: game.slug,
            name: game.name
          }))
        },
        kpis: [
          { label: "Total Players", value: String(state.players.length), hint: "All Telegram identities seen" },
          { label: "New Players Today", value: String(state.players.length), hint: "Memory store demo value" },
          { label: "DAU / WAU", value: `${state.players.length} / ${state.players.length}`, hint: "Memory store demo value" },
          { label: "Session Starts", value: String(filteredSessions.length), hint: selectedGameSlug ? `Official starts for ${selectedGameSlug}` : "Official sessions created" },
          { label: "Accepted Results", value: String(filteredResults.length), hint: `${completionRate}% completion` },
          { label: "Average Duration", value: avgDuration, hint: "Accepted official runs" },
          {
            label: "Rewards Granted",
            value: String(
              state.ledger.reduce((sum, entry) => sum + (entry.entryType === "coins" ? entry.amount : 0), 0)
            ),
            hint: "Coins issued"
          },
          { label: "Suspicious Runs", value: String(state.cheatFlags.length), hint: "Flagged official submissions" },
          { label: "Rejected Results", value: String(state.gameResults.filter((result) => result.status === "rejected").length), hint: "Server rejected submissions" },
          { label: "Client Errors", value: String(state.clientErrors.length), hint: "Reported by Mini App" }
        ],
        topPlayers: topPlayers.slice(0, 8),
        recentSessions: filteredSessions.slice(-8).reverse(),
        suspiciousRuns: state.cheatFlags
          .filter((flag) => !selectedGameSlug || state.catalog.find((game) => game.id === flag.gameTitleId)?.slug === selectedGameSlug)
          .slice(-8)
          .reverse(),
        clientErrors: state.clientErrors.slice(-8).reverse(),
        gameStats: []
      };
    },

    async reportClientError(
      playerId: string | null,
      payload: Omit<ClientErrorRecord, "id" | "createdAt" | "playerId">
    ) {
      const state = ensureMemoryState();
      state.clientErrors.push({
        id: createRecordId("cerr"),
        playerId,
        createdAt: nowIso(),
        ...payload
      });
    },

    async appendAuditEvent(event: Omit<AuditEventRecord, "id" | "createdAt">) {
      ensureMemoryState().auditEvents.push({
        id: createRecordId("audit"),
        createdAt: nowIso(),
        ...event
      });
    }
  };
}
