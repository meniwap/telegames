import { expect, test } from "@playwright/test";

import { generateAutoplayFlapTicks } from "@telegramplay/game-hopper-core";
import type { HopperReplayPayload, HopperSessionConfig, OfficialHopperResult } from "@telegramplay/game-hopper-core";
import { generateAutoplayFrames, replayRace } from "@telegramplay/game-racer-core";
import type { OfficialRacerResult, RacerReplayPayload, RacerSessionConfig } from "@telegramplay/game-racer-core";
import { generateAutoplayDropTicks, replaySignalStackerGame } from "@telegramplay/game-signal-stacker-core";
import type {
  OfficialSignalStackerResult,
  SignalStackerReplayPayload,
  SignalStackerSessionConfig
} from "@telegramplay/game-signal-stacker-core";
import { generateAutoplayLaneChanges, replayVectorShiftGame } from "@telegramplay/game-vector-shift-core";
import type {
  OfficialVectorShiftResult,
  VectorShiftReplayPayload,
  VectorShiftSessionConfig
} from "@telegramplay/game-vector-shift-core";

test("portal bootstraps and completes an official game flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Play. Compete. Climb.")).toBeVisible();
  await expect(page.getByText("Memory Match")).toBeVisible();
  await expect(page.getByText("Skyline Hopper")).toBeVisible();
  await expect(page.getByText("Signal Stacker")).toBeVisible();
  await expect(page.getByText("Vector Shift")).toBeVisible();

  await page.goto("/games/signal-stacker");
  await expect(page.getByText("Signal Stacker")).toBeVisible();

  await page.goto("/games/vector-shift");
  await expect(page.getByText("Vector Shift")).toBeVisible();

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

  await page.goto("/dev-auth?next=%2Fgames%2Fsignal-stacker%2Fplay");
  await expect(page.getByLabel(/Signal Stacker play screen/i)).toBeVisible();
  await expect(page.getByText("Tap anywhere to drop")).toBeVisible();
  await expect(page.getByText("The official tower could not be completed right now. Restart the run and try again.")).toHaveCount(0);
  const stackerSessionResponse = await request.post("/api/games/signal-stacker/sessions");
  expect(stackerSessionResponse.ok()).toBeTruthy();

  const stackerSessionBody = (await stackerSessionResponse.json()) as { gameSession: SignalStackerSessionConfig };
  const stackerSession = stackerSessionBody.gameSession;
  const dropTicks = generateAutoplayDropTicks(stackerSession, 7);
  const stackerProvisional = replaySignalStackerGame(stackerSession, {
    sessionId: stackerSession.sessionId,
    configVersion: stackerSession.configVersion,
    payload: { dropTicks },
    clientSummary: {
      elapsedMs: dropTicks[dropTicks.length - 1]! * 50,
      reportedPlacement: 1,
      reportedDisplayValue: "7 floors · 7 perfect",
      reportedScoreSortValue: -7_000_000
    }
  });
  const stackerSubmission: SignalStackerReplayPayload = {
    sessionId: stackerSession.sessionId,
    configVersion: stackerSession.configVersion,
    payload: { dropTicks },
    clientSummary: {
      elapsedMs: stackerProvisional.elapsedMs,
      reportedPlacement: stackerProvisional.placement,
      reportedScoreSortValue: stackerProvisional.scoreSortValue,
      reportedDisplayValue: stackerProvisional.displayValue
    }
  };
  const stackerSubmitResponse = await request.post(`/api/games/signal-stacker/sessions/${stackerSession.sessionId}/submissions`, {
    data: stackerSubmission
  });
  expect(stackerSubmitResponse.ok()).toBeTruthy();

  const stackerResultBody = (await stackerSubmitResponse.json()) as { result: OfficialSignalStackerResult };
  expect(stackerResultBody.result.status).toBe("accepted");
  expect(stackerResultBody.result.resultSummary.floorsStacked).toBeGreaterThanOrEqual(7);

  await page.goto("/leaderboard?game=signal-stacker&window=all_time");
  await expect(page.getByText("No official runs yet for this window.")).toHaveCount(0);

  await page.goto("/dev-auth?next=%2Fgames%2Fvector-shift%2Fplay");
  await expect(page.getByLabel(/Vector Shift play screen/i)).toBeVisible();
  await expect(page.getByText("Tap sides or swipe to shift")).toBeVisible();
  await expect(page.getByTestId("vector-left")).toBeVisible();
  await expect(page.getByTestId("vector-right")).toBeVisible();
  await expect(page.getByText("The official run could not be completed right now. Restart the run and try again.")).toHaveCount(0);
  const vectorSessionResponse = await request.post("/api/games/vector-shift/sessions");
  expect(vectorSessionResponse.ok()).toBeTruthy();

  const vectorSessionBody = (await vectorSessionResponse.json()) as { gameSession: VectorShiftSessionConfig };
  const vectorSession = vectorSessionBody.gameSession;
  const laneChanges = generateAutoplayLaneChanges(vectorSession, 8);
  const vectorProvisional = replayVectorShiftGame(vectorSession, {
    sessionId: vectorSession.sessionId,
    configVersion: vectorSession.configVersion,
    payload: { laneChanges },
    clientSummary: {
      elapsedMs: 9000,
      reportedPlacement: 1,
      reportedDisplayValue: "8 sectors · 3 charges",
      reportedScoreSortValue: -8_000_000
    }
  });
  const vectorSubmission: VectorShiftReplayPayload = {
    sessionId: vectorSession.sessionId,
    configVersion: vectorSession.configVersion,
    payload: { laneChanges },
    clientSummary: {
      elapsedMs: vectorProvisional.elapsedMs,
      reportedPlacement: vectorProvisional.placement,
      reportedScoreSortValue: vectorProvisional.scoreSortValue,
      reportedDisplayValue: vectorProvisional.displayValue
    }
  };
  const vectorSubmitResponse = await request.post(`/api/games/vector-shift/sessions/${vectorSession.sessionId}/submissions`, {
    data: vectorSubmission
  });
  expect(vectorSubmitResponse.ok()).toBeTruthy();

  const vectorResultBody = (await vectorSubmitResponse.json()) as { result: OfficialVectorShiftResult };
  expect(vectorResultBody.result.status).toBe("accepted");
  expect(vectorResultBody.result.resultSummary.sectorsCleared).toBeGreaterThanOrEqual(8);

  await page.goto("/leaderboard?game=vector-shift&window=all_time");
  await expect(page.getByText("No official runs yet for this window.")).toHaveCount(0);
});
