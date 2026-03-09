import postgres from "postgres";

import type { GameSessionConfig, GameSubmissionPayload, LeaderboardWindow, OfficialGameResult } from "@telegramplay/game-core";
import { createRequestLogger } from "@telegramplay/telemetry";

import { createSessionToken, hashSessionToken } from "../auth/session";
import { getEnv } from "../env";
import type {
  AuditEventRecord,
  BootstrapPayload,
  ClientErrorRecord,
  GameCatalogEntry,
  GameResultRecord,
  GameSessionRecord,
  LeaderboardPayload,
  OpsDashboardPayload,
  PlayerContext,
  ProfilePayload,
  TelegramIdentity
} from "../types";
import { createMemoryStore } from "./store.memory";
import { createPostgresStore } from "./store.postgres";

export type PlatformStore = {
  upsertTelegramIdentity: (identity: TelegramIdentity, sessionTokenHash: string) => Promise<PlayerContext>;
  getPlayerContextBySessionHash: (sessionTokenHash: string) => Promise<PlayerContext | null>;
  getBootstrapPayload: (playerId: string | null) => Promise<BootstrapPayload>;
  getCatalogEntries: () => Promise<GameCatalogEntry[]>;
  getCatalogEntryBySlug: (gameSlug: string) => Promise<GameCatalogEntry | null>;
  getProfilePayload: (playerId: string) => Promise<ProfilePayload>;
  getGameProfileState: (playerId: string, gameSlug: string) => Promise<unknown>;
  createGameSession: (playerId: string, config: GameSessionConfig) => Promise<GameSessionRecord>;
  getGameSessionById: (sessionId: string) => Promise<GameSessionRecord | null>;
  finalizeGameSession: (
    playerId: string,
    session: GameSessionRecord,
    payload: GameSubmissionPayload,
    result: OfficialGameResult
  ) => Promise<GameResultRecord>;
  getLeaderboardPayload: (gameSlug: string, window: LeaderboardWindow) => Promise<LeaderboardPayload>;
  getOpsDashboardPayload: (gameSlug: string | null) => Promise<OpsDashboardPayload>;
  reportClientError: (
    playerId: string | null,
    payload: Omit<ClientErrorRecord, "id" | "createdAt" | "playerId">
  ) => Promise<void>;
  appendAuditEvent: (event: Omit<AuditEventRecord, "id" | "createdAt">) => Promise<void>;
};

let cachedStore: PlatformStore | null = null;

export function getPlatformStore(): PlatformStore {
  if (cachedStore) {
    return cachedStore;
  }

  const env = getEnv();

  if (env.DATABASE_URL && !env.USE_MEMORY_STORE) {
    const sql = postgres(env.DATABASE_URL, {
      max: 3,
      // Supabase recommends transaction pooling for serverless workloads.
      // That mode does not support prepared statements.
      prepare: false
    });
    cachedStore = createPostgresStore(sql);
  } else {
    cachedStore = createMemoryStore();
  }

  createRequestLogger({ route: "store.bootstrap" }).info(
    { mode: env.DATABASE_URL && !env.USE_MEMORY_STORE ? "postgres" : "memory" },
    "platform store selected"
  );

  return cachedStore;
}

export async function authenticateTelegram(initDataIdentity: TelegramIdentity) {
  const store = getPlatformStore();
  const sessionToken = createSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);
  const context = await store.upsertTelegramIdentity(initDataIdentity, sessionTokenHash);

  return {
    ...context,
    sessionToken
  };
}

export async function getPlayerContextFromToken(token: string | null): Promise<PlayerContext | null> {
  if (!token) {
    return null;
  }

  return getPlatformStore().getPlayerContextBySessionHash(hashSessionToken(token));
}

export async function getBootstrapPayload(playerContext: PlayerContext | null): Promise<BootstrapPayload> {
  return getPlatformStore().getBootstrapPayload(playerContext?.player.id ?? null);
}

export async function getCatalogPayload(): Promise<GameCatalogEntry[]> {
  return getPlatformStore().getCatalogEntries();
}

export async function getCatalogEntryBySlug(gameSlug: string): Promise<GameCatalogEntry | null> {
  return getPlatformStore().getCatalogEntryBySlug(gameSlug);
}

export async function getProfileBasePayload(playerContext: PlayerContext | null): Promise<ProfilePayload | null> {
  if (!playerContext) {
    return null;
  }

  return getPlatformStore().getProfilePayload(playerContext.player.id);
}

export async function createGameSessionRecord(playerId: string, config: GameSessionConfig) {
  return getPlatformStore().createGameSession(playerId, config);
}

export async function getGameProfileStateRecord(playerId: string, gameSlug: string) {
  return getPlatformStore().getGameProfileState(playerId, gameSlug);
}

export async function getGameSessionRecord(sessionId: string) {
  return getPlatformStore().getGameSessionById(sessionId);
}

export async function finalizeGameSessionRecord(
  playerId: string,
  session: GameSessionRecord,
  payload: GameSubmissionPayload,
  result: OfficialGameResult
) {
  return getPlatformStore().finalizeGameSession(playerId, session, payload, result);
}

export async function getLeaderboardPayload(gameSlug: string, window: LeaderboardWindow) {
  return getPlatformStore().getLeaderboardPayload(gameSlug, window);
}

export async function getOpsDashboardBasePayload(playerContext: PlayerContext | null, gameSlug: string | null) {
  if (!playerContext?.isAdmin) {
    throw new Error("forbidden");
  }

  return getPlatformStore().getOpsDashboardPayload(gameSlug);
}

export async function reportClientError(
  playerContext: PlayerContext | null,
  payload: Omit<ClientErrorRecord, "id" | "createdAt" | "playerId">
) {
  return getPlatformStore().reportClientError(playerContext?.player.id ?? null, payload);
}

export async function appendAuditEvent(event: Omit<AuditEventRecord, "id" | "createdAt">) {
  return getPlatformStore().appendAuditEvent(event);
}
