"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createInitialPrismBreakState,
  stepPrismBreakState,
  summarizePrismBreakState,
  TICK_MS
} from "@telegramplay/game-prism-break-core";
import type {
  OfficialPrismBreakResult,
  PrismBreakLane,
  PrismBreakMagnetWindow,
  PrismBreakReplayPayload,
  PrismBreakSessionConfig,
  PrismBreakState
} from "@telegramplay/game-prism-break-core";
import { PrismBreakCanvas } from "@telegramplay/game-prism-break";
import { Button } from "@telegramplay/ui";

import { waitForAuthenticatedPlayer } from "@/lib/client/player-session";

type StatusTone = "neutral" | "accent" | "success" | "danger";

declare global {
  interface Window {
    __telegramplayPrismBreak?: {
      setLane: (lane: PrismBreakLane) => void;
      startCatch: () => void;
      endCatch: () => void;
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
      return "Official prism chamber could not be created. Restart and try again.";
    case "submit_session_failed":
      return "Official validation failed to complete. Restart and try again.";
    case "invalid_submission_payload":
      return "The prism input payload was rejected by the server. Restart and try again.";
    case "session_not_found":
      return "The official prism session expired before submission. Restart for a fresh run.";
    default:
      return "The official chamber run could not be completed right now. Restart the run and try again.";
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

function toSerializableState(state: PrismBreakState | null) {
  if (!state) {
    return "{}";
  }

  const summary = summarizePrismBreakState(state);
  return JSON.stringify({
    tick: state.tick,
    deflectorLane: state.deflectorLane,
    ballX: Math.round(state.ballX),
    ballY: Math.round(state.ballY),
    attached: state.attached,
    prismsLeft: state.prisms.length,
    prismsShattered: state.prismsShattered,
    chainBursts: state.chainBursts,
    survivedMs: summary.survivedMs
  });
}

export function PrismBreakPlayClient({
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
  const [gameSession, setGameSession] = useState<PrismBreakSessionConfig | null>(null);
  const [runState, setRunState] = useState<PrismBreakState | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialPrismBreakResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deflectorChangesRef = useRef<Array<{ tick: number; lane: PrismBreakLane }>>([]);
  const magnetWindowsRef = useRef<PrismBreakMagnetWindow[]>([]);
  const liveMagnetStartRef = useRef<number | null>(null);
  const simulationStateRef = useRef<PrismBreakState | null>(null);
  const changeIndexRef = useRef(0);
  const accumulatorRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const metrics = useMemo(() => {
    if (!runState) {
      return {
        prisms: "0",
        chains: "0",
        time: "0.0s",
        catch: "READY"
      };
    }

    const summary = summarizePrismBreakState(runState);
    return {
      prisms: String(summary.prismsShattered),
      chains: String(summary.chainBursts),
      time: formatMs(summary.survivedMs),
      catch: liveMagnetStartRef.current !== null ? "LIVE" : runState.attached ? "LOCK" : "READY"
    };
  }, [runState]);

  const resetRuntime = useCallback((session: PrismBreakSessionConfig) => {
    const initialState = createInitialPrismBreakState(session);
    deflectorChangesRef.current = [];
    magnetWindowsRef.current = [];
    liveMagnetStartRef.current = null;
    simulationStateRef.current = initialState;
    changeIndexRef.current = 0;
    accumulatorRef.current = 0;
    lastFrameRef.current = null;
    submittedRef.current = false;
    setRunState(initialState);
    setOfficialResult(null);
    setError(null);
    setIsSubmitting(false);
    setShowHelp(false);
  }, []);

  const commitLiveMagnetWindow = useCallback(
    (endTick: number) => {
      const startTick = liveMagnetStartRef.current;
      if (startTick === null || !gameSession) {
        return;
      }

      const clampedEnd = Math.min(endTick, startTick + gameSession.payload.chamber.magnetMaxTicks - 1);
      if (clampedEnd >= startTick) {
        magnetWindowsRef.current.push({
          startTick,
          endTick: clampedEnd
        });
      }
      liveMagnetStartRef.current = null;
    },
    [gameSession]
  );

  const buildMagnetWindowsPayload = useCallback(
    (finalTick: number) => {
      const windows = [...magnetWindowsRef.current];
      const liveStart = liveMagnetStartRef.current;
      if (liveStart !== null && gameSession) {
        windows.push({
          startTick: liveStart,
          endTick: Math.min(finalTick, liveStart + gameSession.payload.chamber.magnetMaxTicks - 1)
        });
      }
      return windows;
    },
    [gameSession]
  );

  const completeRun = useCallback(
    async (session: PrismBreakSessionConfig, finalState: PrismBreakState) => {
      if (submittedRef.current) {
        return;
      }

      submittedRef.current = true;
      setIsSubmitting(true);
      const summary = summarizePrismBreakState(finalState);
      const payload: PrismBreakReplayPayload = {
        sessionId: session.sessionId,
        configVersion: session.configVersion,
        payload: {
          deflectorChanges: deflectorChangesRef.current,
          magnetWindows: buildMagnetWindowsPayload(finalState.tick)
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

        const { result } = (await response.json()) as { result: OfficialPrismBreakResult };
        setOfficialResult(result);
        setError(null);
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : "submit_session_failed");
      } finally {
        setIsSubmitting(false);
      }
    },
    [buildMagnetWindowsPayload, gameSlug]
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

      while (accumulatorRef.current >= TICK_MS && !nextState.missed && nextState.tick < session.payload.chamber.maxTicks) {
        const liveStart = liveMagnetStartRef.current;
        if (
          liveStart !== null &&
          nextState.tick >= liveStart + session.payload.chamber.magnetMaxTicks
        ) {
          commitLiveMagnetWindow(liveStart + session.payload.chamber.magnetMaxTicks - 1);
        }

        const scheduled = deflectorChangesRef.current[changeIndexRef.current];
        const laneChange = scheduled && scheduled.tick === nextState.tick ? scheduled.lane : null;
        if (laneChange !== null) {
          changeIndexRef.current += 1;
        }

        const magnetActive =
          (liveMagnetStartRef.current !== null && nextState.tick >= liveMagnetStartRef.current) ||
          magnetWindowsRef.current.some((window) => nextState.tick >= window.startTick && nextState.tick <= window.endTick);

        nextState = stepPrismBreakState(nextState, session, { laneChange, magnetActive });
        accumulatorRef.current -= TICK_MS;
      }

      simulationStateRef.current = nextState;
      setRunState(nextState);

      if ((nextState.missed || nextState.tick >= session.payload.chamber.maxTicks) && !submittedRef.current) {
        if (liveMagnetStartRef.current !== null) {
          commitLiveMagnetWindow(nextState.tick);
        }
        void completeRun(session, nextState);
      }
    },
    [commitLiveMagnetWindow, completeRun, gameSession]
  );

  const queueLane = useCallback(
    (lane: PrismBreakLane) => {
      const session = gameSession;
      const state = simulationStateRef.current;

      if (!session || !state || state.missed || submittedRef.current || isSubmitting || officialResult || error) {
        return;
      }

      const last = deflectorChangesRef.current[deflectorChangesRef.current.length - 1];
      const scheduledTick = last && state.tick <= last.tick ? last.tick + 1 : state.tick;
      if (scheduledTick >= session.payload.chamber.maxTicks) {
        return;
      }

      deflectorChangesRef.current = [...deflectorChangesRef.current, { tick: scheduledTick, lane }];
    },
    [error, gameSession, isSubmitting, officialResult]
  );

  const startCatch = useCallback(() => {
    const session = gameSession;
    const state = simulationStateRef.current;
    if (!session || !state || state.missed || submittedRef.current || isSubmitting || officialResult || error) {
      return;
    }

    if (liveMagnetStartRef.current !== null) {
      return;
    }

    const lastWindow = magnetWindowsRef.current[magnetWindowsRef.current.length - 1];
    if (lastWindow && state.tick <= lastWindow.endTick + 1) {
      return;
    }

    liveMagnetStartRef.current = state.tick;
  }, [error, gameSession, isSubmitting, officialResult]);

  const endCatch = useCallback(() => {
    const state = simulationStateRef.current;
    if (state && liveMagnetStartRef.current !== null) {
      commitLiveMagnetWindow(state.tick);
    }
  }, [commitLiveMagnetWindow]);

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

        const data = (await response.json()) as { gameSession: PrismBreakSessionConfig };
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
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        queueLane(0);
      }
      if (event.code === "ArrowUp") {
        event.preventDefault();
        queueLane(1);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        queueLane(2);
      }
      if (event.code === "Space") {
        event.preventDefault();
        startCatch();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        endCatch();
      }
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [endCatch, queueLane, startCatch]);

  useEffect(() => {
    window.render_game_to_text = () => toSerializableState(simulationStateRef.current);
    window.advanceTime = (ms: number) => processSimulation(ms);
    window.__telegramplayPrismBreak = {
      setLane: queueLane,
      startCatch,
      endCatch,
      renderGameToText: () => toSerializableState(simulationStateRef.current),
      advanceTime: (ms: number) => processSimulation(ms)
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__telegramplayPrismBreak;
    };
  }, [endCatch, processSimulation, queueLane, startCatch]);

  const surfaceError = toReadableGameError(error);
  const summary = runState ? summarizePrismBreakState(runState) : null;

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
            data-testid="prism-help"
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
        <CompactMetric label="Prisms" value={metrics.prisms} />
        <CompactMetric label="Chains" value={metrics.chains} />
        <CompactMetric label="Time" value={metrics.time} />
        <CompactMetric label="Catch" value={metrics.catch} />
      </div>

      <div className="relative z-10 min-h-0 flex-1 px-4 pb-3 pt-3">
        {gameSession && runState ? (
          <PrismBreakCanvas config={gameSession} state={runState} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_88%,black_12%)] text-sm text-[var(--text-muted)]">
            Allocating official prism chamber...
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
                ? `${officialResult.resultSummary.chainBursts} burst chain · ${officialResult.rewards.map((reward) => `+${reward.amount} ${reward.entryType}`).join(" · ")}`
                : "The server rejected this chamber run. Restart for a fresh session."}
            </p>
          </div>
        ) : (
          <div className={`rounded-[22px] border px-4 py-3 shadow-[var(--shadow-soft)] ${getStatusToneClasses(isSubmitting ? "accent" : "neutral")}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">
              {isSubmitting ? "Submitting" : "Official Run"}
            </p>
            <p className="mt-2 font-display text-[1.2rem] tracking-[0.08em] text-[var(--text-primary)]">
              {isSubmitting ? "Verifying chamber..." : "Tap a lane to launch or redirect the core."}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {summary ? `${summary.prismsShattered} prisms shattered · ${summary.chainBursts} chain bursts` : "Hold Catch to magnet-lock the ball for a controlled relaunch."}
            </p>
          </div>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-2 px-4">
        <Button data-testid="prism-left" className="h-16 text-base" onClick={() => queueLane(0)} disabled={!gameSession || isSubmitting || Boolean(officialResult)}>
          Left
        </Button>
        <Button data-testid="prism-center" className="h-16 text-base" onClick={() => queueLane(1)} disabled={!gameSession || isSubmitting || Boolean(officialResult)}>
          Center
        </Button>
        <Button data-testid="prism-right" className="h-16 text-base" onClick={() => queueLane(2)} disabled={!gameSession || isSubmitting || Boolean(officialResult)}>
          Right
        </Button>
      </div>
      <div className="relative z-10 px-4 pt-2">
        <Button
          data-testid="prism-catch"
          variant="secondary"
          className="h-18 w-full text-lg"
          onPointerDown={startCatch}
          onPointerUp={endCatch}
          onPointerCancel={endCatch}
          onPointerLeave={endCatch}
          disabled={!gameSession || isSubmitting || Boolean(officialResult)}
        >
          Hold to Catch
        </Button>
      </div>

      {showHelp ? (
        <div className="absolute inset-0 z-20 flex items-end bg-[rgba(0,0,0,0.56)] p-4">
          <div className="w-full rounded-[26px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--surface-elevated)_94%,black_6%)] p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">Control Model</p>
                <h2 className="font-display text-[1.5rem] tracking-[0.08em] text-[var(--text-primary)]">Prism chamber</h2>
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
              <p>Tap <span className="font-semibold text-[var(--text-primary)]">Left</span>, <span className="font-semibold text-[var(--text-primary)]">Center</span>, or <span className="font-semibold text-[var(--text-primary)]">Right</span> to move the deflector before impact.</p>
              <p>Hold <span className="font-semibold text-[var(--text-primary)]">Catch</span> to magnet-lock the core and relaunch with a cleaner line.</p>
              <p>Official scores and rewards come only from the server-verified chamber replay.</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
