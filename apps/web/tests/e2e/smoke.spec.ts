import { expect, test } from "@playwright/test";

import { generateAutoplayFrames, replayRace } from "@telegramplay/game-racer-core";
import type { OfficialRacerResult, RacerReplayPayload, RacerSessionConfig } from "@telegramplay/game-racer-core";

test("portal bootstraps and completes an official game flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Play. Compete. Climb.")).toBeVisible();
  await expect(page.getByText("Memory Match")).toBeVisible();

  await page.goto("/dev-auth?next=%2Fgames%2Fracer-poc%2Fplay");
  await expect(page.getByLabel(/Blockshift Circuit play screen/i)).toBeVisible();
  await expect(page.getByTestId("control-left")).toBeVisible();
  await expect(page.getByTestId("game-help")).toBeVisible();
  await page.waitForFunction(() => typeof window.advanceTime === "function");
  const request = page.context().request;
  const sessionResponse = await request.post("/api/games/racer-poc/sessions");
  expect(sessionResponse.ok()).toBeTruthy();

  const sessionBody = (await sessionResponse.json()) as { gameSession: RacerSessionConfig };
  const sessionConfig = sessionBody.gameSession;
  const frames = generateAutoplayFrames(sessionConfig);
  const provisional = replayRace(sessionConfig, {
    sessionId: sessionConfig.sessionId,
    configVersion: sessionConfig.configVersion,
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
  const submission: RacerReplayPayload = {
    sessionId: sessionConfig.sessionId,
    configVersion: sessionConfig.configVersion,
    payload: {
      frames
    },
    clientSummary: {
      elapsedMs: Math.round(provisional.elapsedMs),
      reportedPlacement: provisional.placement,
      reportedScoreSortValue: provisional.scoreSortValue,
      reportedDisplayValue: provisional.displayValue
    }
  };
  const submitResponse = await request.post(`/api/games/racer-poc/sessions/${sessionConfig.sessionId}/submissions`, {
    data: submission
  });
  expect(submitResponse.ok()).toBeTruthy();

  const resultBody = (await submitResponse.json()) as { result: OfficialRacerResult };
  expect(resultBody.result.status).toBe("accepted");
  expect(resultBody.result.rewards.length).toBeGreaterThan(0);

  await page.goto("/leaderboard?game=racer-poc&window=all_time");
  await expect(page.getByText("Official Standings")).toBeVisible();
  await expect(page.getByText(resultBody.result.displayValue).first()).toBeVisible();

  await page.goto("/profile?game=racer-poc");
  await expect(page.getByText("Recent Rewards")).toBeVisible();

  await page.goto("/dev-auth?next=%2Fgames%2Fmemory%2Fplay");
  await expect(page.getByLabel(/Memory Match play screen/i)).toBeVisible();
  await expect(page.getByText("Pairs")).toBeVisible();
});
