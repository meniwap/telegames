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
      className="mx-auto grid w-full max-w-[340px] gap-2 sm:max-w-[400px] sm:gap-3"
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
            className={`relative aspect-square w-full rounded-[14px] border text-2xl transition-all duration-300 sm:rounded-[16px] sm:text-3xl ${
              isMatched
                ? "border-[color-mix(in_srgb,var(--accent-success)_50%,transparent_50%)] bg-[color-mix(in_srgb,var(--accent-success)_15%,var(--surface-elevated)_85%)] opacity-80"
                : isRevealed
                  ? "border-[var(--accent-primary)] bg-[var(--surface-elevated)] shadow-[0_0_12px_rgba(255,138,61,0.2)]"
                  : "border-[var(--border-strong)] bg-[linear-gradient(145deg,var(--surface-elevated),var(--surface-primary))] shadow-[var(--shadow-soft)] active:scale-95"
            }`}
            style={{ perspective: "600px" }}
            aria-label={isRevealed ? card.symbol : `Card ${index + 1}`}
          >
            <div
              className="flex h-full w-full items-center justify-center transition-transform duration-300"
              style={{
                transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
                transformStyle: "preserve-3d"
              }}
            >
              {/* Card back */}
              <span
                className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-[var(--accent-primary)] opacity-40"
                style={{ backfaceVisibility: "hidden" }}
              >
                ?
              </span>

              {/* Card front */}
              <span
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)"
                }}
              >
                {card.symbol}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
