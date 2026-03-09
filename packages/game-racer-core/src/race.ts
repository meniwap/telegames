import type { GameModuleServerContract, RewardGrant } from "@telegramplay/game-core";
import { z } from "zod";

import { defaultCpuProfiles, INPUT_BRAKE, INPUT_LEFT, INPUT_RIGHT, MAX_REPLAY_FRAMES, starterCarPreset, TICK_MS, TICK_RATE } from "./constants";
import { clamp, lerp, normalizeAngle } from "./math";
import { createMulberry32 } from "./prng";
import { buildTrackRuntime, projectOntoTrack, racerTrack } from "./track";
import type {
  CpuProfile,
  OfficialRacerResult,
  RaceState,
  RacerReplayPayload,
  RacerSessionConfig,
  RacerState
} from "./types";

const runtime = buildTrackRuntime(racerTrack);
const startGateProgress = projectOntoTrack(racerTrack.startPositions[0]!, racerTrack, runtime).progress;

function bitEnabled(input: number, bit: number) {
  return (input & bit) === bit;
}

function wrapStartDistance(progress: number) {
  if (progress - startGateProgress > runtime.totalLength * 0.5) {
    return progress - runtime.totalLength;
  }

  if (progress - startGateProgress < -runtime.totalLength * 0.5) {
    return progress + runtime.totalLength;
  }

  return progress;
}

function cpuInputForRacer(racer: RacerState, cpuProfile: CpuProfile, stepCount: number, seed: number) {
  const random = createMulberry32(seed + stepCount + cpuProfile.id.length * 13);
  const nextWaypoint =
    racerTrack.waypoints[Math.floor((racer.trackDistance / runtime.totalLength) * racerTrack.waypoints.length + 1) % racerTrack.waypoints.length]!;
  const targetAngle = Math.atan2(nextWaypoint.y - racer.y, nextWaypoint.x - racer.x);
  const angleDiff = normalizeAngle(targetAngle - racer.angle);
  const desiredSpeed = starterCarPreset.maxSpeed * cpuProfile.preferredSpeedRatio;
  const steeringNoise = (random() - 0.5) * (1 - cpuProfile.precision) * 0.28;
  let input = 0;

  if (angleDiff + steeringNoise > 0.06) {
    input |= INPUT_RIGHT;
  }

  if (angleDiff + steeringNoise < -0.06) {
    input |= INPUT_LEFT;
  }

  if (Math.abs(angleDiff) > 0.55 && racer.speed > desiredSpeed * 0.86) {
    input |= INPUT_BRAKE;
  }

  return input;
}

function applyInput(racer: RacerState, input: number, deltaSeconds: number) {
  const turning =
    (bitEnabled(input, INPUT_RIGHT) ? 1 : 0) - (bitEnabled(input, INPUT_LEFT) ? 1 : 0);
  const drifting = bitEnabled(input, INPUT_BRAKE);
  const turnRate =
    starterCarPreset.turnRate * deltaSeconds * clamp(Math.max(racer.speed, 30) / starterCarPreset.maxSpeed, 0.3, 1) *
    (drifting ? 1 + starterCarPreset.driftTurnBonus : 1);
  racer.angle = normalizeAngle(racer.angle + turning * turnRate);

  racer.speed += starterCarPreset.acceleration * deltaSeconds;

  if (drifting) {
    racer.speed -= starterCarPreset.braking * deltaSeconds;
    racer.boostHeat = clamp(racer.boostHeat + 0.8 * deltaSeconds, 0, 1);
  } else {
    racer.boostHeat = clamp(racer.boostHeat - 0.45 * deltaSeconds, 0, 1);
  }

  racer.speed = clamp(racer.speed * starterCarPreset.drag, 58, starterCarPreset.maxSpeed);
  racer.x += Math.cos(racer.angle) * racer.speed * deltaSeconds;
  racer.y += Math.sin(racer.angle) * racer.speed * deltaSeconds;

  const projection = projectOntoTrack({ x: racer.x, y: racer.y }, racerTrack, runtime);
  racer.offTrack = projection.distanceFromCenter > racerTrack.width / 2;

  const normalAngle = projection.segmentAngle + Math.PI / 2;
  const targetLateralOffset = turning * (bitEnabled(input, INPUT_BRAKE) ? 34 : 22);
  const targetX = projection.projectedPoint.x + Math.cos(normalAngle) * targetLateralOffset;
  const targetY = projection.projectedPoint.y + Math.sin(normalAngle) * targetLateralOffset;
  const snapStrength = racer.offTrack ? 0.24 : 0.1;
  racer.x = lerp(racer.x, targetX, snapStrength);
  racer.y = lerp(racer.y, targetY, snapStrength);
  racer.angle = normalizeAngle(
    racer.angle + normalizeAngle(projection.segmentAngle - racer.angle) * (racer.offTrack ? 0.2 : 0.05)
  );

  if (racer.offTrack) {
    racer.speed = Math.max(38, racer.speed * starterCarPreset.offTrackDrag);
  }

  if (racer.trackDistance > runtime.totalLength * 0.82 && projection.progress < runtime.totalLength * 0.18) {
    if (racer.awaitingLaunchCross) {
      racer.awaitingLaunchCross = false;
    } else {
      racer.completedLaps += 1;
    }
  }

  racer.trackDistance = projection.progress;
  racer.progressDistance = racer.completedLaps * runtime.totalLength + projection.progress + racer.startDistanceBias;
}

function rankRacers(racers: RacerState[]) {
  const ranked = [...racers].sort((a, b) => {
    if (a.finishedAtMs !== null && b.finishedAtMs !== null) {
      return a.finishedAtMs - b.finishedAtMs;
    }

    if (a.finishedAtMs !== null) {
      return -1;
    }

    if (b.finishedAtMs !== null) {
      return 1;
    }

    return b.progressDistance - a.progressDistance;
  });

  ranked.forEach((racer, index) => {
    racer.place = index + 1;
  });
}

export function createRacerSessionConfig(sessionId: string, seed: number): RacerSessionConfig {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 10).toISOString();

  return {
    sessionId,
    gameTitleId: "racer-poc",
    configVersion: racerTrack.version,
    seed,
    createdAt,
    expiresAt,
    payload: {
      track: racerTrack,
      trackId: racerTrack.id,
      carPreset: starterCarPreset,
      cpuProfiles: defaultCpuProfiles
    }
  };
}

export function createInitialRaceState(config: RacerSessionConfig): RaceState {
  const racers: RacerState[] = [
    ...[
      {
        id: "player",
        displayName: "You",
        kind: "player" as const,
        start: config.payload.track.startPositions[0]!
      },
      ...config.payload.cpuProfiles.map((profile: CpuProfile, index: number) => ({
        id: profile.id,
        displayName: profile.label,
        kind: "cpu" as const,
        start: config.payload.track.startPositions[index + 1]!
      }))
    ].map((entry) => {
      const projected = projectOntoTrack({ x: entry.start.x, y: entry.start.y }, racerTrack, runtime);
      const wrappedStartDistance = wrapStartDistance(projected.progress);

      return {
        id: entry.id,
        displayName: entry.displayName,
        kind: entry.kind,
        ...entry.start,
        speed: 58,
        startDistanceBias: wrappedStartDistance - projected.progress,
        awaitingLaunchCross: wrappedStartDistance < 0,
        completedLaps: 0,
        progressDistance: wrappedStartDistance,
        trackDistance: projected.progress,
        finishedAtMs: null,
        place: null,
        offTrack: projected.distanceFromCenter > racerTrack.width / 2,
        boostHeat: 0
      };
    })
  ];

  rankRacers(racers);

  return {
    sessionId: config.sessionId,
    elapsedMs: 0,
    finished: false,
    playerFinished: false,
    racers
  };
}

export function stepRaceState(state: RaceState, config: RacerSessionConfig, playerInput: number) {
  if (state.finished) {
    return state;
  }

  const deltaSeconds = 1 / TICK_RATE;
  const stepCount = Math.floor(state.elapsedMs / TICK_MS);

  state.racers.forEach((racer, index) => {
    if (racer.finishedAtMs !== null) {
      return;
    }

    const input =
      racer.kind === "player"
        ? playerInput
        : cpuInputForRacer(racer, config.payload.cpuProfiles[index - 1]!, stepCount, config.seed);

    applyInput(racer, input, deltaSeconds);

    if (racer.completedLaps >= config.payload.track.laps && racer.finishedAtMs === null) {
      racer.finishedAtMs = state.elapsedMs + TICK_MS;
    }
  });

  state.elapsedMs += TICK_MS;
  state.playerFinished = state.racers[0]!.finishedAtMs !== null;
  state.finished = state.racers.every((racer) => racer.finishedAtMs !== null);
  rankRacers(state.racers);

  return state;
}

export function evaluateRewards(placement: number, officialTimeMs: number): RewardGrant[] {
  const coins = Math.max(45, 160 - placement * 18);
  const xp = Math.max(30, 120 - placement * 10 + Math.max(0, Math.round((70000 - officialTimeMs) / 1500)));

  return [
    {
      entryType: "xp",
      amount: xp,
      sourceType: "game_result",
      sourceId: ""
    },
    {
      entryType: "coins",
      amount: coins,
      sourceType: "game_result",
      sourceId: ""
    }
  ];
}

const racerSubmissionSchema = z.object({
  sessionId: z.string().min(1),
  configVersion: z.string().min(1),
  payload: z.object({
    frames: z.array(z.number().int().min(0))
  }),
  clientSummary: z.object({
    elapsedMs: z.number().int().nonnegative(),
    reportedPlacement: z.number().int().positive().nullable().optional(),
    reportedDisplayValue: z.string().nullable().optional(),
    reportedScoreSortValue: z.number().int().nonnegative().nullable().optional()
  })
});

export function parseRacerSubmissionPayload(body: unknown): RacerReplayPayload {
  return racerSubmissionSchema.parse(body);
}

export function replayRace(config: RacerSessionConfig, submission: RacerReplayPayload): OfficialRacerResult {
  const cheatFlags: string[] = [];

  if (submission.configVersion !== config.configVersion) {
    return {
      sessionId: submission.sessionId,
      gameTitleId: config.gameTitleId,
      status: "rejected",
      placement: null,
      scoreSortValue: 0,
      displayValue: "Rejected",
      elapsedMs: 0,
      rewards: [],
      flags: ["config_version_mismatch"],
      rejectedReason: "config_version_mismatch",
      resultSummary: {
        officialTimeMs: 0,
        finishers: []
      }
    };
  }

  if (submission.payload.frames.length === 0 || submission.payload.frames.length > MAX_REPLAY_FRAMES) {
    return {
      sessionId: submission.sessionId,
      gameTitleId: config.gameTitleId,
      status: "rejected",
      placement: null,
      scoreSortValue: 0,
      displayValue: "Rejected",
      elapsedMs: 0,
      rewards: [],
      flags: ["invalid_frame_count"],
      rejectedReason: "invalid_frame_count",
      resultSummary: {
        officialTimeMs: 0,
        finishers: []
      }
    };
  }

  const state = createInitialRaceState(config);

  for (const input of submission.payload.frames) {
    if (!Number.isInteger(input) || input < 0 || input > INPUT_LEFT + INPUT_RIGHT + INPUT_BRAKE) {
      return {
        sessionId: submission.sessionId,
        gameTitleId: config.gameTitleId,
        status: "rejected",
        placement: null,
        scoreSortValue: 0,
        displayValue: "Rejected",
        elapsedMs: Math.round(state.elapsedMs),
        rewards: [],
        flags: ["invalid_input_mask"],
        rejectedReason: "invalid_input_mask",
        resultSummary: {
          officialTimeMs: 0,
          finishers: []
        }
      };
    }

    stepRaceState(state, config, input);

    if (state.playerFinished) {
      break;
    }
  }

  const player = state.racers[0]!;
  const officialTimeMs = Math.round(player.finishedAtMs ?? state.elapsedMs);
  const finishers = state.racers
    .filter((racer) => racer.finishedAtMs !== null && racer.place !== null)
    .map((racer) => ({
      racerId: racer.id,
      displayName: racer.displayName,
      placement: racer.place!,
      finishedAtMs: Math.round(racer.finishedAtMs!)
    }))
    .sort((left, right) => left.placement - right.placement);

  if (!player.finishedAtMs) {
    return {
      sessionId: submission.sessionId,
      gameTitleId: config.gameTitleId,
      status: "rejected",
      placement: null,
      scoreSortValue: 0,
      displayValue: "Rejected",
      elapsedMs: Math.round(state.elapsedMs),
      rewards: [],
      flags: ["player_did_not_finish"],
      rejectedReason: "player_did_not_finish",
      resultSummary: {
        officialTimeMs: 0,
        finishers
      }
    };
  }

  if (officialTimeMs < config.payload.track.expectedMsRange.min) {
    cheatFlags.push("impossible_fast_time");
  }

  if (officialTimeMs > config.payload.track.expectedMsRange.max * 1.5) {
    cheatFlags.push("impossible_slow_time");
  }

  const placement = player.place ?? (finishers.length || 1);
  const rewards = evaluateRewards(placement, officialTimeMs).map((reward) => ({
    ...reward,
    sourceId: submission.sessionId
  }));
  const displayValue = `${(officialTimeMs / 1000).toFixed(2)}s`;

  return {
    sessionId: submission.sessionId,
    gameTitleId: config.gameTitleId,
    status: cheatFlags.includes("impossible_fast_time") ? "rejected" : "accepted",
    placement,
    scoreSortValue: officialTimeMs,
    displayValue,
    elapsedMs: officialTimeMs,
    rewards: cheatFlags.includes("impossible_fast_time") ? [] : rewards,
    flags: cheatFlags,
    rejectedReason: cheatFlags.includes("impossible_fast_time") ? "impossible_fast_time" : undefined,
    resultSummary: {
      officialTimeMs,
      finishers
    }
  };
}

export function generateAutoplayFrames(config: RacerSessionConfig, maxFrames = MAX_REPLAY_FRAMES) {
  const state = createInitialRaceState(config);
  const frames: number[] = [];

  while (!state.playerFinished && frames.length < maxFrames) {
    const player = state.racers[0]!;
    let input = 0;
    const waypointIndex =
      Math.floor((player.trackDistance / runtime.totalLength) * config.payload.track.waypoints.length + 1) %
      config.payload.track.waypoints.length;
    const nextWaypoint = config.payload.track.waypoints[waypointIndex]!;
    const targetAngle = Math.atan2(nextWaypoint.y - player.y, nextWaypoint.x - player.x);
    const angleDiff = normalizeAngle(targetAngle - player.angle);

    if (angleDiff > 0.08) {
      input |= INPUT_RIGHT;
    }

    if (angleDiff < -0.08) {
      input |= INPUT_LEFT;
    }

    if (Math.abs(angleDiff) > 0.55) {
      input |= INPUT_BRAKE;
    }

    frames.push(input);
    stepRaceState(state, config, input);
  }

  return frames;
}

export const racerGameModule: GameModuleServerContract<
  RacerSessionConfig["payload"],
  RacerReplayPayload["payload"],
  OfficialRacerResult["resultSummary"]
> = {
  definition: {
    id: "racer-poc",
    slug: "racer-poc",
    name: "Blockshift Circuit",
    status: "live",
    tagline: "Premium Telegram toy-racer sprint.",
    description: "Tilted top-down arcade racer with official server-validated results, XP, coins, and leaderboard progression.",
    coverLabel: "Premium POC"
  },
  createSessionConfig: createRacerSessionConfig,
  parseSubmissionPayload: parseRacerSubmissionPayload,
  verifySubmission: replayRace
};
