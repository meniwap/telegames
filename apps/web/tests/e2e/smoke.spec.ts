import { expect, test } from "@playwright/test";

import { generateAutoplayFlapTicks } from "@telegramplay/game-hopper-core";
import type { HopperReplayPayload, HopperSessionConfig, OfficialHopperResult } from "@telegramplay/game-hopper-core";
import { generateAutoplayFrames, replayRace } from "@telegramplay/game-racer-core";
import type { OfficialRacerResult, RacerReplayPayload, RacerSessionConfig } from "@telegramplay/game-racer-core";

test("portal bootstraps and completes an official game flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Play. Compete. Climb.")).toBeVisible();
  await expect(page.getByText("Memory Match")).toBeVisible();
  await expect(page.getByText("Skyline Hopper")).toBeVisible();

  await page.goto("/dev-auth?next=%2Fgames%2Fracer-poc%2Fplay");
  await expect(page.getByLabel(/Blockshift Circuit play screen/i)).toBeVisible();
  await expect(page.getByTestId("control-left")).toBeVisible();
  await expect(page.getByTestId("game-help")).toBeVisible();
  await expect(page.getByText("The official run could not be completed right now. Restart the run and try again.")).toHaveCount(0);
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
  await expect(page.getByText("No official runs yet for this window.")).toHaveCount(0);

  await page.goto("/profile?game=racer-poc");
  await expect(page.getByText("Recent Rewards")).toBeVisible();

  await page.goto("/dev-auth?next=%2Fgames%2Fmemory%2Fplay");
  await expect(page.getByLabel(/Memory Match play screen/i)).toBeVisible();
  await expect(page.getByText("Pairs")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByRole("button", { name: /^Card 1$/ })).toBeInViewport();
  await expect(page.getByRole("button", { name: /^Card 16$/ })).toBeInViewport();
  await expect(page.getByText("The official game could not be completed right now. Restart and try again.")).toHaveCount(0);

  await page.goto("/dev-auth?next=%2Fgames%2Fskyline-hopper%2Fplay");
  await expect(page.getByLabel(/Skyline Hopper play screen/i)).toBeVisible();
  await expect(page.getByText("Tap anywhere to flap")).toBeVisible();
  await expect(page.getByText("The official run could not be completed right now. Restart the run and try again.")).toHaveCount(0);
  const hopperSessionResponse = await request.post("/api/games/skyline-hopper/sessions");
  expect(hopperSessionResponse.ok()).toBeTruthy();

  const hopperSessionBody = (await hopperSessionResponse.json()) as { gameSession: HopperSessionConfig };
  const hopperSession = hopperSessionBody.gameSession;
  const flapTicks = generateAutoplayFlapTicks(hopperSession, 5);
  const hopperSubmission: HopperReplayPayload = {
    sessionId: hopperSession.sessionId,
    configVersion: hopperSession.configVersion,
    payload: { flapTicks },
    clientSummary: {
      elapsedMs: 22000,
      reportedPlacement: 1,
      reportedScoreSortValue: -5000000,
      reportedDisplayValue: "5 gates · 22.0s"
    }
  };
  const hopperSubmitResponse = await request.post(`/api/games/skyline-hopper/sessions/${hopperSession.sessionId}/submissions`, {
    data: hopperSubmission
  });
  expect(hopperSubmitResponse.ok()).toBeTruthy();

  const hopperResultBody = (await hopperSubmitResponse.json()) as { result: OfficialHopperResult };
  expect(hopperResultBody.result.status).toBe("accepted");
  expect(hopperResultBody.result.resultSummary.gatesCleared).toBeGreaterThan(0);

  await page.goto("/leaderboard?game=skyline-hopper&window=all_time");
  await expect(page.getByText("No official runs yet for this window.")).toHaveCount(0);
});
