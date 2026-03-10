"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createInitialHopperState,
  stepHopperState,
  summarizeHopperState,
  TICK_MS
} from "@telegramplay/game-hopper-core";
import type {
  HopperReplayPayload,
  HopperSessionConfig,
  HopperState,
  OfficialHopperResult
} from "@telegramplay/game-hopper-core";
import { HopperCanvas } from "@telegramplay/game-hopper";
import { Button } from "@telegramplay/ui";

import { waitForAuthenticatedPlayer } from "@/lib/client/player-session";

type StatusTone = "neutral" | "accent" | "success" | "danger";

declare global {
  interface Window {
    __telegramplayHopper?: {
      flap: () => void;
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
      return "Official session could not be created. Restart and try again.";
    case "submit_session_failed":
      return "Official validation failed to complete. Restart and try again.";
    case "invalid_submission_payload":
      return "The hop payload was rejected by the server. Restart and try again.";
    case "session_not_found":
      return "The official session expired before submission. Restart to get a fresh run.";
    default:
      return "The official run could not be completed right now. Restart the run and try again.";
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
        className="mt-0.5 font-display text-[1.42rem] font-semibold tracking-[0.06em] leading-none text-[var(--text-primary)] whitespace-nowrap"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function toSerializableState(state: HopperState | null) {
  if (!state) {
    return "{}";
  }

  const summary = summarizeHopperState(state);
  return JSON.stringify({
    tick: state.tick,
    gatesCleared: state.gatesCleared,
    collided: state.collided,
    birdY: Math.round(state.birdY),
    velocity: Math.round(state.birdVelocity),
    survivedMs: summary.survivedMs
  });
}

export function HopperPlayClient({
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
  const [gameSession, setGameSession] = useState<HopperSessionConfig | null>(null);
  const [runState, setRunState] = useState<HopperState | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialHopperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const flapTicksRef = useRef<number[]>([]);
  const simulationStateRef = useRef<HopperState | null>(null);
  const flapIndexRef = useRef(0);
  const accumulatorRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const metrics = useMemo(() => {
    if (!runState) {
      return {
        gates: "0",
        speed: "0",
        time: "0.0s"
      };
    }

    const summary = summarizeHopperState(runState);
    const speed = gameSession
      ? Math.round(
          Math.min(
            gameSession.payload.course.baseSpeed + runState.gatesCleared * gameSession.payload.course.speedRamp,
            gameSession.payload.course.maxSpeed
          )
        )
      : 0;

    return {
      gates: String(runState.gatesCleared),
      speed: String(speed),
      time: formatMs(summary.survivedMs)
    };
  }, [gameSession, runState]);

  const resetRuntime = useCallback((session: HopperSessionConfig) => {
    const initialState = createInitialHopperState(session);
    flapTicksRef.current = [];
    simulationStateRef.current = initialState;
    flapIndexRef.current = 0;
    accumulatorRef.current = 0;
    lastFrameRef.current = null;
    submittedRef.current = false;
    setRunState(initialState);
    setOfficialResult(null);
    setError(null);
    setIsSubmitting(false);
    setShowHelp(false);
  }, []);

  const completeRun = useCallback(
    async (session: HopperSessionConfig, finalState: HopperState) => {
      if (submittedRef.current) {
        return;
      }

      submittedRef.current = true;
      setIsSubmitting(true);

      const summary = summarizeHopperState(finalState);
      const payload: HopperReplayPayload = {
        sessionId: session.sessionId,
        configVersion: session.configVersion,
        payload: {
          flapTicks: flapTicksRef.current
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

        const { result } = (await response.json()) as { result: OfficialHopperResult };
        setOfficialResult(result);
        setError(null);
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : "submit_session_failed");
      } finally {
        setIsSubmitting(false);
      }
    },
    [gameSlug]
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
        const shouldFlap =
          flapIndexRef.current < flapTicksRef.current.length &&
          flapTicksRef.current[flapIndexRef.current] === nextState.tick;

        if (shouldFlap) {
          flapIndexRef.current += 1;
        }

        nextState = stepHopperState(nextState, session, shouldFlap);
        accumulatorRef.current -= TICK_MS;
      }

      simulationStateRef.current = nextState;
      setRunState(nextState);

      if ((nextState.collided || nextState.tick >= session.payload.course.maxTicks) && !submittedRef.current) {
        void completeRun(session, nextState);
      }
    },
    [completeRun, gameSession]
  );

  const queueFlap = useCallback(() => {
    const session = gameSession;
    const state = simulationStateRef.current;

    if (!session || !state || state.collided || submittedRef.current || isSubmitting || officialResult || error) {
      return;
    }

    const maxTick = session.payload.course.maxTicks - 1;
    const nextCandidate = Math.min(state.tick + 1, maxTick);
    const lastTick = flapTicksRef.current[flapTicksRef.current.length - 1];
    const scheduledTick =
      lastTick !== undefined && nextCandidate <= lastTick ? Math.min(lastTick + 1, maxTick) : nextCandidate;

    if (lastTick === scheduledTick) {
      return;
    }

    flapTicksRef.current = [...flapTicksRef.current, scheduledTick];
  }, [error, gameSession, isSubmitting, officialResult]);

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
          throw new Error("unauthorized");
        }

        return fetch(`/api/games/${gameSlug}/sessions`, { method: "POST" });
      }

      return response;
    };

    setGameSession(null);
    setRunState(null);
    setOfficialResult(null);
    setError(null);

    void createOfficialSession()
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "create_session_failed");
        }

        return (await response.json()) as { gameSession: HopperSessionConfig };
      })
      .then(({ gameSession: session }) => {
        if (cancelled) {
          return;
        }

        setGameSession(session);
        resetRuntime(session);
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
    if (!gameSession || !runState || officialResult || error) {
      return;
    }

    let active = true;

    const onFrame = (timestamp: number) => {
      if (!active) {
        return;
      }

      if (lastFrameRef.current === null) {
        lastFrameRef.current = timestamp;
      }

      const delta = Math.min(64, timestamp - lastFrameRef.current);
      lastFrameRef.current = timestamp;
      processSimulation(delta);
      rafRef.current = window.requestAnimationFrame(onFrame);
    };

    rafRef.current = window.requestAnimationFrame(onFrame);

    return () => {
      active = false;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      lastFrameRef.current = null;
    };
  }, [error, gameSession, officialResult, processSimulation]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        queueFlap();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        lastFrameRef.current = null;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [queueFlap]);

  useEffect(() => {
    window.render_game_to_text = () => toSerializableState(simulationStateRef.current);
    window.advanceTime = (ms: number) => processSimulation(ms);
    window.__telegramplayHopper = {
      flap: queueFlap,
      renderGameToText: () => toSerializableState(simulationStateRef.current),
      advanceTime: (ms: number) => processSimulation(ms)
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__telegramplayHopper;
    };
  }, [processSimulation, queueFlap]);

  const statusCard = error
    ? {
        label: "Run Error",
        title: toReadableGameError(error),
        detail: "Restart the run to allocate a fresh official session.",
        tone: "danger" as const
      }
    : officialResult
      ? officialResult.status === "accepted"
        ? {
            label: "Official Result",
            title: officialResult.displayValue,
            detail:
              officialResult.rewards.length > 0
                ? officialResult.rewards.map((reward) => `+${reward.amount} ${reward.entryType.toUpperCase()}`).join(" • ")
                : "Server validation complete.",
            tone: "success" as const
          }
        : {
            label: "Review",
            title: officialResult.rejectedReason ?? "Submission rejected",
            detail: officialResult.flags.join(" • ") || "The server rejected the run.",
            tone: "danger" as const
          }
      : isSubmitting
        ? {
            label: "Official Review",
            title: "Checking on the server...",
            detail: runState ? summarizeHopperState(runState).displayValue : "Hold tight.",
            tone: "accent" as const
          }
        : !gameSession
          ? {
              label: "Official Session",
              title: "Preparing server session...",
              detail: "Allocating a trusted run.",
              tone: "neutral" as const
            }
          : null;

  return (
    <section className="relative isolate h-full min-h-[100dvh] overflow-hidden bg-[var(--surface-primary)]" aria-label={`${gameName} play screen`}>
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(74,210,255,0.16),transparent_28%),linear-gradient(180deg,rgba(9,11,18,0.06),rgba(9,11,18,0.36))]" />

      <div className="relative z-10 flex h-full min-h-[100dvh] flex-col overflow-hidden px-[max(10px,var(--safe-left))] pr-[max(10px,var(--safe-right))] pt-[max(8px,var(--safe-top))] pb-[max(10px,var(--safe-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-10 min-w-10 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
              aria-label="Back to game"
              onClick={() => router.push(`/games/${gameSlug}`)}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              <span className="sr-only">Back</span>
            </Button>
            <div className="min-w-0 max-w-[56vw] rounded-[16px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-2.5 py-2 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">Play</p>
              <h1 className="mt-1 truncate font-display text-[0.98rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">
                {gameName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-10 min-w-10 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
              aria-label={showHelp ? "Hide help" : "Show help"}
              data-testid="game-help"
              onClick={() => setShowHelp((current) => !current)}
              icon={showHelp ? <X className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}
            >
              <span className="sr-only">{showHelp ? "Hide help" : "Show help"}</span>
            </Button>
            <Button
              variant="ghost"
              className="h-10 min-w-10 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
              aria-label="Restart run"
              onClick={() => setRestartNonce((current) => current + 1)}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              <span className="sr-only">Restart</span>
            </Button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <CompactMetric label="Gates" value={metrics.gates} />
          <CompactMetric label="Speed" value={metrics.speed} />
          <CompactMetric label="Time" value={metrics.time} />
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <div
            className="relative h-full min-h-[420px] overflow-hidden rounded-[24px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_86%,black_14%)] shadow-[var(--shadow-soft)]"
            onPointerDown={(event) => {
              if (showHelp) {
                return;
              }
              if (event.pointerType !== "mouse" || event.button === 0) {
                queueFlap();
              }
            }}
          >
            {gameSession && runState ? (
              <HopperCanvas config={gameSession} state={runState} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
                Preparing official session...
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
              <div className="rounded-full border border-[color-mix(in_srgb,var(--hud-border)_80%,transparent_20%)] bg-[color-mix(in_srgb,var(--hud-bg)_82%,black_18%)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
                Tap anywhere to flap
              </div>
            </div>

            {showHelp ? (
              <div className="absolute inset-x-4 top-4 rounded-[20px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_94%,black_6%)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent-secondary)]">How To Fly</p>
                    <h2 className="mt-1 font-display text-base font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
                      Tap rhythm, hold the lane
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--hud-border)] p-2 text-[var(--text-muted)]"
                    aria-label="Close help"
                    onClick={() => setShowHelp(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
                  <li>Tap anywhere on the playfield to flap upward.</li>
                  <li>Stay centered inside the premium gate openings as the speed ramps up.</li>
                  <li>The official score is decided only after the server replays the flap timeline.</li>
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {statusCard ? (
          <div className={`mt-3 rounded-[18px] border px-3.5 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl ${getStatusToneClasses(statusCard.tone)}`}>
            <div className="flex items-start gap-2">
              {statusCard.tone === "danger" ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-danger)]" /> : null}
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">{statusCard.label}</p>
                <p className="mt-1 font-display text-base font-semibold tracking-[0.08em] text-[var(--text-primary)]">{statusCard.title}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{statusCard.detail}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
