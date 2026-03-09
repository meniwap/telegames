import type { LeaderboardWindow } from "@telegramplay/game-core";

import { createRecordId } from "../auth/session";
import { getGameModule } from "../games/registry";
import type { PlayerContext, ProfilePayload } from "../types";
import {
  createGameSessionRecord,
  finalizeGameSessionRecord,
  getCatalogEntryBySlug,
  getGameProfileStateRecord,
  getGameSessionRecord,
  getLeaderboardPayload,
  getOpsDashboardBasePayload,
  getProfileBasePayload
} from "./store";

function buildSessionSeed(playerContext: PlayerContext, gameSlug: string) {
  return Math.abs(Math.trunc(Date.now() / 1000) ^ playerContext.player.displayNameSnapshot.length ^ gameSlug.length);
}

export async function getGameDetailPayload(gameSlug: string) {
  const game = await getCatalogEntryBySlug(gameSlug);
  if (!game) {
    throw new Error("game_not_found");
  }

  return game;
}

export async function createGameSessionForPlayer(playerContext: PlayerContext | null, gameSlug: string) {
  if (!playerContext) {
    throw new Error("unauthorized");
  }

  const gameModule = getGameModule(gameSlug);
  const sessionId = createRecordId("game");
  const config = gameModule.createSessionConfig(sessionId, buildSessionSeed(playerContext, gameSlug));
  return createGameSessionRecord(playerContext.player.id, config);
}

export async function submitGameSessionForPlayer(playerContext: PlayerContext | null, gameSlug: string, body: unknown) {
  if (!playerContext) {
    throw new Error("unauthorized");
  }

  const gameModule = getGameModule(gameSlug);
  const payload = gameModule.parseSubmissionPayload(body);
  const gameSession = await getGameSessionRecord(payload.sessionId);

  if (!gameSession || gameSession.playerId !== playerContext.player.id || gameSession.gameSlug !== gameSlug) {
    throw new Error("session_not_found");
  }

  const result = gameModule.verifySubmission(gameSession.config, payload);
  return finalizeGameSessionRecord(playerContext.player.id, gameSession, payload, result);
}

export async function getGameLeaderboardPayload(gameSlug: string, window: LeaderboardWindow) {
  getGameModule(gameSlug);
  return getLeaderboardPayload(gameSlug, window);
}

export async function getProfilePayload(playerContext: PlayerContext | null, selectedGameSlug?: string | null): Promise<ProfilePayload | null> {
  const base = await getProfileBasePayload(playerContext);

  if (!base) {
    return null;
  }

  const resolvedSlug =
    selectedGameSlug ??
    base.gameProfiles[0]?.gameSlug ??
    null;
  const selectedProfile = resolvedSlug ? base.gameProfiles.find((profile) => profile.gameSlug === resolvedSlug) ?? null : null;
  const selectedGameState =
    resolvedSlug ? await getGameProfileStateRecord(base.player.id, resolvedSlug) : null;

  return {
    ...base,
    selectedGameSlug: resolvedSlug,
    selectedGameStats: resolvedSlug ? getGameModule(resolvedSlug).buildProfileStats(selectedProfile, selectedGameState) : []
  };
}

export async function getOpsDashboardPayload(playerContext: PlayerContext | null, selectedGameSlug?: string | null) {
  const payload = await getOpsDashboardBasePayload(playerContext, selectedGameSlug ?? null);
  const resolvedSlug = payload.filters.selectedGameSlug;

  return {
    ...payload,
    gameStats: resolvedSlug
      ? getGameModule(resolvedSlug).buildOpsStats({
          recentSessions: payload.recentSessions,
          suspiciousRuns: payload.suspiciousRuns
        })
      : []
  };
}
