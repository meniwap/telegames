"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, TriangleAlert } from "lucide-react";

import { TOTAL_PAIRS } from "@telegramplay/game-memory-core";
import type { MemoryFlipAction, MemoryReplayPayload, MemorySessionConfig, OfficialMemoryResult } from "@telegramplay/game-memory-core";
import type { MemoryCardState } from "@telegramplay/game-memory";
import { MemoryBoard } from "@telegramplay/game-memory";
import { Button } from "@telegramplay/ui";

import { waitForAuthenticatedPlayer } from "@/lib/client/player-session";

type StatusTone = "neutral" | "accent" | "success" | "danger";

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
      return "The game payload was rejected by the server. Restart and try again.";
    case "session_not_found":
      return "The official session expired before submission. Restart to get a fresh game.";
    default:
      return "The official game could not be completed right now. Restart and try again.";
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

export function MemoryPlayClient({
  gameSlug,
  gameName,
  hasSession
}: {
  gameSlug: string;
  gameName: string;
  hasSession: boolean;
}) {
  const router = useRouter();
  const [gameSession, setGameSession] = useState<MemorySessionConfig | null>(null);
  const [cardStates, setCardStates] = useState<MemoryCardState[]>([]);
  const [revealedIndex, setRevealedIndex] = useState<number | null>(null);
  const [pairsFound, setPairsFound] = useState(0);
  const [moves, setMoves] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [gameStartedAt, setGameStartedAt] = useState<number | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);
  const [officialResult, setOfficialResult] = useState<OfficialMemoryResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchedRef = useRef<boolean[]>([]);
  const flipsRef = useRef<MemoryFlipAction[]>([]);

  // Timer
  useEffect(() => {
    if (!gameStartedAt || pairsFound === TOTAL_PAIRS) return;

    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - gameStartedAt);
    }, 100);

    return () => window.clearInterval(interval);
  }, [gameStartedAt, pairsFound]);

  // Create session
  useEffect(() => {
    let cancelled = false;

    const createSession = async () => {
      if (!hasSession) {
        const ready = await waitForAuthenticatedPlayer();
        if (!ready) throw new Error("telegram_auth_pending");
      }

      const response = await fetch(`/api/games/${gameSlug}/sessions`, { method: "POST" });
      if (response.status === 401) {
        const ready = await waitForAuthenticatedPlayer();
        if (!ready) throw new Error("unauthorized");
        return fetch(`/api/games/${gameSlug}/sessions`, { method: "POST" });
      }
      return response;
    };

    void createSession()
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "create_session_failed");
        }
        return (await response.json()) as { gameSession: MemorySessionConfig };
      })
      .then(({ gameSession: session }) => {
        if (cancelled) return;
        setGameSession(session);
        setCardStates(new Array(session.payload.board.cards.length).fill("hidden"));
        matchedRef.current = Array.from({ length: session.payload.board.cards.length }, () => false);
        flipsRef.current = [];
        setRevealedIndex(null);
        setPairsFound(0);
        setMoves(0);
        setElapsedMs(0);
        setGameStartedAt(null);
        setOfficialResult(null);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "create_session_failed");
      });

    return () => { cancelled = true; };
  }, [gameSlug, hasSession]);

  // Submit result
  const submitResult = useCallback(async (session: MemorySessionConfig, allFlips: MemoryFlipAction[], totalMoves: number) => {
    setIsSubmitting(true);
    try {
      const lastFlipMs = allFlips[allFlips.length - 1]?.timestampMs ?? 0;
      const firstFlipMs = allFlips[0]?.timestampMs ?? 0;
      const totalTimeMs = lastFlipMs - firstFlipMs;

      const payload: MemoryReplayPayload = {
        sessionId: session.sessionId,
        configVersion: session.configVersion,
        payload: { flips: allFlips },
        clientSummary: {
          elapsedMs: Math.round(totalTimeMs),
          reportedPlacement: 1,
          reportedScoreSortValue: totalMoves * 10000 + Math.round(totalTimeMs),
          reportedDisplayValue: `${totalMoves} moves · ${(totalTimeMs / 1000).toFixed(1)}s`
        }
      };

      const response = await fetch(`/api/games/${gameSlug}/sessions/${session.sessionId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "submit_session_failed");
      }

      const { result } = (await response.json()) as { result: OfficialMemoryResult };
      setOfficialResult(result);
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "submit_session_failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [gameSlug]);

  // Handle card flip
  const handleFlip = useCallback((cardIndex: number) => {
    if (!gameSession || isFlipping || officialResult || isSubmitting) return;
    if (matchedRef.current[cardIndex]) return;

    const now = Date.now();

    // Start timer on first flip
    if (gameStartedAt === null) {
      setGameStartedAt(now);
    }

    const flip: MemoryFlipAction = {
      cardIndex,
      timestampMs: gameStartedAt ? now - gameStartedAt : 0
    };

    const board = gameSession.payload.board;
    const card = board.cards[cardIndex]!;

    if (revealedIndex === null) {
      // First flip of a pair attempt
      setRevealedIndex(cardIndex);
      flipsRef.current = [...flipsRef.current, flip];
      setCardStates((prev) => {
        const next = [...prev];
        next[cardIndex] = "revealed";
        return next;
      });
    } else {
      // Second flip
      setIsFlipping(true);
      const firstCard = board.cards[revealedIndex]!;
      const newMoves = moves + 1;
      setMoves(newMoves);

      // Reveal the second card
      const updated = [...flipsRef.current, flip];
      flipsRef.current = updated;

      // Check match
      if (firstCard.pairId === card.pairId) {
        // Match found
        const newPairs = pairsFound + 1;
        setPairsFound(newPairs);
        matchedRef.current[revealedIndex] = true;
        matchedRef.current[cardIndex] = true;
        setCardStates((prev2) => {
          const next = [...prev2];
          next[revealedIndex] = "matched";
          next[cardIndex] = "matched";
          return next;
        });
        setRevealedIndex(null);
        setIsFlipping(false);

        // Check if game is complete
        if (newPairs === TOTAL_PAIRS) {
          void submitResult(gameSession, updated, newMoves);
        }
      } else {
        // No match - reveal briefly then hide
        setCardStates((prev2) => {
          const next = [...prev2];
          next[cardIndex] = "revealed";
          return next;
        });

        window.setTimeout(() => {
          setCardStates((prev2) => {
            const next = [...prev2];
            next[revealedIndex] = "hidden";
            next[cardIndex] = "hidden";
            return next;
          });
          setRevealedIndex(null);
          setIsFlipping(false);
        }, 600);
      }
    }
  }, [gameSession, revealedIndex, moves, pairsFound, isFlipping, officialResult, isSubmitting, gameStartedAt, submitResult]);

  const gameComplete = pairsFound === TOTAL_PAIRS;
  const readableError = toReadableGameError(error);

  const statusCard = error
    ? {
        label: "Error",
        title: readableError,
        detail: "Restart to try again.",
        tone: "danger" as const
      }
    : officialResult
      ? officialResult.status === "accepted"
        ? {
            label: "Official Result",
            title: officialResult.displayValue,
            detail:
              officialResult.rewards.length > 0
                ? officialResult.rewards.map((r) => `+${r.amount} ${r.entryType.toUpperCase()}`).join(" · ")
                : "Server validation complete.",
            tone: "success" as const
          }
        : {
            label: "Review",
            title: officialResult.rejectedReason ?? "Submission rejected",
            detail: officialResult.flags.join(" · ") || "Server rejected the run.",
            tone: "danger" as const
          }
      : isSubmitting
        ? {
            label: "Validating",
            title: "Checking on server...",
            detail: `${moves} moves · ${formatMs(elapsedMs)}`,
            tone: "accent" as const
          }
        : gameSession
          ? null
          : {
              label: "Loading",
              title: "Preparing session...",
              detail: "Creating a trusted game.",
              tone: "neutral" as const
            };

  return (
    <section
      className="relative isolate flex h-full min-h-[100dvh] flex-col overflow-hidden bg-[var(--surface-primary)]"
      aria-label={`${gameName} play screen`}
    >
      {/* Top HUD */}
      <div className="z-20 px-[max(8px,var(--safe-left))] pr-[max(8px,var(--safe-right))] pt-[max(6px,var(--safe-top))]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="h-9 min-w-9 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
              aria-label="Back to game"
              onClick={() => router.push(`/games/${gameSlug}`)}
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

          <Button
            variant="ghost"
            className="h-9 min-w-9 rounded-full border border-[var(--hud-border)] bg-[color-mix(in_srgb,var(--hud-bg)_90%,black_10%)] px-0 shadow-[var(--shadow-soft)] backdrop-blur-xl"
            aria-label="Restart"
            onClick={() => window.location.reload()}
            icon={<RotateCcw className="h-4 w-4" />}
          >
            <span className="sr-only">Restart</span>
          </Button>
        </div>

        <div className="mt-1.5 grid grid-cols-3 gap-1">
          <CompactMetric label="Moves" value={`${moves}`} />
          <CompactMetric label="Pairs" value={`${pairsFound}/${TOTAL_PAIRS}`} />
          <CompactMetric label="Time" value={formatMs(elapsedMs)} />
        </div>
      </div>

      {/* Game board */}
      <div className="flex min-h-0 flex-1 items-start justify-center px-4 pb-4 pt-5">
        {gameSession ? (
          <MemoryBoard
            cards={gameSession.payload.board.cards}
            cardStates={cardStates}
            gridSize={gameSession.payload.board.gridSize}
            onFlip={handleFlip}
            disabled={gameComplete || isSubmitting || Boolean(error) || Boolean(officialResult)}
          />
        ) : !error ? (
          <div className="rounded-[var(--card-radius)] border border-[var(--hud-border)] bg-[var(--hud-bg)] px-5 py-4 text-center text-sm text-[var(--text-muted)] shadow-[var(--shadow-soft)] backdrop-blur-xl">
            Preparing official session...
          </div>
        ) : null}
      </div>

      {/* Bottom status */}
      <div className="z-20 px-[max(10px,var(--safe-left))] pr-[max(10px,var(--safe-right))] pb-[max(10px,var(--safe-bottom))]">
        <div className="mx-auto max-w-3xl">
          {statusCard ? (
            <div className={`rounded-[18px] border px-3.5 py-3 shadow-[var(--shadow-soft)] backdrop-blur-xl ${getStatusToneClasses(statusCard.tone)}`}>
              <div className="flex items-start gap-2">
                {error ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-danger)]" /> : null}
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[var(--accent-secondary)]">{statusCard.label}</p>
                  <p className="mt-1 font-display text-base font-semibold tracking-[0.08em] text-[var(--text-primary)]">{statusCard.title}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{statusCard.detail}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
