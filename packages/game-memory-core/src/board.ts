import { GRID_SIZE, TOTAL_CARDS, TOTAL_PAIRS, DEFAULT_SYMBOLS } from "./constants";
import { createMulberry32 } from "./prng";
import type { MemoryBoardConfig, MemoryCard } from "./types";

export function createBoard(seed: number): MemoryBoardConfig {
  const rng = createMulberry32(seed);
  const symbols = DEFAULT_SYMBOLS.slice(0, TOTAL_PAIRS);

  // Create pairs: each symbol appears exactly twice
  const cardPool: MemoryCard[] = [];
  for (let pairId = 0; pairId < TOTAL_PAIRS; pairId++) {
    cardPool.push({ id: pairId * 2, pairId, symbol: symbols[pairId]! });
    cardPool.push({ id: pairId * 2 + 1, pairId, symbol: symbols[pairId]! });
  }

  // Fisher-Yates shuffle using the seeded PRNG
  for (let i = TOTAL_CARDS - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = cardPool[i]!;
    cardPool[i] = cardPool[j]!;
    cardPool[j] = temp;
  }

  // Reassign IDs based on final position
  const cards: MemoryCard[] = cardPool.map((card, index) => ({
    ...card,
    id: index
  }));

  return {
    gridSize: GRID_SIZE,
    cards,
    expectedMsRange: { min: 8000, max: 180000 } // 8 seconds to 3 minutes
  };
}
