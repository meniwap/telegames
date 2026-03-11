"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createInitialOrbitForgeState,
  stepOrbitForgeState,
  summarizeOrbitForgeState,
  TICK_MS
} from "@telegramplay/game-orbit-forge-core";
import type {
  OfficialOrbitForgeResult,
  OrbitForgePhaseWindow,
  OrbitForgeReplayPayload,
  OrbitForgeSessionConfig,
  OrbitForgeState
} from "@telegramplay/game-orbit-forge-core";
import { OrbitForgeCanvas } from "@telegramplay/game-orbit-forge";
import { Button } from "@telegramplay/ui";

import { waitForAuthenticatedPlayer } from "@/lib/client/player-session";

type StatusTone = "neutral" | "accent" | "success" | "danger";

declare global {
  interface Window {
    __telegramplayOrbitForge?: {
      swap: () => void;
      startPhase: () => void;
      endPhase: () => void;
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
      return "Official orbit session could not be created. Restart and try again.";
    case "submit_session_failed":
      return "Official validation failed to complete. Restart and try again.";
    case "invalid_submission_payload":
      return "The orbit input payload was rejected by the server. Restart and try again.";
    case "session_not_found":
      return "The official orbit session expired before submission. Restart for a fresh run.";
    default:
      return "The official orbit run could not be completed right now. Restart the run and try again.";
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

function toSerializableState(state: OrbitForgeState | null) {
  if (!state) {
    return "{}";
  }

  const summary = summarizeOrbitForgeState(state);
  return JSON.stringify({
    tick: state.tick,
    ring: state.ring,
    gatesCleared: state.gatesCleared,
    shardsCollected: state.shardsCollected,
    phaseActive: state.phaseActive,
    collided: state.collided,
    survivedMs: summary.survivedMs
  });
}

export function OrbitForgePlayClient({
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
  const [gameSession, setGameSession] = useState<OrbitForgeSessionConfig | null>(null);
  const [runState, setRunState] = useState<OrbitForgeState | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialOrbitForgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const swapTicksRef = useRef<number[]>([]);
  const phaseWindowsRef = useRef<OrbitForgePhaseWindow[]>([]);
  const livePhaseStartRef = useRef<number | null>(null);
  const simulationStateRef = useRef<OrbitForgeState | null>(null);
  const swapIndexRef = useRef(0);
  const accumulatorRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const metrics = useMemo(() => {
    if (!runState) {
      return {
        gates: "0",
        shards: "0",
        time: "0.0s",
        phase: "READY"
      };
    }

    const summary = summarizeOrbitForgeState(runState);
    return {
      gates: String(summary.gatesCleared),
      shards: String(summary.shardsCollected),
      time: formatMs(summary.survivedMs),
      phase: runState.phaseActive ? "ON" : "READY"
    };
  }, [runState]);

  const resetRuntime = useCallback((session: OrbitForgeSessionConfig) => {
    const initialState = createInitialOrbitForgeState(session);
    swapTicksRef.current = [];
    phaseWindowsRef.current = [];
    livePhaseStartRef.current = null;
    simulationStateRef.current = initialState;
    swapIndexRef.current = 0;
    accumulatorRef.current = 0;
    lastFrameRef.current = null;
    submittedRef.current = false;
    setRunState(initialState);
    setOfficialResult(null);
    setError(null);
    setIsSubmitting(false);
    setShowHelp(false);
  }, []);

  const commitLivePhaseWindow = useCallback(
    (endTick: number) => {
      const startTick = livePhaseStartRef.current;
      if (startTick === null || !gameSession) {
        return;
      }

      const clampedEnd = Math.min(endTick, startTick + gameSession.payload.course.phaseWindowTicks - 1);
      if (clampedEnd >= startTick) {
        phaseWindowsRef.current.push({
          startTick,
          endTick: clampedEnd
        });
      }
      livePhaseStartRef.current = null;
    },
    [gameSession]
  );

  const buildPhaseWindowsPayload = useCallback(
    (finalTick: number) => {
      const windows = [...phaseWindowsRef.current];
      const liveStart = livePhaseStartRef.current;
      if (liveStart !== null && gameSession) {
        windows.push({
          startTick: liveStart,
          endTick: Math.min(finalTick, liveStart + gameSession.payload.course.phaseWindowTicks - 1)
        });
      }
      return windows;
    },
    [gameSession]
  );

  const completeRun = useCallback(
    async (session: OrbitForgeSessionConfig, finalState: OrbitForgeState) => {
      if (submittedRef.current) {
        return;
      }

      submittedRef.current = true;
      setIsSubmitting(true);
      const summary = summarizeOrbitForgeState(finalState);
      const payload: OrbitForgeReplayPayload = {
        sessionId: session.sessionId,
        configVersion: session.configVersion,
        payload: {
          swapTicks: swapTicksRef.current,
          phaseWindows: buildPhaseWindowsPayload(finalState.tick)
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

        const { result } = (await response.json()) as { result: OfficialOrbitForgeResult };
        setOfficialResult(result);
        setError(null);
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : "submit_session_failed");
      } finally {
        setIsSubmitting(false);
      }
    },
    [buildPhaseWindowsPayload, gameSlug]
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

      while (accumulatorRef.current >= TICK_MS && !nextState.collided && nextState.tick < session.payload.course.maxTicks) {
        const liveStart = livePhaseStartRef.current;
        if (
          liveStart !== null &&
          nextState.tick >= liveStart + session.payload.course.phaseWindowTicks
        ) {
          commitLivePhaseWindow(liveStart + session.payload.course.phaseWindowTicks - 1);
        }

        const shouldSwap =
          swapIndexRef.current < swapTicksRef.current.length && swapTicksRef.current[swapIndexRef.current] === nextState.tick;
        if (shouldSwap) {
          swapIndexRef.current += 1;
        }

        const phaseActive =
          (livePhaseStartRef.current !== null && nextState.tick >= livePhaseStartRef.current) ||
          phaseWindowsRef.current.some((window) => nextState.tick >= window.startTick && nextState.tick <= window.endTick);

        nextState = stepOrbitForgeState(nextState, session, { shouldSwap, phaseActive });
        accumulatorRef.current -= TICK_MS;
      }

      simulationStateRef.current = nextState;
      setRunState(nextState);

      if ((nextState.collided || nextState.tick >= session.payload.course.maxTicks) && !submittedRef.current) {
        if (livePhaseStartRef.current !== null) {
          commitLivePhaseWindow(nextState.tick);
        }
        void completeRun(session, nextState);
      }
    },
    [commitLivePhaseWindow, completeRun, gameSession]
  );

  const queueSwap = useCallback(() => {
    const session = gameSession;
    const state = simulationStateRef.current;

    if (!session || !state || state.collided || submittedRef.current || isSubmitting || officialResult || error) {
      return;
    }

    const lastTick = swapTicksRef.current[swapTicksRef.current.length - 1];
    const scheduledTick = lastTick !== undefined && state.tick <= lastTick ? lastTick + 1 : state.tick;
    if (scheduledTick >= session.payload.course.maxTicks) {
      return;
    }

    swapTicksRef.current = [...swapTicksRef.current, scheduledTick];
  }, [error, gameSession, isSubmitting, officialResult]);

  const startPhase = useCallback(() => {
    const session = gameSession;
    const state = simulationStateRef.current;
    if (!session || !state || state.collided || submittedRef.current || isSubmitting || officialResult || error) {
      return;
    }

    if (livePhaseStartRef.current !== null) {
      return;
    }

    const lastWindow = phaseWindowsRef.current[phaseWindowsRef.current.length - 1];
    if (lastWindow && state.tick <= lastWindow.endTick + 1) {
      return;
    }

    livePhaseStartRef.current = state.tick;
  }, [error, gameSession, isSubmitting, officialResult]);

  const endPhase = useCallback(() => {
    const state = simulationStateRef.current;
    if (state && livePhaseStartRef.current !== null) {
      commitLivePhaseWindow(state.tick);
    }
  }, [commitLivePhaseWindow]);

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

        const data = (await response.json()) as { gameSession: OrbitForgeSessionConfig };
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
      const delta = Math.min(64, timestamp - lastFrameRef.current);
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
      if (event.code === "Space") {
        event.preventDefault();
        queueSwap();
      }
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        event.preventDefault();
        startPhase();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        endPhase();
      }
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [endPhase, queueSwap, startPhase]);

  useEffect(() => {
    window.render_game_to_text = () => toSerializableState(simulationStateRef.current);
    window.advanceTime = (ms: number) => processSimulation(ms);
    window.__telegramplayOrbitForge = {
      swap: queueSwap,
      startPhase,
      endPhase,
      renderGameToText: () => toSerializableState(simulationStateRef.current),
      advanceTime: (ms: number) => processSimulation(ms)
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__telegramplayOrbitForge;
    };
  }, [endPhase, processSimulation, queueSwap, startPhase]);

  const surfaceError = toReadableGameError(error);
  const summary = officialResult ? summarizeOrbitForgeState(runState ?? createInitialOrbitForgeState(gameSession!)) : null;

  return (
    <section
      aria-label={`${gameName} play screen`}
      className="relative flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,var(--surface-elevated),var(--surface-primary)_58%,black)] text-[var(--text-primary)]"
      style={{
        paddingTop: "max(12px, env(safe-area-inset-top))",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))"
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,color-mix(in_srgb,var(--accent-secondary)_18%,transparent),transparent_42%),radial-gradient(circle_at_50%_88%,color-mix(in_srgb,var(--accent-primary)_14%,transparent),transparent_48%)]" />

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
            data-testid="orbit-help"
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
        <CompactMetric label="Gates" value={metrics.gates} />
        <CompactMetric label="Shards" value={metrics.shards} />
        <CompactMetric label="Time" value={metrics.time} />
        <CompactMetric label="Phase" value={metrics.phase} />
      </div>

      <div className="relative z-10 min-h-0 flex-1 px-4 pb-3 pt-3">
        {gameSession && runState ? (
          <OrbitForgeCanvas config={gameSession} state={runState} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_88%,black_12%)] text-sm text-[var(--text-muted)]">
            Allocating official orbit session...
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
                ? `${officialResult.resultSummary.shardsCollected} shards · ${officialResult.rewards.map((reward) => `+${reward.amount} ${reward.entryType}`).join(" · ")}`
                : "The server rejected this run. Restart for a fresh session."}
            </p>
          </div>
        ) : (
          <div className={`rounded-[22px] border px-4 py-3 shadow-[var(--shadow-soft)] ${getStatusToneClasses(isSubmitting ? "accent" : "neutral")}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">
              {isSubmitting ? "Submitting" : "Official Run"}
            </p>
            <p className="mt-2 font-display text-[1.2rem] tracking-[0.08em] text-[var(--text-primary)]">
              {isSubmitting ? "Verifying orbit..." : "Swap rings. Phase through hazard arcs."}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {summary ? `${summary.gatesCleared} gates · ${summary.shardsCollected} shards` : "Tap swap to change rings. Hold phase to cross one hot gate."}
            </p>
          </div>
        )}
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-3 px-4">
        <Button
          data-testid="orbit-swap"
          className="h-20 text-lg"
          onClick={queueSwap}
          disabled={!gameSession || isSubmitting || Boolean(officialResult)}
        >
          Swap Ring
        </Button>
        <Button
          data-testid="orbit-phase"
          variant="secondary"
          className="h-20 text-lg"
          onPointerDown={startPhase}
          onPointerUp={endPhase}
          onPointerCancel={endPhase}
          onPointerLeave={endPhase}
          disabled={!gameSession || isSubmitting || Boolean(officialResult)}
        >
          Hold Phase
        </Button>
      </div>

      {showHelp ? (
        <div className="absolute inset-0 z-20 flex items-end bg-[rgba(0,0,0,0.56)] p-4">
          <div className="w-full rounded-[26px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--surface-elevated)_94%,black_6%)] p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">Control Model</p>
                <h2 className="font-display text-[1.5rem] tracking-[0.08em] text-[var(--text-primary)]">Orbit survival</h2>
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
              <p>Tap <span className="font-semibold text-[var(--text-primary)]">Swap Ring</span> to jump between the inner and outer orbit.</p>
              <p>Hold <span className="font-semibold text-[var(--text-primary)]">Phase</span> to cross one hazard arc and steal shards from hot lanes.</p>
              <p>Official rewards and leaderboard placement come only from the server-verified replay.</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
