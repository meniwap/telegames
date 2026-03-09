"use client";

import type { MemoryCard } from "@telegramplay/game-memory-core";

export type MemoryCardState = "hidden" | "revealed" | "matched";

export type MemoryBoardProps = {
  cards: MemoryCard[];
  cardStates: MemoryCardState[];
  gridSize: number;
  onFlip: (cardIndex: number) => void;
  disabled: boolean;
};

export function MemoryBoard({ cards, cardStates, gridSize, onFlip, disabled }: MemoryBoardProps) {
  return (
    <div
      className="mx-auto grid w-full max-w-[344px] gap-2.5 sm:max-w-[404px] sm:gap-3"
      style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
    >
      {cards.map((card, index) => {
        const state = cardStates[index] ?? "hidden";
        const isRevealed = state === "revealed" || state === "matched";
        const isMatched = state === "matched";

        return (
          <button
            key={card.id}
            type="button"
            disabled={disabled || isMatched || isRevealed}
            onClick={() => onFlip(index)}
            className={`group relative aspect-[3/4] w-full overflow-hidden rounded-[18px] border text-2xl transition-all duration-200 sm:rounded-[20px] sm:text-3xl ${
              isMatched
                ? "border-[color-mix(in_srgb,var(--accent-success)_50%,transparent_50%)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent-success)_18%,var(--surface-elevated)_82%),color-mix(in_srgb,var(--surface-primary)_80%,var(--accent-success)_20%))] shadow-[0_0_16px_rgba(102,216,141,0.18)]"
                : isRevealed
                  ? "border-[var(--accent-primary)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-elevated)_92%,white_8%),var(--surface-primary))] shadow-[0_0_16px_rgba(255,138,61,0.18)]"
                  : "border-[var(--border-strong)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-elevated)_94%,white_6%),var(--surface-primary))] shadow-[var(--shadow-soft)] active:scale-[0.98]"
            }`}
            aria-label={isRevealed ? card.symbol : `Card ${index + 1}`}
          >
            <span className="pointer-events-none absolute inset-x-2 top-2 h-px rounded-full bg-[color-mix(in_srgb,white_35%,transparent_65%)]" />
            <span className="pointer-events-none absolute inset-x-3 bottom-2 h-px rounded-full bg-[color-mix(in_srgb,black_45%,transparent_55%)]" />
            <span className="pointer-events-none absolute inset-[1px] rounded-[16px] border border-[color-mix(in_srgb,white_7%,transparent_93%)] sm:rounded-[18px]" />

            {isRevealed ? (
              <div className="flex h-full w-full flex-col items-center justify-center px-1.5 text-center">
                <span className="text-[2rem] leading-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.28)] sm:text-[2.4rem]">{card.symbol}</span>
                <span className={`mt-2 text-[0.58rem] font-semibold uppercase tracking-[0.22em] ${isMatched ? "text-[var(--accent-success)]" : "text-[var(--accent-primary)]"}`}>
                  {isMatched ? "Matched" : "Open"}
                </span>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-2 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent-primary)_42%,transparent_58%)] bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent_90%)] shadow-[0_0_14px_rgba(255,138,61,0.12)]">
                  <span className="font-display text-lg font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">?</span>
                </div>
                <div>
                  <p className="text-[0.58rem] font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]">Memory</p>
                  <p className="mt-1 text-[0.52rem] uppercase tracking-[0.24em] text-[color-mix(in_srgb,var(--text-muted)_82%,transparent_18%)]">Tap to reveal</p>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
