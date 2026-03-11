"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createInitialVectorShiftState,
  stepVectorShiftState,
  summarizeVectorShiftState,
  TICK_MS
} from "@telegramplay/game-vector-shift-core";
import type {
  OfficialVectorShiftResult,
  VectorShiftLane,
  VectorShiftLaneChange,
  VectorShiftReplayPayload,
  VectorShiftSessionConfig,
  VectorShiftState
} from "@telegramplay/game-vector-shift-core";
import { VectorShiftCanvas } from "@telegramplay/game-vector-shift";
import { Button } from "@telegramplay/ui";

import { waitForAuthenticatedPlayer } from "@/lib/client/player-session";

type StatusTone = "neutral" | "accent" | "success" | "danger";

declare global {
  interface Window {
    __telegramplayVectorShift?: {
      stepLeft: () => void;
      stepRight: () => void;
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
      return "Official lane session could not be created. Restart and try again.";
    case "submit_session_failed":
      return "Official validation failed to complete. Restart and try again.";
    case "invalid_submission_payload":
      return "The lane input payload was rejected by the server. Restart and try again.";
    case "session_not_found":
      return "The official lane session expired before submission. Restart for a fresh run.";
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
        className="mt-0.5 font-display text-[1.38rem] leading-none font-semibold tracking-[0.06em] text-[var(--text-primary)] whitespace-nowrap"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function toSerializableState(state: VectorShiftState | null, session: VectorShiftSessionConfig | null) {
  if (!state || !session) {
    return "{}";
  }

  const summary = summarizeVectorShiftState(state);
  const nextRow = session.payload.course.rows[state.nextRowIndex];
  return JSON.stringify({
    tick: state.tick,
    lane: state.lane,
    sectorsCleared: state.sectorsCleared,
    chargesCollected: state.chargesCollected,
    survivedMs: summary.survivedMs,
    collided: state.collided,
    nextRowInTicks: nextRow ? nextRow.tick - state.tick : null,
    nextBlockedLanes: nextRow?.blockedLanes ?? [],
    nextChargeLane: nextRow?.chargeLane ?? null
  });
}

export function VectorShiftPlayClient({
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
  const [gameSession, setGameSession] = useState<VectorShiftSessionConfig | null>(null);
  const [runState, setRunState] = useState<VectorShiftState | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialVectorShiftResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const laneChangesRef = useRef<VectorShiftLaneChange[]>([]);
  const simulationStateRef = useRef<VectorShiftState | null>(null);
  const laneChangeIndexRef = useRef(0);
  const accumulatorRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const pointerStartXRef = useRef<number | null>(null);

  const metrics = useMemo(() => {
    if (!runState) {
      return {
        sectors: "0",
        charges: "0",
        time: "0.0s"
      };
    }

    const summary = summarizeVectorShiftState(runState);
    return {
      sectors: String(summary.sectorsCleared),
      charges: String(summary.chargesCollected),
      time: formatMs(summary.survivedMs)
    };
  }, [runState]);

  const resetRuntime = useCallback((session: VectorShiftSessionConfig) => {
    const initialState = createInitialVectorShiftState(session);
    laneChangesRef.current = [];
    simulationStateRef.current = initialState;
    laneChangeIndexRef.current = 0;
    accumulatorRef.current = 0;
    lastFrameRef.current = null;
    submittedRef.current = false;
    pointerStartXRef.current = null;
    setRunState(initialState);
    setOfficialResult(null);
    setError(null);
    setIsSubmitting(false);
    setShowHelp(false);
  }, []);

  const completeRun = useCallback(
    async (session: VectorShiftSessionConfig, finalState: VectorShiftState) => {
      if (submittedRef.current) {
        return;
      }

      submittedRef.current = true;
      setIsSubmitting(true);
      const summary = summarizeVectorShiftState(finalState);
      const payload: VectorShiftReplayPayload = {
        sessionId: session.sessionId,
        configVersion: session.configVersion,
        payload: {
          laneChanges: laneChangesRef.current
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

        const { result } = (await response.json()) as { result: OfficialVectorShiftResult };
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
        const scheduled = laneChangesRef.current[laneChangeIndexRef.current];
        let targetLane: VectorShiftLane | null = null;

        if (scheduled && scheduled.tick === nextState.tick) {
          targetLane = scheduled.targetLane;
          laneChangeIndexRef.current += 1;
        }

        nextState = stepVectorShiftState(nextState, session, targetLane);
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

  const queueLaneStep = useCallback(
    (direction: -1 | 1) => {
      const session = gameSession;
      const state = simulationStateRef.current;

      if (!session || !state || state.collided || submittedRef.current || isSubmitting || officialResult || error) {
        return;
      }

      const lastChange = laneChangesRef.current[laneChangesRef.current.length - 1];
      const baseLane = lastChange && lastChange.tick >= state.tick ? lastChange.targetLane : state.lane;
      const targetLane = Math.max(0, Math.min(session.payload.course.laneCount - 1, baseLane + direction)) as VectorShiftLane;
      if (targetLane === baseLane) {
        return;
      }

      const scheduledTick =
        lastChange && state.tick <= lastChange.tick
          ? Math.min(lastChange.tick + 1, session.payload.course.maxTicks - 1)
          : state.tick;

      laneChangesRef.current = [...laneChangesRef.current, { tick: scheduledTick, targetLane }];
    },
    [error, gameSession, isSubmitting, officialResult]
  );

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

        return (await response.json()) as { gameSession: VectorShiftSessionConfig };
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
  }, [error, gameSession, officialResult, processSimulation, runState]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        queueLaneStep(-1);
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        queueLaneStep(1);
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
  }, [queueLaneStep]);

  useEffect(() => {
    window.render_game_to_text = () => toSerializableState(simulationStateRef.current, gameSession);
    window.advanceTime = (ms: number) => processSimulation(ms);
    window.__telegramplayVectorShift = {
      stepLeft: () => queueLaneStep(-1),
      stepRight: () => queueLaneStep(1),
      renderGameToText: () => toSerializableState(simulationStateRef.current, gameSession),
      advanceTime: (ms: number) => processSimulation(ms)
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__telegramplayVectorShift;
    };
  }, [gameSession, processSimulation, queueLaneStep]);

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
            detail: runState ? summarizeVectorShiftState(runState).displayValue : "Hold tight.",
            tone: "accent" as const
          }
        : !gameSession
          ? {
              label: "Official Session",
              title: "Preparing server session...",
              detail: "Allocating a trusted lane run.",
              tone: "neutral" as const
            }
          : null;

  return (
    <section className="relative isolate h-full min-h-[100dvh] overflow-hidden bg-[var(--surface-primary)]" aria-label={`${gameName} play screen`}>
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(74,210,255,0.14),transparent_28%),linear-gradient(180deg,rgba(9,11,18,0.08),rgba(9,11,18,0.44))]" />

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
          <CompactMetric label="Sectors" value={metrics.sectors} />
          <CompactMetric label="Charges" value={metrics.charges} />
          <CompactMetric label="Time" value={metrics.time} />
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <div
            className="relative h-full min-h-[420px] overflow-hidden rounded-[24px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_86%,black_14%)] shadow-[var(--shadow-soft)]"
            onPointerDown={(event) => {
              if (showHelp) {
                return;
              }
              pointerStartXRef.current = event.clientX;
            }}
            onPointerUp={(event) => {
              if (showHelp) {
                return;
              }

              const startX = pointerStartXRef.current ?? event.clientX;
              const delta = event.clientX - startX;
              if (Math.abs(delta) > 22) {
                queueLaneStep(delta > 0 ? 1 : -1);
              } else {
                const rect = event.currentTarget.getBoundingClientRect();
                queueLaneStep(event.clientX < rect.left + rect.width / 2 ? -1 : 1);
              }
              pointerStartXRef.current = null;
            }}
          >
            {gameSession && runState ? (
              <VectorShiftCanvas config={gameSession} state={runState} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
                Preparing official session...
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
              <div className="rounded-full border border-[color-mix(in_srgb,var(--hud-border)_80%,transparent_20%)] bg-[color-mix(in_srgb,var(--hud-bg)_82%,black_18%)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
                Tap sides or swipe to shift
              </div>
            </div>

            {showHelp ? (
              <div className="absolute inset-x-4 top-4 rounded-[20px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_94%,black_6%)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent-secondary)]">How To Shift</p>
                    <h2 className="mt-1 font-display text-base font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
                      Hold the safe lane, collect the charge
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
                  <li>Tap left or right to step one lane in that direction, or swipe for a quick shift.</li>
                  <li>Orange blockers end the run; cyan charges on safe lanes boost your result value.</li>
                  <li>The official score is only final after the server replays every lane change.</li>
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-[16px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_88%,black_12%)] px-3 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)] shadow-[var(--shadow-soft)] backdrop-blur-xl"
            data-testid="vector-left"
            onClick={() => queueLaneStep(-1)}
          >
            Shift Left
          </button>
          <button
            type="button"
            className="rounded-[16px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_88%,black_12%)] px-3 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)] shadow-[var(--shadow-soft)] backdrop-blur-xl"
            data-testid="vector-right"
            onClick={() => queueLaneStep(1)}
          >
            Shift Right
          </button>
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
