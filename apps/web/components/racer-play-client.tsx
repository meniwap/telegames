"use client";

import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleHelp, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { INPUT_BRAKE, INPUT_LEFT, INPUT_RIGHT } from "@telegramplay/game-racer-core";
import type { OfficialRacerResult, RacerReplayPayload, RacerSessionConfig } from "@telegramplay/game-racer-core";
import { getThemeManifest } from "@telegramplay/theme-engine";
import { Button } from "@telegramplay/ui";

import { waitForAuthenticatedPlayer } from "@/lib/client/player-session";

type ControlState = {
  left: boolean;
  right: boolean;
  brake: boolean;
};

type StatusTone = "neutral" | "accent" | "success" | "danger";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __telegramplayRacer?: {
      setInputMask: (mask: number) => void;
      renderGameToText: () => string;
      advanceTime: (ms: number) => void;
    };
  }
}

function controlMask(controls: ControlState) {
  let mask = 0;

  if (controls.left) {
    mask |= INPUT_LEFT;
  }

  if (controls.right) {
    mask |= INPUT_RIGHT;
  }

  if (controls.brake) {
    mask |= INPUT_BRAKE;
  }

  return mask;
}

function formatMs(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function toReadableGameError(message: string | null) {
  switch (message) {
    case "telegram_auth_pending":
      return "Telegram authentication did not finish in time. Close the Mini App and reopen it from the bot.";
    case "create_session_failed":
      return "Official session could not be created. Restart the run and try again.";
    case "submit_session_failed":
      return "Official validation failed to complete. Restart the run and try again.";
    case "invalid_submission_payload":
      return "The run payload was rejected by the server. Restart the run and try again.";
    case "session_not_found":
      return "The official session expired before submission. Restart to get a fresh run.";
    default:
      return message;
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
      <p className="mt-0.5 font-display text-[1.55rem] font-semibold tracking-[0.06em] leading-none text-[var(--text-primary)] whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</p>
    </div>
  );
}

function toHudRaceState(state: { elapsedMs: number; racers: Array<{ completedLaps: number; place: number | null; speed: number }> }) {
  return {
    elapsedMs: Math.round(state.elapsedMs),
    laps: state.racers[0]?.completedLaps ?? 0,
    place: state.racers[0]?.place ?? 6,
    speed: Math.round(state.racers[0]?.speed ?? 0)
  };
}

export function RacerPlayClient({
  gameSlug,
  gameName,
  hasSession
}: {
  gameSlug: string;
  gameName: string;
  hasSession: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<{
    destroy: () => void;
    setInputMask: (mask: number) => void;
    getRaceState: () => { elapsedMs: number; racers: Array<{ completedLaps: number; place: number | null; speed: number }> };
    getRecordedFrames: () => number[];
    advanceTime: (ms: number) => void;
    renderGameToText: () => string;
  } | null>(null);

  const [controls, setControls] = useState<ControlState>({ left: false, right: false, brake: false });
  const [raceSession, setRaceSession] = useState<RacerSessionConfig | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialRacerResult | null>(null);
  const [provisionalResult, setProvisionalResult] = useState<OfficialRacerResult | null>(null);
  const [raceState, setRaceState] = useState<{ elapsedMs: number; laps: number; place: number; speed: number }>({
    elapsedMs: 0,
    laps: 0,
    place: 6,
    speed: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isSubmittingOfficialResult, setIsSubmittingOfficialResult] = useState(false);

  const theme = useMemo(() => {
    const manifest = getThemeManifest(process.env.NEXT_PUBLIC_APP_THEME);
    return {
      canvasBackground: manifest.tokens["surface-primary"],
      trackBase: manifest.tokens["surface-contrast"],
      trackLane: manifest.tokens["accent-secondary"],
      trackBorder: manifest.tokens["accent-primary"],
      startLine: manifest.tokens["text-primary"],
      playerBody: manifest.tokens["accent-primary"],
      playerAccent: manifest.tokens["accent-secondary"],
      cpuBodies: ["#97adc7", "#6cb0ff", "#72d9a1", "#f7b84b", "#d388ff"],
      shadow: "rgba(3, 6, 12, 0.55)",
      offTrack: "#815b2b",
      grass: "#1a2e1a",
      asphalt: "#2a2d35",
      curbRed: "#cc3333",
      curbWhite: "#e8e8e8",
      headlight: "#ffffcc",
      taillight: "#ff3344",
      wheelColor: "#1a1a1a"
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const createOfficialSession = async () => {
      if (!hasSession) {
        const isPlayerReady = await waitForAuthenticatedPlayer();
        if (!isPlayerReady) {
          throw new Error("telegram_auth_pending");
        }
      }

      const createResponse = await fetch(`/api/games/${gameSlug}/sessions`, { method: "POST" });
      if (createResponse.status === 401) {
        const isPlayerReady = await waitForAuthenticatedPlayer();
        if (!isPlayerReady) {
          throw new Error("unauthorized");
        }

        return fetch(`/api/games/${gameSlug}/sessions`, { method: "POST" });
      }

      return createResponse;
    };

    void createOfficialSession()
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "create_session_failed");
        }
        return (await response.json()) as { gameSession: RacerSessionConfig };
      })
      .then(async ({ gameSession }) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        const { createRacerController } = await import("@telegramplay/game-racer");
        setRaceSession(gameSession);
        setError(null);

        controllerRef.current = createRacerController({
          container: containerRef.current,
          config: gameSession,
          theme,
          onFinish: ({ provisionalResult, recordedFrames }) => {
            setProvisionalResult(provisionalResult);
            setIsSubmittingOfficialResult(true);

            const payload: RacerReplayPayload = {
              sessionId: gameSession.sessionId,
              configVersion: gameSession.configVersion,
              payload: {
                frames: recordedFrames
              },
              clientSummary: {
                elapsedMs: Math.round(provisionalResult.elapsedMs),
                reportedPlacement: provisionalResult.placement,
                reportedScoreSortValue: Math.round(provisionalResult.scoreSortValue),
                reportedDisplayValue: provisionalResult.displayValue
              }
            };

            void fetch(`/api/games/${gameSlug}/sessions/${gameSession.sessionId}/submissions`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(payload)
            })
              .then(async (response) => {
                if (!response.ok) {
                  const body = (await response.json().catch(() => null)) as { error?: string } | null;
                  throw new Error(body?.error ?? "submit_session_failed");
                }
                return (await response.json()) as { result: OfficialRacerResult };
              })
              .then(({ result }) => {
                setOfficialResult(result);
                setError(null);
              })
              .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : "submit_session_failed");
              })
              .finally(() => {
                setIsSubmittingOfficialResult(false);
              });
          }
        });

        window.render_game_to_text = () => controllerRef.current?.renderGameToText() ?? "{}";
        window.advanceTime = (ms: number) => controllerRef.current?.advanceTime(ms);
        window.__telegramplayRacer = {
          setInputMask: (mask: number) => controllerRef.current?.setInputMask(mask),
          renderGameToText: () => controllerRef.current?.renderGameToText() ?? "{}",
          advanceTime: (ms: number) => controllerRef.current?.advanceTime(ms)
        };
        setRaceState(toHudRaceState(controllerRef.current.getRaceState()));
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "create_session_failed");
      });

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__telegramplayRacer;
    };
  }, [gameSlug, hasSession, theme]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    controller.setInputMask(controlMask(controls));
  }, [controls]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = controllerRef.current?.getRaceState();
      if (!state) {
        return;
      }

      setRaceState(toHudRaceState(state));
    }, 60);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        setControls((current) => ({ ...current, left: true }));
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        setControls((current) => ({ ...current, right: true }));
      }
      if (event.key === " " || event.key.toLowerCase() === "s") {
        setControls((current) => ({ ...current, brake: true }));
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        setControls((current) => ({ ...current, left: false }));
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        setControls((current) => ({ ...current, right: false }));
      }
      if (event.key === " " || event.key.toLowerCase() === "s") {
        setControls((current) => ({ ...current, brake: false }));
      }
    };

    const resetControls = () => {
      setControls({ left: false, right: false, brake: false });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        resetControls();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", resetControls);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", resetControls);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const bindControl = (key: keyof ControlState) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setControls((current) => ({ ...current, [key]: true }));
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setControls((current) => ({ ...current, [key]: false }));
    },
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setControls((current) => ({ ...current, [key]: false }));
    },
    onLostPointerCapture: () => {
      setControls((current) => ({ ...current, [key]: false }));
    }
  });

  const readableError = toReadableGameError(error);
  const totalLaps = raceSession?.payload.track.laps ?? 3;

  const statusCard = readableError
    ? {
        label: "Run Error",
        title: readableError,
        detail: "Restart the run to allocate a fresh official session.",
        tone: "danger" as const
      }
    : officialResult
      ? officialResult.status === "accepted"
        ? {
            label: "Official Result",
            title: `P${officialResult.placement ?? "-"} • ${officialResult.displayValue}`,
            detail:
              officialResult.rewards.length > 0
                ? officialResult.rewards.map((reward) => `+${reward.amount} ${reward.entryType.toUpperCase()}`).join(" • ")
                : "Server validation complete.",
            tone: "success" as const
          }
        : {
            label: "Official Review",
            title: officialResult.rejectedReason ?? "Submission rejected",
            detail: officialResult.flags.join(" • ") || "The server rejected the run.",
            tone: "danger" as const
          }
      : isSubmittingOfficialResult
        ? {
            label: "Official Review",
            title: "Validating on the server...",
            detail: provisionalResult ? `Provisional P${provisionalResult.placement ?? "-"} • ${provisionalResult.displayValue}` : "Hold tight.",
            tone: "accent" as const
          }
        : raceSession
          ? {
              label: "Official Run",
              title: "Live session ready",
              detail: "Steer and drift.",
              tone: "neutral" as const
            }
          : {
              label: "Official Run",
              title: "Preparing server session...",
              detail: "Creating a trusted run.",
              tone: "neutral" as const
            };
  const shouldShowStatusCard = Boolean(showInstructions || readableError || officialResult || isSubmittingOfficialResult || !raceSession);

  return (
    <section
      className="relative isolate h-full min-h-[100dvh] overflow-hidden bg-[var(--surface-primary)]"
      aria-label={`${gameName} play screen`}
    >
      <div ref={containerRef} className="absolute inset-0 z-0 w-full touch-none bg-[var(--surface-primary)]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_top,rgba(74,210,255,0.14),transparent_28%),linear-gradient(180deg,rgba(9,11,18,0.12),rgba(9,11,18,0.44))]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-[max(8px,var(--safe-left))] pr-[max(8px,var(--safe-right))] pt-[max(6px,var(--safe-top))]">
        <div className="pointer-events-auto flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 min-w-9 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
              aria-label="Back to game"
              onClick={() => {
                controllerRef.current?.destroy();
                controllerRef.current = null;
                router.push(`/games/${gameSlug}`);
              }}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              <span className="sr-only">Back</span>
            </Button>
            <div className="min-w-0 max-w-[45vw] rounded-[16px] border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-2.5 py-2 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">Play</p>
              <h1 className="mt-1 truncate font-display text-[0.95rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] sm:text-base">
                {gameName}
              </h1>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 min-w-9 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
              aria-label={showInstructions ? "Hide driving tips" : "Show driving tips"}
              data-testid="game-help"
              onClick={() => setShowInstructions((current) => !current)}
              icon={showInstructions ? <X className="h-4 w-4" /> : <CircleHelp className="h-4 w-4" />}
            >
              <span className="sr-only">{showInstructions ? "Hide help" : "Show help"}</span>
            </Button>
            <Button
              variant="ghost"
              className="h-9 min-w-9 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
              aria-label="Restart run"
              onClick={() => window.location.reload()}
              icon={<RotateCcw className="h-4 w-4" />}
            >
              <span className="sr-only">Restart</span>
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto mt-1.5 grid grid-cols-4 gap-1">
          <CompactMetric label="Lap" value={`${Math.min(raceState.laps + 1, totalLaps)}/${totalLaps}`} />
          <CompactMetric label="Place" value={`${raceState.place}/6`} />
          <CompactMetric label="Speed" value={`${raceState.speed}`} />
          <CompactMetric label="Time" value={formatMs(raceState.elapsedMs)} />
        </div>
      </div>

      {!raceSession && !readableError ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
          <div className="rounded-[var(--card-radius)] border border-[var(--hud-border)] bg-[var(--hud-bg)] px-5 py-4 text-center text-sm text-[var(--text-muted)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
            Preparing official session...
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-[max(10px,var(--safe-left))] pr-[max(10px,var(--safe-right))] pb-[max(10px,var(--safe-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-2">
          {showInstructions ? (
            <div className="rounded-[18px] border border-[var(--hud-border)] bg-[var(--hud-bg)] p-3.5 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[var(--accent-secondary)]">How To Drive</p>
                  <h2 className="mt-1 font-display text-base font-semibold uppercase tracking-[0.08em] text-[var(--text-primary)]">
                    Auto-accelerate sprint
                  </h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-[var(--hud-border)] p-2 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                  aria-label="Close driving tips"
                  onClick={() => setShowInstructions(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-muted)]">
                <li>Hold the left or right pads with your thumbs to steer.</li>
                <li>Hold drift while turning to rotate harder through the tight corners.</li>
                <li>Runs are official only after the server validates the finished submission.</li>
              </ul>
            </div>
          ) : null}

          {shouldShowStatusCard ? (
            <div className={`rounded-[18px] border px-3.5 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl ${getStatusToneClasses(statusCard.tone)}`}>
              <div className="flex items-start gap-2">
                {readableError ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-danger)]" /> : null}
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">{statusCard.label}</p>
                  <p className="mt-1 font-display text-base font-semibold tracking-[0.08em] text-[var(--text-primary)]">{statusCard.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{statusCard.detail}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-[1fr_0.8fr_1fr] gap-2 sm:gap-3">
            <Button
              data-testid="control-left"
              variant={controls.left ? "primary" : "secondary"}
              className="h-[4.25rem] touch-none select-none rounded-[24px] text-base tracking-[0.24em] sm:h-20"
              aria-label="Steer left"
              onContextMenu={(event) => event.preventDefault()}
              {...bindControl("left")}
            >
              Left
            </Button>
            <Button
              data-testid="control-drift"
              variant={controls.brake ? "primary" : "secondary"}
              className="h-[4.25rem] touch-none select-none rounded-[24px] text-base tracking-[0.24em] sm:h-20"
              aria-label="Drift"
              onContextMenu={(event) => event.preventDefault()}
              {...bindControl("brake")}
            >
              Drift
            </Button>
            <Button
              data-testid="control-right"
              variant={controls.right ? "primary" : "secondary"}
              className="h-[4.25rem] touch-none select-none rounded-[24px] text-base tracking-[0.24em] sm:h-20"
              aria-label="Steer right"
              onContextMenu={(event) => event.preventDefault()}
              {...bindControl("right")}
            >
              Right
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
