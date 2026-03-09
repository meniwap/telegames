import { describe, expect, it } from "vitest";

import { mapPlayerRow, mapWalletLedgerRow, mapWalletRow } from "../lib/server/store.postgres";

describe("postgres row mapping", () => {
  it("maps direct player rows into camelCase records", () => {
    expect(
      mapPlayerRow({
        id: "player_1",
        telegram_user_id: "123",
        username_snapshot: "menahem",
        display_name_snapshot: "Menahem Cohen",
        avatar_url: null,
        created_at: "2026-03-10T00:00:00.000Z",
        updated_at: "2026-03-10T00:00:00.000Z",
        last_seen_at: "2026-03-10T00:00:00.000Z",
        total_xp: 200,
        total_coins: 90,
        level: 2
      })
    ).toEqual({
      id: "player_1",
      telegramUserId: "123",
      usernameSnapshot: "menahem",
      displayNameSnapshot: "Menahem Cohen",
      avatarUrl: null,
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      lastSeenAt: "2026-03-10T00:00:00.000Z",
      totalXp: 200,
      totalCoins: 90,
      level: 2
    });
  });

  it("maps wallet and ledger rows for profile rendering", () => {
    expect(mapWalletRow({ player_id: "player_1", coins: 194 })).toEqual({
      playerId: "player_1",
      coins: 194
    });

    expect(
      mapWalletLedgerRow({
        id: "ledger_1",
        player_id: "player_1",
        entry_type: "coins",
        amount: 50,
        source_type: "game_result",
        source_id: "result_1",
        created_at: "2026-03-10T00:00:00.000Z"
      })
    ).toEqual({
      id: "ledger_1",
      playerId: "player_1",
      entryType: "coins",
      amount: 50,
      sourceType: "game_result",
      sourceId: "result_1",
      createdAt: "2026-03-10T00:00:00.000Z"
    });
  });
});
