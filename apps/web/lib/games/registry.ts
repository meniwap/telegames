import type { GameModuleServerContract, GamePlayerStat } from "@telegramplay/game-core";
import { racerGameModule } from "@telegramplay/game-racer-core";
import { memoryGameModule } from "@telegramplay/game-memory-core";

import type { CheatFlagRecord, GameProfileRecord, GameSessionRecord, MemoryPlayerStatsRecord, RacerPlayerStatsRecord } from "../types";

export type RegisteredGameModule = {
  definition: GameModuleServerContract["definition"];
  createSessionConfig: (sessionId: string, seed: number) => ReturnType<GameModuleServerContract["createSessionConfig"]>;
  parseSubmissionPayload: (body: unknown) => ReturnType<GameModuleServerContract["parseSubmissionPayload"]>;
  verifySubmission: (
    config: Parameters<GameModuleServerContract["verifySubmission"]>[0],
    submission: Parameters<GameModuleServerContract["verifySubmission"]>[1]
  ) => ReturnType<GameModuleServerContract["verifySubmission"]>;
  buildProfileStats: (profile: GameProfileRecord | null, profileState: unknown) => GamePlayerStat[];
  buildOpsStats: (context: { recentSessions: GameSessionRecord[]; suspiciousRuns: CheatFlagRecord[] }) => GamePlayerStat[];
};

const racerModule: RegisteredGameModule = {
  definition: racerGameModule.definition,
  createSessionConfig: racerGameModule.createSessionConfig as RegisteredGameModule["createSessionConfig"],
  parseSubmissionPayload: racerGameModule.parseSubmissionPayload as RegisteredGameModule["parseSubmissionPayload"],
  verifySubmission: racerGameModule.verifySubmission as unknown as RegisteredGameModule["verifySubmission"],
  buildProfileStats(profile, profileState) {
    const racerStats = profileState as RacerPlayerStatsRecord | null;

    if (!profile || !racerStats) {
      return [
        { label: "Level", value: profile ? String(profile.level) : "1", hint: "Per-game progression level" },
        { label: "Sessions", value: "0", hint: "No official runs yet" },
        { label: "Finishes", value: "0", hint: "Server-accepted runs" },
        { label: "Best Time", value: "Unset", hint: "Official best result" }
      ];
    }

    return [
      {
        label: "Level",
        value: String(profile.level),
        hint: `${profile.xp} XP in ${profile.gameName}`
      },
      {
        label: "Sessions",
        value: String(racerStats.sessionsStarted),
        hint: "Official session starts"
      },
      {
        label: "Finishes",
        value: String(racerStats.sessionsCompleted),
        hint: "Server-accepted runs"
      },
      {
        label: "Best Time",
        value: racerStats.bestDisplayValue ?? "Unset",
        hint: "Fastest official finish"
      }
    ];
  },
  buildOpsStats({ recentSessions, suspiciousRuns }) {
    return [
      {
        label: "Recent Sessions",
        value: String(recentSessions.length),
        hint: "Latest official starts"
      },
      {
        label: "Suspicious Runs",
        value: String(suspiciousRuns.length),
        hint: "Flagged submissions"
      },
      {
        label: "Mode",
        value: "Sprint",
        hint: "Tilted top-down racer"
      }
    ];
  }
};

const memoryModule: RegisteredGameModule = {
  definition: memoryGameModule.definition,
  createSessionConfig: memoryGameModule.createSessionConfig as RegisteredGameModule["createSessionConfig"],
  parseSubmissionPayload: memoryGameModule.parseSubmissionPayload as RegisteredGameModule["parseSubmissionPayload"],
  verifySubmission: memoryGameModule.verifySubmission as unknown as RegisteredGameModule["verifySubmission"],
  buildProfileStats(profile, profileState) {
    const memoryStats = profileState as MemoryPlayerStatsRecord | null;

    if (!profile || !memoryStats) {
      return [
        { label: "Level", value: profile ? String(profile.level) : "1", hint: "Per-game progression level" },
        { label: "Sessions", value: "0", hint: "No games played yet" },
        { label: "Finishes", value: "0", hint: "Completed games" },
        { label: "Best Score", value: "Unset", hint: "Official best result" }
      ];
    }

    return [
      {
        label: "Level",
        value: String(profile.level),
        hint: `${profile.xp} XP in ${profile.gameName}`
      },
      {
        label: "Sessions",
        value: String(memoryStats.sessionsStarted),
        hint: "Games started"
      },
      {
        label: "Finishes",
        value: String(memoryStats.sessionsCompleted),
        hint: "Completed games"
      },
      {
        label: "Best Score",
        value: memoryStats.bestDisplayValue ?? "Unset",
        hint: memoryStats.bestMoves ? `${memoryStats.bestMoves} moves` : "Play to set a record"
      }
    ];
  },
  buildOpsStats({ recentSessions, suspiciousRuns }) {
    return [
      {
        label: "Recent Sessions",
        value: String(recentSessions.length),
        hint: "Latest game starts"
      },
      {
        label: "Suspicious Runs",
        value: String(suspiciousRuns.length),
        hint: "Flagged submissions"
      },
      {
        label: "Mode",
        value: "Memory 4x4",
        hint: "Card matching puzzle"
      }
    ];
  }
};

export const gameRegistry = {
  [racerModule.definition.slug]: racerModule,
  [memoryModule.definition.slug]: memoryModule
} as const;

export function getGameModule(gameSlug: string): RegisteredGameModule {
  const module = gameRegistry[gameSlug as keyof typeof gameRegistry];

  if (!module) {
    throw new Error("game_not_found");
  }

  return module;
}

export function getRegisteredGames() {
  return Object.values(gameRegistry);
}
