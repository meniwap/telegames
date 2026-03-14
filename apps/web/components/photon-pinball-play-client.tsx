"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createInitialPhotonPinballState,
  stepPhotonPinballState,
  summarizePhotonPinballState,
  TICK_MS
} from "@telegramplay/game-photon-pinball-core";
import type {
  OfficialPhotonPinballResult,
  PhotonPinballNudgeWindow,
  PhotonPinballReplayPayload,
  PhotonPinballSessionConfig,
  PhotonPinballState
} from "@telegramplay/game-photon-pinball-core";
import { PhotonPinballCanvas } from "@telegramplay/game-photon-pinball";
import { Button } from "@telegramplay/ui";

import { waitForAuthenticatedPlayer } from "@/lib/client/player-session";

type StatusTone = "neutral" | "accent" | "success" | "danger";
type FlipperSide = "left" | "right";

declare global {
  interface Window {
    __telegramplayPhotonPinball?: {
      flipLeft: () => void;
      flipRight: () => void;
      startNudge: () => void;
      endNudge: () => void;
      renderGameToText: () => string;
      advanceTime: (ms: number) => void;
    };
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function toReadableGameError(message: string | null) {
  if (!message) {
    return null;
  }

  switch (message) {
    case "telegram_auth_pending":
      return "Telegram authentication did not finish in time. Close the Mini App and reopen it from the bot.";
    case "create_session_failed":
      return "Official pinball session could not be created. Restart and try again.";
    case "submit_session_failed":
      return "Official validation failed to complete. Restart and try again.";
    case "invalid_submission_payload":
      return "The pinball input payload was rejected by the server. Restart and try again.";
    case "session_not_found":
      return "The official pinball session expired before submission. Restart for a fresh run.";
    default:
      return "The official pinball run could not be completed right now. Restart the run and try again.";
  }
}

function getStatusToneClasses(tone: StatusTone) {
  switch (tone) {
    case "accent":
      return "border-[color-mix(in_srgb,var(--accent-secondary)_38%,transparent_62%)] bg-[color-mix(in_srgb,var(--accent-secondary)_10%,var(--hud-bg)_90%)]";
    case "success":
      return "border-[color-mix(in_srgb,var(--accent-success)_40%,transparent_60%)] bg-[color-mix(in_srgb,var(--accent-success)_12%,var(--hud-bg)_88%)]";
    case "danger":
      return "border-[color-mix(in_srgb,var(--accent-danger)_42%,transparent_58%)] bg-[color-mix(in_srgb,var(--accent-danger)_12%,var(--hud-bg)_88%)]";
    default:
      return "border-[var(--hud-border)] bg-[var(--hud-bg)]";
  }
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_88%,black_12%)] px-2.5 py-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
      <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">{label}</p>
      <p
        className="mt-0.5 font-display text-[1.38rem] leading-none font-semibold tracking-[0.06em] text-[var(--text-primary)] whitespace-nowrap"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function toSerializableState(state: PhotonPinballState | null) {
  if (!state) {
    return "{}";
  }

  const summary = summarizePhotonPinballState(state);
  return JSON.stringify({
    tick: state.tick,
    ballActive: state.ballActive,
    ballX: Math.round(state.ballX),
    ballY: Math.round(state.ballY),
    score: summary.score,
    jackpotsClaimed: summary.jackpotsClaimed,
    comboPeak: summary.comboPeak,
    ballsRemaining: state.ballsRemaining,
    ballsDrained: summary.ballsDrained,
    survivedMs: summary.survivedMs
  });
}

function isFlipActiveAtTick(ticks: number[], tick: number, windowTicks: number) {
  for (let index = ticks.length - 1; index >= 0; index -= 1) {
    const trigger = ticks[index]!;
    if (trigger > tick) {
      continue;
    }
    if (tick <= trigger + windowTicks - 1) {
      return true;
    }
    if (tick - trigger > windowTicks) {
      return false;
    }
  }
  return false;
}

function isNudgeActiveAtTick(windows: PhotonPinballNudgeWindow[], tick: number) {
  return windows.some((window) => tick >= window.startTick && tick <= window.endTick);
}

export function PhotonPinballPlayClient({
  gameSlug,
  gameName,
  hasSession
}: {
  gameSlug: string;
  gameName: string;
  hasSession: boolean;
}) {
  const router = useRouter();
  const [restartNonce, setRestartNonce] = useState(0);
  const [gameSession, setGameSession] = useState<PhotonPinballSessionConfig | null>(null);
  const [runState, setRunState] = useState<PhotonPinballState | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialPhotonPinballResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const leftFlipTicksRef = useRef<number[]>([]);
  const rightFlipTicksRef = useRef<number[]>([]);
  const nudgeWindowsRef = useRef<PhotonPinballNudgeWindow[]>([]);
  const liveNudgeStartRef = useRef<number | null>(null);
  const simulationStateRef = useRef<PhotonPinballState | null>(null);
  const accumulatorRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const metrics = useMemo(() => {
    if (!runState) {
      return {
        score: "0",
        balls: "3",
        combo: "x0",
        time: "0.0s"
      };
    }

    const summary = summarizePhotonPinballState(runState);
    return {
      score: String(summary.score),
      balls: String(runState.ballsRemaining),
      combo: `x${runState.comboPeak}`,
      time: formatMs(summary.survivedMs)
    };
  }, [runState]);

  const resetRuntime = useCallback((session: PhotonPinballSessionConfig) => {
    const initialState = createInitialPhotonPinballState(session);
    leftFlipTicksRef.current = [];
    rightFlipTicksRef.current = [];
    nudgeWindowsRef.current = [];
    liveNudgeStartRef.current = null;
    simulationStateRef.current = initialState;
    accumulatorRef.current = 0;
    lastFrameRef.current = null;
    submittedRef.current = false;
    setRunState(initialState);
    setOfficialResult(null);
    setError(null);
    setIsSubmitting(false);
    setShowHelp(false);
  }, []);

  const commitLiveNudgeWindow = useCallback(
    (endTick: number) => {
      const startTick = liveNudgeStartRef.current;
      if (startTick === null || !gameSession) {
        return;
      }

      const clampedEnd = Math.min(endTick, startTick + gameSession.payload.table.nudgeMaxTicks - 1);
      if (clampedEnd >= startTick) {
        nudgeWindowsRef.current.push({
          startTick,
          endTick: clampedEnd
        });
      }
      liveNudgeStartRef.current = null;
    },
    [gameSession]
  );

  const buildNudgeWindowsPayload = useCallback(
    (finalTick: number) => {
      const windows = [...nudgeWindowsRef.current];
      const liveStart = liveNudgeStartRef.current;
      if (liveStart !== null && gameSession) {
        windows.push({
          startTick: liveStart,
          endTick: Math.min(finalTick, liveStart + gameSession.payload.table.nudgeMaxTicks - 1)
        });
      }
      return windows;
    },
    [gameSession]
  );

  const completeRun = useCallback(
    async (session: PhotonPinballSessionConfig, finalState: PhotonPinballState) => {
      if (submittedRef.current) {
        return;
      }

      submittedRef.current = true;
      setIsSubmitting(true);
      const summary = summarizePhotonPinballState(finalState);
      const payload: PhotonPinballReplayPayload = {
        sessionId: session.sessionId,
        configVersion: session.configVersion,
        payload: {
          leftFlipTicks: leftFlipTicksRef.current,
          rightFlipTicks: rightFlipTicksRef.current,
          nudgeWindows: buildNudgeWindowsPayload(finalState.tick)
        },
        clientSummary: {
          elapsedMs: summary.survivedMs,
          reportedPlacement: 1,
          reportedScoreSortValue: summary.scoreSortValue,
          reportedDisplayValue: summary.displayValue
        }
      };

      try {
        const response = await fetch(`/api/games/${gameSlug}/sessions/${session.sessionId}/submissions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "submit_session_failed");
        }

        const { result } = (await response.json()) as { result: OfficialPhotonPinballResult };
        setOfficialResult(result);
        setError(null);
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : "submit_session_failed");
      } finally {
        setIsSubmitting(false);
      }
    },
    [buildNudgeWindowsPayload, gameSlug]
  );

  const processSimulation = useCallback(
    (deltaMs: number) => {
      const session = gameSession;
      const currentState = simulationStateRef.current;

      if (!session || !currentState || submittedRef.current) {
        return;
      }

      accumulatorRef.current += deltaMs;
      let nextState = currentState;

      while (accumulatorRef.current >= TICK_MS && !nextState.finishReason) {
        const liveStart = liveNudgeStartRef.current;
        if (liveStart !== null && nextState.tick >= liveStart + session.payload.table.nudgeMaxTicks) {
          commitLiveNudgeWindow(liveStart + session.payload.table.nudgeMaxTicks - 1);
        }

        nextState = stepPhotonPinballState(nextState, session, {
          leftFlip: isFlipActiveAtTick(leftFlipTicksRef.current, nextState.tick, session.payload.table.flipperWindowTicks),
          rightFlip: isFlipActiveAtTick(rightFlipTicksRef.current, nextState.tick, session.payload.table.flipperWindowTicks),
          nudge:
            (liveNudgeStartRef.current !== null && nextState.tick >= liveNudgeStartRef.current) ||
            isNudgeActiveAtTick(nudgeWindowsRef.current, nextState.tick)
        });
        accumulatorRef.current -= TICK_MS;
      }

      simulationStateRef.current = nextState;
      setRunState(nextState);

      if (nextState.finishReason && !submittedRef.current) {
        if (liveNudgeStartRef.current !== null) {
          commitLiveNudgeWindow(nextState.tick);
        }
        void completeRun(session, nextState);
      }
    },
    [commitLiveNudgeWindow, completeRun, gameSession]
  );

  const queueFlip = useCallback(
    (side: FlipperSide) => {
      const session = gameSession;
      const state = simulationStateRef.current;

      if (!session || !state || state.finishReason || submittedRef.current || isSubmitting || officialResult || error) {
        return;
      }

      const targetRef = side === "left" ? leftFlipTicksRef : rightFlipTicksRef;
      const lastTick = targetRef.current[targetRef.current.length - 1];
      const scheduledTick = lastTick !== undefined && state.tick <= lastTick ? lastTick + 1 : state.tick;
      if (scheduledTick >= session.payload.table.maxTicks) {
        return;
      }

      targetRef.current = [...targetRef.current, scheduledTick];
    },
    [error, gameSession, isSubmitting, officialResult]
  );

  const startNudge = useCallback(() => {
    const session = gameSession;
    const state = simulationStateRef.current;
    if (!session || !state || state.finishReason || submittedRef.current || isSubmitting || officialResult || error) {
      return;
    }

    if (liveNudgeStartRef.current !== null) {
      return;
    }

    const lastWindow = nudgeWindowsRef.current[nudgeWindowsRef.current.length - 1];
    if (lastWindow && state.tick <= lastWindow.endTick + 1) {
      return;
    }

    liveNudgeStartRef.current = state.tick;
  }, [error, gameSession, isSubmitting, officialResult]);

  const endNudge = useCallback(() => {
    const state = simulationStateRef.current;
    if (state && liveNudgeStartRef.current !== null) {
      commitLiveNudgeWindow(state.tick);
    }
  }, [commitLiveNudgeWindow]);

  useEffect(() => {
    let cancelled = false;

    const createOfficialSession = async () => {
      if (!hasSession) {
        const ready = await waitForAuthenticatedPlayer();
        if (!ready) {
          throw new Error("telegram_auth_pending");
        }
      }

      const response = await fetch(`/api/games/${gameSlug}/sessions`, { method: "POST" });
      if (response.status === 401) {
        const ready = await waitForAuthenticatedPlayer();
        if (!ready) {
          throw new Error("telegram_auth_pending");
        }

        return fetch(`/api/games/${gameSlug}/sessions`, { method: "POST" });
      }

      return response;
    };

    void createOfficialSession()
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "create_session_failed");
        }

        const data = (await response.json()) as { gameSession: PhotonPinballSessionConfig };
        if (!cancelled) {
          setGameSession(data.gameSession);
          resetRuntime(data.gameSession);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "create_session_failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [gameSlug, hasSession, resetRuntime, restartNonce]);

  useEffect(() => {
    if (!gameSession || !runState) {
      return;
    }

    const loop = (timestamp: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }
      const delta = Math.min(48, timestamp - lastFrameRef.current);
      lastFrameRef.current = timestamp;
      processSimulation(delta);
      rafRef.current = window.requestAnimationFrame(loop);
    };

    rafRef.current = window.requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      lastFrameRef.current = null;
    };
  }, [gameSession, processSimulation, runState]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        event.preventDefault();
        queueFlip("left");
      }
      if (event.code === "ArrowRight" || event.code === "KeyD") {
        event.preventDefault();
        queueFlip("right");
      }
      if (event.code === "Space") {
        event.preventDefault();
        startNudge();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        endNudge();
      }
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [endNudge, queueFlip, startNudge]);

  useEffect(() => {
    window.render_game_to_text = () => toSerializableState(simulationStateRef.current);
    window.advanceTime = (ms: number) => processSimulation(ms);
    window.__telegramplayPhotonPinball = {
      flipLeft: () => queueFlip("left"),
      flipRight: () => queueFlip("right"),
      startNudge,
      endNudge,
      renderGameToText: () => toSerializableState(simulationStateRef.current),
      advanceTime: (ms: number) => processSimulation(ms)
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__telegramplayPhotonPinball;
    };
  }, [endNudge, processSimulation, queueFlip, startNudge]);

  const surfaceError = toReadableGameError(error);
  const summary = runState ? summarizePhotonPinballState(runState) : null;

  return (
    <section
      aria-label={`${gameName} play screen`}
      className="relative flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,var(--surface-elevated),var(--surface-primary)_58%,black)] text-[var(--text-primary)]"
      style={{
        paddingTop: "max(12px, env(safe-area-inset-top))",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))"
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,color-mix(in_srgb,var(--accent-secondary)_16%,transparent),transparent_44%),radial-gradient(circle_at_50%_86%,color-mix(in_srgb,var(--accent-primary)_14%,transparent),transparent_52%)]" />

      <div className="relative z-10 flex items-start justify-between gap-3 px-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            className="h-10 min-w-10 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
            onClick={() => router.push(`/games/${gameSlug}`)}
            aria-label="Back to game detail"
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            <span className="sr-only">Back</span>
          </Button>
          <div className="rounded-[22px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_92%,black_8%)] px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
            <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[var(--accent-secondary)]">Play</p>
            <h1 className="font-display text-[1.1rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">{gameName}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            data-testid="pinball-help"
            variant="ghost"
            className="h-10 min-w-10 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
            onClick={() => setShowHelp(true)}
            aria-label="Game help"
            icon={<CircleHelp className="h-4 w-4" />}
          >
            <span className="sr-only">Help</span>
          </Button>
          <Button
            variant="ghost"
            className="h-10 min-w-10 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
            onClick={() => setRestartNonce((value) => value + 1)}
            aria-label="Restart run"
            icon={<RotateCcw className="h-4 w-4" />}
          >
            <span className="sr-only">Restart</span>
          </Button>
        </div>
      </div>

      <div className="relative z-10 mt-3 grid grid-cols-4 gap-2 px-4">
        <CompactMetric label="Score" value={metrics.score} />
        <CompactMetric label="Balls" value={metrics.balls} />
        <CompactMetric label="Combo" value={metrics.combo} />
        <CompactMetric label="Time" value={metrics.time} />
      </div>

      <div className="relative z-10 min-h-0 flex-1 px-4 pb-3 pt-3">
        {gameSession && runState ? (
          <PhotonPinballCanvas config={gameSession} state={runState} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_88%,black_12%)] text-sm text-[var(--text-muted)]">
            Allocating official pinball table...
          </div>
        )}
      </div>

      <div className="relative z-10 px-4 pb-3">
        {surfaceError ? (
          <div className={`rounded-[22px] border px-4 py-3 shadow-[var(--shadow-soft)] ${getStatusToneClasses("danger")}`}>
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-danger)]" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">Run Error</p>
                <p className="mt-2 text-sm text-[var(--text-primary)]">{surfaceError}</p>
              </div>
            </div>
          </div>
        ) : officialResult ? (
          <div className={`rounded-[22px] border px-4 py-3 shadow-[var(--shadow-soft)] ${getStatusToneClasses(officialResult.status === "accepted" ? "success" : "danger")}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">
              {officialResult.status === "accepted" ? "Official Result" : "Run Rejected"}
            </p>
            <p className="mt-2 font-display text-[1.3rem] tracking-[0.08em] text-[var(--text-primary)]">{officialResult.displayValue}</p>
            <p className="text-sm text-[var(--text-muted)]">
              {officialResult.status === "accepted"
                ? `${officialResult.resultSummary.comboPeak} combo peak · ${officialResult.rewards.map((reward) => `+${reward.amount} ${reward.entryType}`).join(" · ")}`
                : "The server rejected this table run. Restart for a fresh session."}
            </p>
          </div>
        ) : (
          <div className={`rounded-[22px] border px-4 py-3 shadow-[var(--shadow-soft)] ${getStatusToneClasses(isSubmitting ? "accent" : "neutral")}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">
              {isSubmitting ? "Submitting" : "Official Run"}
            </p>
            <p className="mt-2 font-display text-[1.2rem] tracking-[0.08em] text-[var(--text-primary)]">
              {isSubmitting ? "Verifying table..." : "Flip left or right. Hold Nudge when the ball threatens the drain."}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {summary
                ? `${summary.score} pts · ${summary.jackpotsClaimed} jackpots · ${summary.ballsDrained}/${gameSession?.payload.table.ballCount ?? 3} drains`
                : "Three official balls. Score, jackpots, and rewards are finalized only by the server replay."}
            </p>
          </div>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] gap-2 px-4">
        <Button
          data-testid="pinball-left"
          className="h-16 text-base"
          onClick={() => queueFlip("left")}
          disabled={!gameSession || isSubmitting || Boolean(officialResult)}
        >
          Left Flipper
        </Button>
        <Button
          data-testid="pinball-nudge"
          variant="secondary"
          className="h-16 min-w-28 px-4 text-sm"
          onPointerDown={startNudge}
          onPointerUp={endNudge}
          onPointerCancel={endNudge}
          onPointerLeave={endNudge}
          disabled={!gameSession || isSubmitting || Boolean(officialResult)}
        >
          Hold Nudge
        </Button>
        <Button
          data-testid="pinball-right"
          className="h-16 text-base"
          onClick={() => queueFlip("right")}
          disabled={!gameSession || isSubmitting || Boolean(officialResult)}
        >
          Right Flipper
        </Button>
      </div>

      {showHelp ? (
        <div className="absolute inset-0 z-20 flex items-end bg-[rgba(0,0,0,0.56)] p-4">
          <div className="w-full rounded-[26px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--surface-elevated)_94%,black_6%)] p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">Control Model</p>
                <h2 className="font-display text-[1.5rem] tracking-[0.08em] text-[var(--text-primary)]">Photon table</h2>
              </div>
              <Button
                variant="ghost"
                className="h-10 min-w-10 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
                onClick={() => setShowHelp(false)}
                aria-label="Close help"
                icon={<X className="h-4 w-4" />}
              >
                <span className="sr-only">Close help</span>
              </Button>
            </div>
            <div className="space-y-3 text-sm text-[var(--text-muted)]">
              <p>Tap <span className="font-semibold text-[var(--text-primary)]">Left Flipper</span> or <span className="font-semibold text-[var(--text-primary)]">Right Flipper</span> to redirect the ball back up the table.</p>
              <p>Hold <span className="font-semibold text-[var(--text-primary)]">Nudge</span> for a short shove when the ball threatens the center drain.</p>
              <p>Every official run is three balls long. Score, jackpots, combos, and rewards are finalized only by the server replay.</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
