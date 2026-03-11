"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  createInitialSignalStackerState,
  getActiveSignalBlock,
  getMaxAllowedTick,
  stepSignalStackerState,
  summarizeSignalStackerState,
  TICK_MS
} from "@telegramplay/game-signal-stacker-core";
import type {
  OfficialSignalStackerResult,
  SignalStackerReplayPayload,
  SignalStackerSessionConfig,
  SignalStackerState
} from "@telegramplay/game-signal-stacker-core";
import { SignalStackerCanvas } from "@telegramplay/game-signal-stacker";
import { Button } from "@telegramplay/ui";

import { waitForAuthenticatedPlayer } from "@/lib/client/player-session";

type StatusTone = "neutral" | "accent" | "success" | "danger";

declare global {
  interface Window {
    __telegramplaySignalStacker?: {
      drop: () => void;
      renderGameToText: () => string;
      advanceTime: (ms: number) => void;
    };
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

function toReadableGameError(message: string | null) {
  if (!message) {
    return null;
  }

  switch (message) {
    case "telegram_auth_pending":
      return "Telegram authentication did not finish in time. Close the Mini App and reopen it from the bot.";
    case "create_session_failed":
      return "Official tower session could not be created. Restart and try again.";
    case "submit_session_failed":
      return "Official validation failed to complete. Restart and try again.";
    case "invalid_submission_payload":
      return "The tower input payload was rejected by the server. Restart and try again.";
    case "session_not_found":
      return "The official tower session expired before submission. Restart for a fresh run.";
    default:
      return "The official tower could not be completed right now. Restart the run and try again.";
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

function toSerializableState(state: SignalStackerState | null, session: SignalStackerSessionConfig | null) {
  if (!state || !session) {
    return "{}";
  }

  const summary = summarizeSignalStackerState(state, session);
  const active = state.ended ? null : getActiveSignalBlock(state, session);

  return JSON.stringify({
    tick: state.tick,
    floorsStacked: state.floorsStacked,
    perfectDrops: state.perfectDrops,
    topWidthPct: summary.topWidthPct,
    ended: state.ended,
    activeCenterX: active ? Math.round(active.centerX) : null,
    activeWidth: active ? Math.round(active.width) : null
  });
}

export function SignalStackerPlayClient({
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
  const [gameSession, setGameSession] = useState<SignalStackerSessionConfig | null>(null);
  const [runState, setRunState] = useState<SignalStackerState | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialSignalStackerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dropTicksRef = useRef<number[]>([]);
  const simulationStateRef = useRef<SignalStackerState | null>(null);
  const dropIndexRef = useRef(0);
  const accumulatorRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const metrics = useMemo(() => {
    if (!runState || !gameSession) {
      return {
        floors: "0",
        perfect: "0",
        width: "100%"
      };
    }

    const summary = summarizeSignalStackerState(runState, gameSession);
    return {
      floors: String(summary.floorsStacked),
      perfect: String(summary.perfectDrops),
      width: `${summary.topWidthPct}%`
    };
  }, [gameSession, runState]);

  const resetRuntime = useCallback((session: SignalStackerSessionConfig) => {
    const initialState = createInitialSignalStackerState(session);
    dropTicksRef.current = [];
    simulationStateRef.current = initialState;
    dropIndexRef.current = 0;
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
    async (session: SignalStackerSessionConfig, finalState: SignalStackerState) => {
      if (submittedRef.current) {
        return;
      }

      submittedRef.current = true;
      setIsSubmitting(true);
      const summary = summarizeSignalStackerState(finalState, session);
      const payload: SignalStackerReplayPayload = {
        sessionId: session.sessionId,
        configVersion: session.configVersion,
        payload: {
          dropTicks: dropTicksRef.current
        },
        clientSummary: {
          elapsedMs: summary.elapsedMs,
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

        const { result } = (await response.json()) as { result: OfficialSignalStackerResult };
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

      while (accumulatorRef.current >= TICK_MS && !nextState.ended) {
        const shouldDrop =
          dropIndexRef.current < dropTicksRef.current.length &&
          dropTicksRef.current[dropIndexRef.current] === nextState.tick;

        if (shouldDrop) {
          dropIndexRef.current += 1;
        }

        nextState = stepSignalStackerState(nextState, session, shouldDrop);
        accumulatorRef.current -= TICK_MS;
      }

      simulationStateRef.current = nextState;
      setRunState(nextState);

      if (nextState.ended && !submittedRef.current) {
        void completeRun(session, nextState);
      }
    },
    [completeRun, gameSession]
  );

  const queueDrop = useCallback(() => {
    const session = gameSession;
    const state = simulationStateRef.current;

    if (!session || !state || state.ended || submittedRef.current || isSubmitting || officialResult || error) {
      return;
    }

    const lastTick = dropTicksRef.current[dropTicksRef.current.length - 1];
    const scheduledTick = lastTick !== undefined && state.tick <= lastTick ? lastTick + 1 : state.tick;

    if (scheduledTick > getMaxAllowedTick(session)) {
      return;
    }

    dropTicksRef.current = [...dropTicksRef.current, scheduledTick];
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

        return (await response.json()) as { gameSession: SignalStackerSessionConfig };
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
      if (event.key === " " || event.key === "Enter" || event.key === "ArrowUp") {
        event.preventDefault();
        queueDrop();
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
  }, [queueDrop]);

  useEffect(() => {
    window.render_game_to_text = () => toSerializableState(simulationStateRef.current, gameSession);
    window.advanceTime = (ms: number) => processSimulation(ms);
    window.__telegramplaySignalStacker = {
      drop: queueDrop,
      renderGameToText: () => toSerializableState(simulationStateRef.current, gameSession),
      advanceTime: (ms: number) => processSimulation(ms)
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__telegramplaySignalStacker;
    };
  }, [gameSession, processSimulation, queueDrop]);

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
            detail: runState && gameSession ? summarizeSignalStackerState(runState, gameSession).displayValue : "Hold tight.",
            tone: "accent" as const
          }
        : !gameSession
          ? {
              label: "Official Session",
              title: "Preparing server session...",
              detail: "Allocating a trusted tower run.",
              tone: "neutral" as const
            }
          : null;

  return (
    <section className="relative isolate h-full min-h-[100dvh] overflow-hidden bg-[var(--surface-primary)]" aria-label={`${gameName} play screen`}>
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,rgba(255,138,61,0.16),transparent_30%),linear-gradient(180deg,rgba(9,11,18,0.08),rgba(9,11,18,0.42))]" />

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
          <CompactMetric label="Floors" value={metrics.floors} />
          <CompactMetric label="Perfect" value={metrics.perfect} />
          <CompactMetric label="Width" value={metrics.width} />
        </div>

        <div className="mt-3 min-h-0 flex-1">
          <div
            className="relative h-full min-h-[420px] overflow-hidden rounded-[24px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_86%,black_14%)] shadow-[var(--shadow-soft)]"
            onPointerDown={(event) => {
              if (showHelp) {
                return;
              }
              if (event.pointerType !== "mouse" || event.button === 0) {
                queueDrop();
              }
            }}
          >
            {gameSession && runState ? (
              <SignalStackerCanvas config={gameSession} state={runState} className="h-full w-full" />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
                Preparing official session...
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
              <div className="rounded-full border border-[color-mix(in_srgb,var(--hud-border)_80%,transparent_20%)] bg-[color-mix(in_srgb,var(--hud-bg)_82%,black_18%)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
                Tap anywhere to drop
              </div>
            </div>

            {showHelp ? (
              <div className="absolute inset-x-4 top-4 rounded-[20px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_94%,black_6%)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent-secondary)]">How To Stack</p>
                    <h2 className="mt-1 font-display text-base font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
                      Time the drop, keep the tower centered
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
                  <li>Tap anywhere to drop the moving block onto the tower.</li>
                  <li>Centered drops count as perfect and keep your width healthier for longer.</li>
                  <li>The official score is only final after the server replays every drop tick.</li>
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
