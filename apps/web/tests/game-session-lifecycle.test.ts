import { beforeEach, describe, expect, it } from "vitest";

import { TOTAL_PAIRS } from "@telegramplay/game-memory-core";
import type { MemoryFlipAction, MemoryReplayPayload, MemorySessionConfig } from "@telegramplay/game-memory-core";
import { generateAutoplayFrames, replayRace } from "@telegramplay/game-racer-core";
import type { RacerSessionConfig } from "@telegramplay/game-racer-core";

import { buildTelegramInitData } from "../lib/auth/dev-init-data";
import { createGameSessionForPlayer, submitGameSessionForPlayer } from "../lib/server/game-service";
import { authenticateTelegram } from "../lib/server/store";

describe("official game-session lifecycle", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_BOT_USERNAME = "graphite_bot";
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "graphite_bot";
    process.env.ALLOW_DEV_AUTH = "true";
    process.env.USE_MEMORY_STORE = "true";
  });

  it("creates a game session and finalizes an official result", async () => {
    const initData = buildTelegramInitData({
      botToken: process.env.TELEGRAM_BOT_TOKEN!,
      user: {
        id: 30303,
        username: "flow_dev",
        first_name: "Flow"
      }
    });

    const auth = await authenticateTelegram({
      telegramUserId: "30303",
      username: "flow_dev",
      displayName: "Flow",
      avatarUrl: null,
      authDate: Math.floor(Date.now() / 1000)
    });

    const gameSession = await createGameSessionForPlayer(auth, "racer-poc");
    const sessionConfig = gameSession.config as RacerSessionConfig;
    const frames = generateAutoplayFrames(sessionConfig);
    const provisional = replayRace(sessionConfig, {
      sessionId: gameSession.id,
      configVersion: gameSession.configVersion,
      payload: {
        frames
      },
      clientSummary: {
        elapsedMs: 70000,
        reportedPlacement: 3,
        reportedScoreSortValue: 69000,
        reportedDisplayValue: "69.00s"
      }
    });

    const result = await submitGameSessionForPlayer(auth, "racer-poc", {
      sessionId: gameSession.id,
      configVersion: gameSession.configVersion,
      payload: {
        frames
      },
      clientSummary: {
        elapsedMs: Math.round(provisional.elapsedMs),
        reportedPlacement: provisional.placement,
        reportedScoreSortValue: provisional.scoreSortValue,
        reportedDisplayValue: provisional.displayValue
      }
    });

    expect(result.sessionId).toBe(gameSession.id);
    expect(result.status).toBe("accepted");
    expect(result.rewards.length).toBeGreaterThan(0);
    expect(initData).toContain("hash=");
  });

  it("creates a memory session and finalizes an official result", async () => {
    const auth = await authenticateTelegram({
      telegramUserId: "50505",
      username: "memory_dev",
      displayName: "Memory",
      avatarUrl: null,
      authDate: Math.floor(Date.now() / 1000)
    });

    const gameSession = await createGameSessionForPlayer(auth, "memory");
    const sessionConfig = gameSession.config as MemorySessionConfig;
    const board = sessionConfig.payload.board;
    const flips: MemoryFlipAction[] = [];
    const matched = new Set<number>();
    let ts = 1000;

    for (let pairId = 0; pairId < TOTAL_PAIRS; pairId++) {
      const indices = board.cards
        .map((card, index) => ({ card, index }))
        .filter(({ card, index }) => card.pairId === pairId && !matched.has(index));

      flips.push({ cardIndex: indices[0]!.index, timestampMs: ts });
      ts += 600;
      flips.push({ cardIndex: indices[1]!.index, timestampMs: ts });
      ts += 600;

      matched.add(indices[0]!.index);
      matched.add(indices[1]!.index);
    }

    const payload: MemoryReplayPayload = {
      sessionId: gameSession.id,
      configVersion: gameSession.configVersion,
      payload: { flips },
      clientSummary: {
        elapsedMs: flips[flips.length - 1]!.timestampMs - flips[0]!.timestampMs,
        reportedPlacement: 1,
        reportedScoreSortValue: TOTAL_PAIRS * 10000 + (flips[flips.length - 1]!.timestampMs - flips[0]!.timestampMs),
        reportedDisplayValue: `${TOTAL_PAIRS} moves`
      }
    };

    const result = await submitGameSessionForPlayer(auth, "memory", payload);
    const summary = result.resultSummary as { totalMoves?: number; pairsFound?: number };

    expect(result.sessionId).toBe(gameSession.id);
    expect(result.status).toBe("accepted");
    expect(summary.totalMoves).toBe(TOTAL_PAIRS);
    expect(summary.pairsFound).toBe(TOTAL_PAIRS);
    expect(result.rewards.length).toBeGreaterThan(0);
  });

  it("rejects mismatched config versions", async () => {
    const auth = await authenticateTelegram({
      telegramUserId: "40404",
      username: null,
      displayName: "Mismatch",
      avatarUrl: null,
      authDate: Math.floor(Date.now() / 1000)
    });
    const session = await createGameSessionForPlayer(auth, "racer-poc");

    await expect(
      submitGameSessionForPlayer(auth, "racer-poc", {
        sessionId: session.id,
        configVersion: "bad-version",
        payload: {
          frames: generateAutoplayFrames(session.config as RacerSessionConfig)
        },
        clientSummary: {
          elapsedMs: 60000,
          reportedPlacement: 1,
          reportedScoreSortValue: 59000,
          reportedDisplayValue: "59.00s"
        }
      })
    ).resolves.toEqual(expect.objectContaining({ status: "rejected" }));
  });
});
