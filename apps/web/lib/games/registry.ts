import type { GameModuleServerContract, GamePlayerStat } from "@telegramplay/game-core";
import { hopperGameModule } from "@telegramplay/game-hopper-core";
import { orbitForgeGameModule } from "@telegramplay/game-orbit-forge-core";
import { prismBreakGameModule } from "@telegramplay/game-prism-break-core";
import { signalStackerGameModule } from "@telegramplay/game-signal-stacker-core";
import { vectorShiftGameModule } from "@telegramplay/game-vector-shift-core";
import { racerGameModule } from "@telegramplay/game-racer-core";
import { memoryGameModule } from "@telegramplay/game-memory-core";

import type {
  CheatFlagRecord,
  GameProfileRecord,
  GameSessionRecord,
  OrbitForgePlayerStatsRecord,
  PrismBreakPlayerStatsRecord,
  HopperPlayerStatsRecord,
  MemoryPlayerStatsRecord,
  RacerPlayerStatsRecord,
  SignalStackerPlayerStatsRecord,
  VectorShiftPlayerStatsRecord
} from "../types";

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

const hopperModule: RegisteredGameModule = {
  definition: hopperGameModule.definition,
  createSessionConfig: hopperGameModule.createSessionConfig as RegisteredGameModule["createSessionConfig"],
  parseSubmissionPayload: hopperGameModule.parseSubmissionPayload as RegisteredGameModule["parseSubmissionPayload"],
  verifySubmission: hopperGameModule.verifySubmission as unknown as RegisteredGameModule["verifySubmission"],
  buildProfileStats(profile, profileState) {
    const hopperStats = profileState as HopperPlayerStatsRecord | null;

    if (!profile || !hopperStats) {
      return [
        { label: "Level", value: profile ? String(profile.level) : "1", hint: "Per-game progression level" },
        { label: "Sessions", value: "0", hint: "No flight sessions yet" },
        { label: "Best Run", value: "Unset", hint: "Official best result" },
        { label: "Best Gates", value: "0", hint: "Clear gates to set a record" }
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
        value: String(hopperStats.sessionsStarted),
        hint: `${hopperStats.sessionsCompleted} accepted runs`
      },
      {
        label: "Best Run",
        value: hopperStats.bestDisplayValue ?? "Unset",
        hint: "Most gates, then longest survival"
      },
      {
        label: "Best Gates",
        value: String(hopperStats.bestGates ?? 0),
        hint: hopperStats.bestSurvivalMs ? `${(hopperStats.bestSurvivalMs / 1000).toFixed(1)}s survival` : "Play to set a record"
      }
    ];
  },
  buildOpsStats({ recentSessions, suspiciousRuns }) {
    return [
      {
        label: "Recent Sessions",
        value: String(recentSessions.length),
        hint: "Latest hop starts"
      },
      {
        label: "Suspicious Runs",
        value: String(suspiciousRuns.length),
        hint: "Flagged flight submissions"
      },
      {
        label: "Mode",
        value: "Endless Hopper",
        hint: "Tap-anywhere skyline run"
      }
    ];
  }
};

const signalStackerModule: RegisteredGameModule = {
  definition: signalStackerGameModule.definition,
  createSessionConfig: signalStackerGameModule.createSessionConfig as RegisteredGameModule["createSessionConfig"],
  parseSubmissionPayload: signalStackerGameModule.parseSubmissionPayload as RegisteredGameModule["parseSubmissionPayload"],
  verifySubmission: signalStackerGameModule.verifySubmission as unknown as RegisteredGameModule["verifySubmission"],
  buildProfileStats(profile, profileState) {
    const signalStats = profileState as SignalStackerPlayerStatsRecord | null;

    if (!profile || !signalStats) {
      return [
        { label: "Level", value: profile ? String(profile.level) : "1", hint: "Per-game progression level" },
        { label: "Sessions", value: "0", hint: "No tower runs yet" },
        { label: "Best Tower", value: "Unset", hint: "Official best result" },
        { label: "Perfect Drops", value: "0", hint: "Land centered drops to set a record" }
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
        value: String(signalStats.sessionsStarted),
        hint: `${signalStats.sessionsCompleted} accepted towers`
      },
      {
        label: "Best Tower",
        value: signalStats.bestDisplayValue ?? "Unset",
        hint: signalStats.bestFloors ? `${signalStats.bestFloors} floors official best` : "Play to set a record"
      },
      {
        label: "Perfect Drops",
        value: String(signalStats.bestPerfectDrops ?? 0),
        hint: "Best accepted precision chain"
      }
    ];
  },
  buildOpsStats({ recentSessions, suspiciousRuns }) {
    return [
      {
        label: "Recent Sessions",
        value: String(recentSessions.length),
        hint: "Latest tower starts"
      },
      {
        label: "Suspicious Runs",
        value: String(suspiciousRuns.length),
        hint: "Flagged stacking submissions"
      },
      {
        label: "Mode",
        value: "Timing Stacker",
        hint: "Tap-drop tower builder"
      }
    ];
  }
};

const vectorShiftModule: RegisteredGameModule = {
  definition: vectorShiftGameModule.definition,
  createSessionConfig: vectorShiftGameModule.createSessionConfig as RegisteredGameModule["createSessionConfig"],
  parseSubmissionPayload: vectorShiftGameModule.parseSubmissionPayload as RegisteredGameModule["parseSubmissionPayload"],
  verifySubmission: vectorShiftGameModule.verifySubmission as unknown as RegisteredGameModule["verifySubmission"],
  buildProfileStats(profile, profileState) {
    const vectorStats = profileState as VectorShiftPlayerStatsRecord | null;

    if (!profile || !vectorStats) {
      return [
        { label: "Level", value: profile ? String(profile.level) : "1", hint: "Per-game progression level" },
        { label: "Sessions", value: "0", hint: "No lane runs yet" },
        { label: "Best Run", value: "Unset", hint: "Official best result" },
        { label: "Best Charges", value: "0", hint: "Collect charges to set a record" }
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
        value: String(vectorStats.sessionsStarted),
        hint: `${vectorStats.sessionsCompleted} accepted runs`
      },
      {
        label: "Best Run",
        value: vectorStats.bestDisplayValue ?? "Unset",
        hint: vectorStats.bestSectors ? `${vectorStats.bestSectors} sectors official best` : "Play to set a record"
      },
      {
        label: "Best Charges",
        value: String(vectorStats.bestCharges ?? 0),
        hint: "Highest accepted charge haul"
      }
    ];
  },
  buildOpsStats({ recentSessions, suspiciousRuns }) {
    return [
      {
        label: "Recent Sessions",
        value: String(recentSessions.length),
        hint: "Latest lane runs"
      },
      {
        label: "Suspicious Runs",
        value: String(suspiciousRuns.length),
        hint: "Flagged lane submissions"
      },
      {
        label: "Mode",
        value: "Lane Dodger",
        hint: "Left-right neon survival"
      }
    ];
  }
};

const orbitForgeModule: RegisteredGameModule = {
  definition: orbitForgeGameModule.definition,
  createSessionConfig: orbitForgeGameModule.createSessionConfig as RegisteredGameModule["createSessionConfig"],
  parseSubmissionPayload: orbitForgeGameModule.parseSubmissionPayload as RegisteredGameModule["parseSubmissionPayload"],
  verifySubmission: orbitForgeGameModule.verifySubmission as unknown as RegisteredGameModule["verifySubmission"],
  buildProfileStats(profile, profileState) {
    const orbitStats = profileState as OrbitForgePlayerStatsRecord | null;

    if (!profile || !orbitStats) {
      return [
        { label: "Level", value: profile ? String(profile.level) : "1", hint: "Per-game progression level" },
        { label: "Sessions", value: "0", hint: "No orbit runs yet" },
        { label: "Best Run", value: "Unset", hint: "Official best result" },
        { label: "Best Shards", value: "0", hint: "Collect shards to set a record" }
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
        value: String(orbitStats.sessionsStarted),
        hint: `${orbitStats.sessionsCompleted} accepted runs`
      },
      {
        label: "Best Run",
        value: orbitStats.bestDisplayValue ?? "Unset",
        hint: orbitStats.bestGates ? `${orbitStats.bestGates} gates official best` : "Play to set a record"
      },
      {
        label: "Best Shards",
        value: String(orbitStats.bestShards ?? 0),
        hint: orbitStats.bestSurvivalMs ? `${(orbitStats.bestSurvivalMs / 1000).toFixed(1)}s survival` : "Phase through hazard arcs to steal shards"
      }
    ];
  },
  buildOpsStats({ recentSessions, suspiciousRuns }) {
    return [
      {
        label: "Recent Sessions",
        value: String(recentSessions.length),
        hint: "Latest orbit starts"
      },
      {
        label: "Suspicious Runs",
        value: String(suspiciousRuns.length),
        hint: "Flagged orbit submissions"
      },
      {
        label: "Mode",
        value: "Ring Survival",
        hint: "Swap lanes and phase hazards"
      }
    ];
  }
};

const prismBreakModule: RegisteredGameModule = {
  definition: prismBreakGameModule.definition,
  createSessionConfig: prismBreakGameModule.createSessionConfig as RegisteredGameModule["createSessionConfig"],
  parseSubmissionPayload: prismBreakGameModule.parseSubmissionPayload as RegisteredGameModule["parseSubmissionPayload"],
  verifySubmission: prismBreakGameModule.verifySubmission as unknown as RegisteredGameModule["verifySubmission"],
  buildProfileStats(profile, profileState) {
    const prismStats = profileState as PrismBreakPlayerStatsRecord | null;

    if (!profile || !prismStats) {
      return [
        { label: "Level", value: profile ? String(profile.level) : "1", hint: "Per-game progression level" },
        { label: "Sessions", value: "0", hint: "No chamber runs yet" },
        { label: "Best Run", value: "Unset", hint: "Official best result" },
        { label: "Best Bursts", value: "0", hint: "Chain prism clusters to set a record" }
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
        value: String(prismStats.sessionsStarted),
        hint: `${prismStats.sessionsCompleted} accepted runs`
      },
      {
        label: "Best Run",
        value: prismStats.bestDisplayValue ?? "Unset",
        hint: prismStats.bestPrisms ? `${prismStats.bestPrisms} prisms official best` : "Play to set a record"
      },
      {
        label: "Best Bursts",
        value: String(prismStats.bestChainBursts ?? 0),
        hint: prismStats.bestSurvivalMs ? `${(prismStats.bestSurvivalMs / 1000).toFixed(1)}s survival` : "Build chain bursts to maximize score"
      }
    ];
  },
  buildOpsStats({ recentSessions, suspiciousRuns }) {
    return [
      {
        label: "Recent Sessions",
        value: String(recentSessions.length),
        hint: "Latest chamber starts"
      },
      {
        label: "Suspicious Runs",
        value: String(suspiciousRuns.length),
        hint: "Flagged prism submissions"
      },
      {
        label: "Mode",
        value: "Prism Chamber",
        hint: "Lane deflector and magnet catch"
      }
    ];
  }
};

export const gameRegistry = {
  [racerModule.definition.slug]: racerModule,
  [memoryModule.definition.slug]: memoryModule,
  [hopperModule.definition.slug]: hopperModule,
  [signalStackerModule.definition.slug]: signalStackerModule,
  [vectorShiftModule.definition.slug]: vectorShiftModule,
  [orbitForgeModule.definition.slug]: orbitForgeModule,
  [prismBreakModule.definition.slug]: prismBreakModule
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
