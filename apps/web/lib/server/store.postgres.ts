// @ts-nocheck
import type postgres from "postgres";

import { createRequestLogger } from "@telegramplay/telemetry";
import type { GameSessionConfig, GameSubmissionPayload, LeaderboardWindow, OfficialGameResult } from "@telegramplay/game-core";

import { createRecordId } from "../auth/session";
import { getEnv } from "../env";
import { parseDbJson } from "./parse-db-json";
import type {
  AuditEventRecord,
  BootstrapPayload,
  ClientErrorRecord,
  GameCatalogEntry,
  GameResultRecord,
  GameSessionRecord,
  LeaderboardPayload,
  OpsDashboardPayload,
  PlayerContext,
  ProfilePayload,
  TelegramIdentity
} from "../types";

function toPlayerContext(row: {
  player_id: string;
  session_id: string;
  session_token_hash: string;
  session_expires_at: string;
  session_created_at: string;
  session_last_seen_at: string;
  telegram_user_id: string;
  username_snapshot: string | null;
  display_name_snapshot: string;
  avatar_url: string | null;
  player_created_at: string;
  player_updated_at: string;
  player_last_seen_at: string;
  total_xp: number;
  total_coins: number;
  level: number;
  is_admin: boolean;
}): PlayerContext {
  return {
    player: {
      id: row.player_id,
      telegramUserId: row.telegram_user_id,
      usernameSnapshot: row.username_snapshot,
      displayNameSnapshot: row.display_name_snapshot,
      avatarUrl: row.avatar_url,
      createdAt: row.player_created_at,
      updatedAt: row.player_updated_at,
      lastSeenAt: row.player_last_seen_at,
      totalXp: row.total_xp,
      totalCoins: row.total_coins,
      level: row.level
    },
    isAdmin: row.is_admin,
    session: {
      id: row.session_id,
      playerId: row.player_id,
      sessionTokenHash: row.session_token_hash,
      expiresAt: row.session_expires_at,
      createdAt: row.session_created_at,
      lastSeenAt: row.session_last_seen_at
    }
  };
}

export function mapPlayerRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.player_id ?? row.id,
    telegramUserId: row.telegram_user_id,
    usernameSnapshot: row.username_snapshot ?? null,
    displayNameSnapshot: row.display_name_snapshot,
    avatarUrl: row.avatar_url ?? null,
    createdAt: row.player_created_at ?? row.created_at,
    updatedAt: row.player_updated_at ?? row.updated_at,
    lastSeenAt: row.player_last_seen_at ?? row.last_seen_at,
    totalXp: row.total_xp ?? 0,
    totalCoins: row.total_coins ?? 0,
    level: row.level ?? 1
  };
}

export function mapWalletRow(row) {
  if (!row) {
    return null;
  }

  return {
    playerId: row.player_id,
    coins: row.coins
  };
}

export function mapWalletLedgerRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    entryType: row.entry_type,
    amount: row.amount,
    sourceType: row.source_type,
    sourceId: row.source_id,
    createdAt: row.created_at
  };
}

function mapGameProfile(row) {
  return {
    playerId: row.player_id,
    gameTitleId: row.game_title_id,
    gameSlug: row.game_slug,
    gameName: row.game_name,
    xp: row.xp,
    level: row.level,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGameSession(row): GameSessionRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    gameTitleId: row.game_title_id,
    gameSlug: row.game_slug,
    configVersion: row.config_version,
    seed: row.seed,
    config: parseDbJson(row.config_json),
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    resultId: row.result_id
  };
}

function mapGameResult(row): GameResultRecord {
  return {
    id: row.id,
    playerId: row.player_id,
    sessionId: row.session_id,
    gameTitleId: row.game_title_id,
    status: row.status,
    placement: row.placement,
    scoreSortValue: row.score_sort_value,
    displayValue: row.display_value,
    elapsedMs: row.elapsed_ms,
    rewards: parseDbJson(row.rewards_json),
    flags: parseDbJson(row.flags_json),
    rejectedReason: row.rejected_reason,
    resultSummary: parseDbJson(row.result_summary_json),
    createdAt: row.created_at
  };
}

export function createPostgresStore(sql: postgres.Sql) {
  const logger = createRequestLogger({ route: "store.postgres" });

  async function selectGameProfiles(playerId: string) {
    return sql`
      select
        gp.player_id,
        gp.game_title_id,
        gt.slug as game_slug,
        gt.name as game_name,
        gp.xp,
        gp.level,
        gp.created_at,
        gp.updated_at
      from game_profiles gp
      join game_titles gt on gt.id = gp.game_title_id
      where gp.player_id = ${playerId}
      order by gt.sort_order asc
    `;
  }

  return {
    async upsertTelegramIdentity(identity: TelegramIdentity, sessionTokenHash: string) {
      const env = getEnv();
      const now = new Date().toISOString();
      const [player] = await sql`
        insert into players (id, telegram_user_id, username_snapshot, display_name_snapshot, avatar_url, created_at, updated_at, last_seen_at, total_xp, total_coins, level)
        values (${createRecordId("player")}, ${identity.telegramUserId}, ${identity.username}, ${identity.displayName}, ${identity.avatarUrl}, ${now}, ${now}, ${now}, 0, 0, 1)
        on conflict (telegram_user_id)
        do update set
          username_snapshot = excluded.username_snapshot,
          display_name_snapshot = excluded.display_name_snapshot,
          avatar_url = excluded.avatar_url,
          updated_at = excluded.updated_at,
          last_seen_at = excluded.last_seen_at
        returning *
      `;

      await sql`
        insert into telegram_accounts (player_id, telegram_user_id, username_snapshot, display_name_snapshot, avatar_url, created_at, updated_at)
        values (${player.id}, ${identity.telegramUserId}, ${identity.username}, ${identity.displayName}, ${identity.avatarUrl}, ${now}, ${now})
        on conflict (telegram_user_id)
        do update set
          player_id = excluded.player_id,
          username_snapshot = excluded.username_snapshot,
          display_name_snapshot = excluded.display_name_snapshot,
          avatar_url = excluded.avatar_url,
          updated_at = excluded.updated_at
      `;

      await sql`
        insert into game_profiles (player_id, game_title_id, xp, level, created_at, updated_at)
        select ${player.id}, gt.id, 0, 1, ${now}, ${now}
        from game_titles gt
        on conflict (player_id, game_title_id) do nothing
      `;

      await sql`
        insert into racer_player_stats (player_id, game_title_id, sessions_started, sessions_completed, best_score_sort_value, best_display_value, created_at, updated_at)
        select ${player.id}, gt.id, 0, 0, null, null, ${now}, ${now}
        from game_titles gt
        where gt.slug = 'racer-poc'
        on conflict (player_id, game_title_id) do nothing
      `;

      await sql`
        insert into memory_player_stats (player_id, game_title_id, sessions_started, sessions_completed, best_score_sort_value, best_display_value, best_moves, best_time_ms, created_at, updated_at)
        select ${player.id}, gt.id, 0, 0, null, null, null, null, ${now}, ${now}
        from game_titles gt
        where gt.slug = 'memory'
        on conflict (player_id, game_title_id) do nothing
      `;

      await sql`
        insert into wallets (player_id, coins, created_at, updated_at)
        values (${player.id}, 0, ${now}, ${now})
        on conflict (player_id) do nothing
      `;

      const [session] = await sql`
        insert into auth_sessions (id, player_id, session_token_hash, expires_at, created_at, last_seen_at)
        values (${createRecordId("sess")}, ${player.id}, ${sessionTokenHash}, ${new Date(Date.now() + env.SESSION_TTL_HOURS * 3600000).toISOString()}, ${now}, ${now})
        returning *
      `;

      const [contextRow] = await sql`
        select
          p.id as player_id,
          p.telegram_user_id,
          p.username_snapshot,
          p.display_name_snapshot,
          p.avatar_url,
          p.created_at as player_created_at,
          p.updated_at as player_updated_at,
          p.last_seen_at as player_last_seen_at,
          p.total_xp,
          p.total_coins,
          p.level,
          s.id as session_id,
          s.session_token_hash,
          s.expires_at as session_expires_at,
          s.created_at as session_created_at,
          s.last_seen_at as session_last_seen_at,
          exists(select 1 from admin_users au where au.player_id = p.id or au.telegram_user_id = p.telegram_user_id) as is_admin
        from players p
        join auth_sessions s on s.player_id = p.id
        where s.id = ${session.id}
      `;

      logger.info({ playerId: player.id }, "postgres auth session created");
      return toPlayerContext(contextRow);
    },

    async getPlayerContextBySessionHash(sessionTokenHash: string) {
      const [contextRow] = await sql`
        select
          p.id as player_id,
          p.telegram_user_id,
          p.username_snapshot,
          p.display_name_snapshot,
          p.avatar_url,
          p.created_at as player_created_at,
          p.updated_at as player_updated_at,
          p.last_seen_at as player_last_seen_at,
          p.total_xp,
          p.total_coins,
          p.level,
          s.id as session_id,
          s.session_token_hash,
          s.expires_at as session_expires_at,
          s.created_at as session_created_at,
          s.last_seen_at as session_last_seen_at,
          exists(select 1 from admin_users au where au.player_id = p.id or au.telegram_user_id = p.telegram_user_id) as is_admin
        from auth_sessions s
        join players p on p.id = s.player_id
        where s.session_token_hash = ${sessionTokenHash}
          and s.expires_at > now()
        limit 1
      `;

      return contextRow ? toPlayerContext(contextRow) : null;
    },

    async getBootstrapPayload(playerId: string | null): Promise<BootstrapPayload> {
      const env = getEnv();
      const catalog = await sql<GameCatalogEntry[]>`
        select id, slug, name, status, tagline, description, cover_label as "coverLabel"
        from game_titles
        order by sort_order asc
      `;
      let player = null;
      let wallet = null;
      let isAdmin = false;
      let gameProfiles = [];

      if (playerId) {
        const [playerRow] = await sql`select * from players where id = ${playerId} limit 1`;
        const [walletRow] = await sql`select player_id, coins from wallets where player_id = ${playerId} limit 1`;
        gameProfiles = (await selectGameProfiles(playerId)).map(mapGameProfile);
        const [adminRow] = await sql`
          select exists(
            select 1
            from admin_users au
            join players p on p.id = ${playerId}
            where au.player_id = p.id or au.telegram_user_id = p.telegram_user_id
          ) as is_admin
        `;
        player = mapPlayerRow(playerRow);
        wallet = mapWalletRow(walletRow);
        isAdmin = adminRow?.is_admin ?? false;
      }

      return {
        appName: env.APP_NAME,
        themeId: env.NEXT_PUBLIC_APP_THEME,
        deploymentVersion: env.DEPLOYMENT_VERSION,
        commitSha: env.VERCEL_GIT_COMMIT_SHA,
        player,
        wallet,
        isAdmin,
        catalog,
        gameProfiles,
        featuredGameSlug: catalog[0]?.slug ?? null
      };
    },

    async getCatalogEntries() {
      return sql<GameCatalogEntry[]>`
        select id, slug, name, status, tagline, description, cover_label as "coverLabel"
        from game_titles
        order by sort_order asc
      `;
    },

    async getCatalogEntryBySlug(gameSlug: string) {
      const [row] = await sql<GameCatalogEntry[]>`
        select id, slug, name, status, tagline, description, cover_label as "coverLabel"
        from game_titles
        where slug = ${gameSlug}
        limit 1
      `;
      return row ?? null;
    },

    async getProfilePayload(playerId: string): Promise<ProfilePayload> {
      const [playerRow] = await sql`select * from players where id = ${playerId} limit 1`;
      const [walletRow] = await sql`select player_id, coins from wallets where player_id = ${playerId} limit 1`;
      const recentLedgerRows =
        await sql`select id, player_id, entry_type, amount, source_type, source_id, created_at from wallet_ledger where player_id = ${playerId} order by created_at desc limit 10`;
      const gameProfiles = (await selectGameProfiles(playerId)).map(mapGameProfile);

      return {
        player: mapPlayerRow(playerRow),
        wallet: mapWalletRow(walletRow),
        gameProfiles,
        selectedGameSlug: null,
        selectedGameStats: [],
        recentLedger: recentLedgerRows.map(mapWalletLedgerRow)
      };
    },

    async getGameProfileState(playerId: string, gameSlug: string) {
      if (gameSlug === "racer-poc") {
        const [row] = await sql`
          select
            rps.player_id,
            rps.game_title_id,
            rps.sessions_started,
            rps.sessions_completed,
            rps.best_score_sort_value,
            rps.best_display_value,
            rps.created_at,
            rps.updated_at
          from racer_player_stats rps
          join game_titles gt on gt.id = rps.game_title_id
          where rps.player_id = ${playerId}
            and gt.slug = ${gameSlug}
          limit 1
        `;

        return row
          ? {
              playerId: row.player_id,
              gameTitleId: row.game_title_id,
              sessionsStarted: row.sessions_started,
              sessionsCompleted: row.sessions_completed,
              bestScoreSortValue: row.best_score_sort_value,
              bestDisplayValue: row.best_display_value,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }
          : null;
      }

      if (gameSlug === "memory") {
        const [row] = await sql`
          select
            mps.player_id,
            mps.game_title_id,
            mps.sessions_started,
            mps.sessions_completed,
            mps.best_score_sort_value,
            mps.best_display_value,
            mps.best_moves,
            mps.best_time_ms,
            mps.created_at,
            mps.updated_at
          from memory_player_stats mps
          join game_titles gt on gt.id = mps.game_title_id
          where mps.player_id = ${playerId}
            and gt.slug = ${gameSlug}
          limit 1
        `;

        return row
          ? {
              playerId: row.player_id,
              gameTitleId: row.game_title_id,
              sessionsStarted: row.sessions_started,
              sessionsCompleted: row.sessions_completed,
              bestScoreSortValue: row.best_score_sort_value,
              bestDisplayValue: row.best_display_value,
              bestMoves: row.best_moves,
              bestTimeMs: row.best_time_ms,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }
          : null;
      }

      return null;
    },

    async createGameSession(playerId: string, config: GameSessionConfig): Promise<GameSessionRecord> {
      await sql.begin(async (transaction) => {
        await transaction`
          insert into game_sessions (id, player_id, game_title_id, config_version, seed, config_json, status, expires_at, created_at, submitted_at, result_id)
          values (${config.sessionId}, ${playerId}, ${config.gameTitleId}, ${config.configVersion}, ${config.seed}, ${JSON.stringify(config)}, 'created', ${config.expiresAt}, ${config.createdAt}, null, null)
        `;

        if (config.gameTitleId === "racer-poc") {
          await transaction`
            insert into racer_player_stats (player_id, game_title_id, sessions_started, sessions_completed, best_score_sort_value, best_display_value, created_at, updated_at)
            values (${playerId}, ${config.gameTitleId}, 1, 0, null, null, now(), now())
            on conflict (player_id, game_title_id)
            do update set
              sessions_started = racer_player_stats.sessions_started + 1,
              updated_at = now()
          `;
        }

        if (config.gameTitleId === "memory") {
          await transaction`
            insert into memory_player_stats (player_id, game_title_id, sessions_started, sessions_completed, best_score_sort_value, best_display_value, best_moves, best_time_ms, created_at, updated_at)
            values (${playerId}, ${config.gameTitleId}, 1, 0, null, null, null, null, now(), now())
            on conflict (player_id, game_title_id)
            do update set
              sessions_started = memory_player_stats.sessions_started + 1,
              updated_at = now()
          `;
        }

        await transaction`
          insert into audit_events (id, player_id, session_id, event_type, payload_json, created_at)
          values (${createRecordId("audit")}, ${playerId}, ${config.sessionId}, 'game_session_created', ${JSON.stringify({ gameTitleId: config.gameTitleId, configVersion: config.configVersion })}, now())
        `;
      });

      const [row] = await sql`
        select
          gs.id,
          gs.player_id,
          gs.game_title_id,
          gt.slug as game_slug,
          gs.config_version,
          gs.seed,
          gs.config_json,
          gs.status,
          gs.expires_at,
          gs.created_at,
          gs.submitted_at,
          gs.result_id
        from game_sessions gs
        join game_titles gt on gt.id = gs.game_title_id
        where gs.id = ${config.sessionId}
      `;

      return mapGameSession(row);
    },

    async getGameSessionById(sessionId: string) {
      const [row] = await sql`
        select
          gs.id,
          gs.player_id,
          gs.game_title_id,
          gt.slug as game_slug,
          gs.config_version,
          gs.seed,
          gs.config_json,
          gs.status,
          gs.expires_at,
          gs.created_at,
          gs.submitted_at,
          gs.result_id
        from game_sessions gs
        join game_titles gt on gt.id = gs.game_title_id
        where gs.id = ${sessionId}
        limit 1
      `;

      return row ? mapGameSession(row) : null;
    },

    async finalizeGameSession(playerId: string, session: GameSessionRecord, payload: GameSubmissionPayload, result: OfficialGameResult): Promise<GameResultRecord> {
      const resultId = createRecordId("result");
      const memorySummary = result.resultSummary as { totalMoves?: number; officialTimeMs?: number } | null;

      const finalized = await sql.begin(async (transaction) => {
        const [existing] = await transaction`
          select *
          from game_results
          where session_id = ${session.id}
          limit 1
        `;

        if (existing) {
          return existing;
        }

        await transaction`
          update game_sessions
          set status = ${result.status}, submitted_at = now()
          where id = ${session.id}
            and status = 'created'
        `;

        await transaction`
          insert into game_submissions (session_id, payload_json, created_at)
          values (${session.id}, ${JSON.stringify(payload)}, now())
        `;

        await transaction`
          insert into audit_events (id, player_id, session_id, event_type, payload_json, created_at)
          values (${createRecordId("audit")}, ${playerId}, ${session.id}, 'game_submission_received', ${JSON.stringify({ gameTitleId: session.gameTitleId, gameSlug: session.gameSlug })}, now())
        `;

        await transaction`
          insert into game_results (id, session_id, player_id, game_title_id, status, placement, score_sort_value, display_value, elapsed_ms, rewards_json, flags_json, rejected_reason, result_summary_json, created_at)
          values (${resultId}, ${session.id}, ${playerId}, ${session.gameTitleId}, ${result.status}, ${result.placement}, ${result.scoreSortValue}, ${result.displayValue}, ${result.elapsedMs}, ${JSON.stringify(result.rewards)}, ${JSON.stringify(result.flags)}, ${result.rejectedReason ?? null}, ${JSON.stringify(result.resultSummary)}, now())
        `;

        if (result.status === "accepted") {
          for (const reward of result.rewards) {
            await transaction`
              insert into wallet_ledger (id, player_id, entry_type, amount, source_type, source_id, created_at)
              values (${createRecordId("ledger")}, ${playerId}, ${reward.entryType}, ${reward.amount}, ${reward.sourceType}, ${reward.sourceId}, now())
              on conflict (player_id, entry_type, source_type, source_id) do nothing
            `;
          }

          const coinsGranted = result.rewards
            .filter((reward) => reward.entryType === "coins")
            .reduce((sum, reward) => sum + reward.amount, 0);
          const xpGranted = result.rewards
            .filter((reward) => reward.entryType === "xp")
            .reduce((sum, reward) => sum + reward.amount, 0);

          await transaction`
            update wallets
            set coins = coins + ${coinsGranted},
                updated_at = now()
            where player_id = ${playerId}
          `;

          await transaction`
            update players
            set total_xp = total_xp + ${xpGranted},
                total_coins = total_coins + ${coinsGranted},
                level = greatest(1, floor((total_xp + ${xpGranted}) / 250) + 1),
                updated_at = now()
            where id = ${playerId}
          `;

          await transaction`
            update game_profiles
            set
              xp = xp + ${xpGranted},
              level = greatest(1, floor((xp + ${xpGranted}) / 250) + 1),
              updated_at = now()
            where player_id = ${playerId}
              and game_title_id = ${session.gameTitleId}
          `;

          if (session.gameSlug === "racer-poc") {
            await transaction`
              insert into racer_player_stats (player_id, game_title_id, sessions_started, sessions_completed, best_score_sort_value, best_display_value, created_at, updated_at)
              values (${playerId}, ${session.gameTitleId}, 0, 1, ${result.scoreSortValue}, ${result.displayValue}, now(), now())
              on conflict (player_id, game_title_id)
              do update set
                sessions_completed = racer_player_stats.sessions_completed + 1,
                best_score_sort_value = case
                  when racer_player_stats.best_score_sort_value is null then excluded.best_score_sort_value
                  else least(racer_player_stats.best_score_sort_value, excluded.best_score_sort_value)
                end,
                best_display_value = case
                  when racer_player_stats.best_score_sort_value is null then excluded.best_display_value
                  when excluded.best_score_sort_value < racer_player_stats.best_score_sort_value then excluded.best_display_value
                  else racer_player_stats.best_display_value
                end,
                updated_at = now()
            `;
          }

          if (session.gameSlug === "memory") {
            await transaction`
              insert into memory_player_stats (player_id, game_title_id, sessions_started, sessions_completed, best_score_sort_value, best_display_value, best_moves, best_time_ms, created_at, updated_at)
              values (${playerId}, ${session.gameTitleId}, 0, 1, ${result.scoreSortValue}, ${result.displayValue}, ${memorySummary?.totalMoves ?? null}, ${memorySummary?.officialTimeMs ?? null}, now(), now())
              on conflict (player_id, game_title_id)
              do update set
                sessions_completed = memory_player_stats.sessions_completed + 1,
                best_score_sort_value = case
                  when memory_player_stats.best_score_sort_value is null then excluded.best_score_sort_value
                  else least(memory_player_stats.best_score_sort_value, excluded.best_score_sort_value)
                end,
                best_display_value = case
                  when memory_player_stats.best_score_sort_value is null then excluded.best_display_value
                  when excluded.best_score_sort_value < memory_player_stats.best_score_sort_value then excluded.best_display_value
                  else memory_player_stats.best_display_value
                end,
                best_moves = case
                  when memory_player_stats.best_score_sort_value is null then excluded.best_moves
                  when excluded.best_score_sort_value < memory_player_stats.best_score_sort_value then excluded.best_moves
                  else memory_player_stats.best_moves
                end,
                best_time_ms = case
                  when memory_player_stats.best_score_sort_value is null then excluded.best_time_ms
                  when excluded.best_score_sort_value < memory_player_stats.best_score_sort_value then excluded.best_time_ms
                  else memory_player_stats.best_time_ms
                end,
                updated_at = now()
            `;
          }
        }

        for (const flag of result.flags) {
          await transaction`
            insert into cheat_flags (id, player_id, session_id, game_title_id, flag, payload_json, created_at)
            values (${createRecordId("flag")}, ${playerId}, ${session.id}, ${session.gameTitleId}, ${flag}, ${JSON.stringify({ status: result.status })}, now())
          `;
        }

        await transaction`
          insert into audit_events (id, player_id, session_id, event_type, payload_json, created_at)
          values (${createRecordId("audit")}, ${playerId}, ${session.id}, 'game_result_finalized', ${JSON.stringify({ gameTitleId: session.gameTitleId, gameSlug: session.gameSlug, status: result.status, placement: result.placement, scoreSortValue: result.scoreSortValue })}, now())
        `;

        const [created] = await transaction`
          select *
          from game_results
          where id = ${resultId}
        `;

        return created;
      });

      logger.info({ playerId, gameSessionId: session.id, status: finalized.status }, "postgres game session finalized");
      return mapGameResult(finalized);
    },

    async getLeaderboardPayload(gameSlug: string, window: LeaderboardWindow): Promise<LeaderboardPayload> {
      const viewName =
        window === "daily"
          ? "leaderboard_best_results_daily"
          : window === "weekly"
            ? "leaderboard_best_results_weekly"
            : "leaderboard_best_results_all_time";
      const entries = await sql.unsafe(
        `
          select placement, player_id, display_name, score_sort_value, display_value, level, total_coins, game_title_id, game_slug
          from ${viewName}
          where game_slug = $1
          order by placement asc
          limit 50
        `,
        [gameSlug]
      );

      const gameTitleId = entries[0]?.game_title_id ?? gameSlug;

      return {
        gameTitleId,
        gameSlug,
        window,
        entries: entries.map((entry) => ({
          placement: entry.placement,
          playerId: entry.player_id,
          displayName: entry.display_name,
          scoreSortValue: entry.score_sort_value,
          displayValue: entry.display_value,
          level: entry.level,
          totalCoins: entry.total_coins
        }))
      };
    },

    async getOpsDashboardPayload(gameSlug: string | null): Promise<OpsDashboardPayload> {
      const games = await sql`
        select slug, name
        from game_titles
        order by sort_order asc
      `;
      const selectedGameSlug = gameSlug ?? games[0]?.slug ?? null;
      const [kpiRow] = await sql`
        select * from ops_kpis limit 1
      `;

      const topPlayers = selectedGameSlug
        ? await sql`
            select placement, player_id, display_name, score_sort_value, display_value, level, total_coins
            from leaderboard_best_results_all_time
            where game_slug = ${selectedGameSlug}
            order by placement asc
            limit 8
          `
        : [];
      const recentSessions = await sql`
        select
          gs.id,
          gs.player_id,
          gs.game_title_id,
          gt.slug as game_slug,
          gs.config_version,
          gs.seed,
          gs.config_json,
          gs.status,
          gs.expires_at,
          gs.created_at,
          gs.submitted_at,
          gs.result_id
        from game_sessions gs
        join game_titles gt on gt.id = gs.game_title_id
        where ${selectedGameSlug}::text is null or gt.slug = ${selectedGameSlug}
        order by gs.created_at desc
        limit 8
      `;
      const suspiciousRuns = await sql`
        select cf.id, cf.player_id, cf.session_id, cf.game_title_id, cf.flag, cf.payload_json as payload, cf.created_at
        from cheat_flags cf
        join game_titles gt on gt.id = cf.game_title_id
        where ${selectedGameSlug}::text is null or gt.slug = ${selectedGameSlug}
        order by cf.created_at desc
        limit 8
      `;
      const clientErrors = await sql`
        select id, player_id, route, message, stack, user_agent, created_at
        from client_error_reports
        where not (
          route = 'app/error'
          and message like 'An error occurred in the Server Components render.%'
        )
        order by created_at desc
        limit 8
      `;
      const [selectedGameKpis] = selectedGameSlug
        ? await sql`
            select
              count(*) as session_starts,
              count(*) filter (where gr.status = 'accepted') as accepted_results,
              count(*) filter (where gr.status = 'rejected') as rejected_results,
              avg(gr.elapsed_ms) filter (where gr.status = 'accepted') as average_duration_ms
            from game_sessions gs
            join game_titles gt on gt.id = gs.game_title_id
            left join game_results gr on gr.session_id = gs.id
            where gt.slug = ${selectedGameSlug}
          `
        : [{ session_starts: 0, accepted_results: 0, rejected_results: 0, average_duration_ms: 0 }];

      return {
        filters: {
          selectedGameSlug,
          games: games.map((game) => ({
            slug: game.slug,
            name: game.name
          }))
        },
        kpis: [
          { label: "Total Players", value: String(kpiRow.total_players ?? 0), hint: "All registered Telegram identities" },
          { label: "New Players Today", value: String(kpiRow.new_players_today ?? 0), hint: "Daily acquisition" },
          { label: "DAU / WAU", value: `${kpiRow.dau ?? 0} / ${kpiRow.wau ?? 0}`, hint: "Active players" },
          { label: "Session Starts", value: String(selectedGameKpis?.session_starts ?? 0), hint: selectedGameSlug ? `${selectedGameSlug} official starts` : "Official sessions created" },
          { label: "Accepted Results", value: String(selectedGameKpis?.accepted_results ?? 0), hint: "Server-accepted results" },
          { label: "Average Duration", value: `${((selectedGameKpis?.average_duration_ms ?? 0) / 1000).toFixed(2)}s`, hint: "Accepted official runs" },
          { label: "Rewards Granted", value: String(kpiRow.rewards_granted ?? 0), hint: "Coins issued" },
          { label: "Suspicious Runs", value: String(kpiRow.suspicious_runs ?? 0), hint: "Cheat flags recorded" },
          { label: "Rejected Results", value: String(selectedGameKpis?.rejected_results ?? 0), hint: "Server-side rejections" },
          { label: "Client Errors", value: String(kpiRow.client_error_count ?? 0), hint: "Mini App issues reported" }
        ],
        topPlayers: topPlayers.map((entry) => ({
          placement: entry.placement,
          playerId: entry.player_id,
          displayName: entry.display_name,
          scoreSortValue: entry.score_sort_value,
          displayValue: entry.display_value,
          level: entry.level,
          totalCoins: entry.total_coins
        })),
        recentSessions: recentSessions.map(mapGameSession),
        suspiciousRuns: suspiciousRuns.map((row) => ({
          id: row.id,
          playerId: row.player_id,
          sessionId: row.session_id,
          gameTitleId: row.game_title_id,
          flag: row.flag,
          payload: parseDbJson(row.payload),
          createdAt: row.created_at
        })),
        clientErrors: clientErrors.map((row) => ({
          id: row.id,
          playerId: row.player_id,
          route: row.route,
          message: row.message,
          stack: row.stack,
          userAgent: row.user_agent,
          createdAt: row.created_at
        })),
        gameStats: []
      };
    },

    async reportClientError(
      playerId: string | null,
      payload: Omit<ClientErrorRecord, "id" | "createdAt" | "playerId">
    ) {
      await sql`
        insert into client_error_reports (id, player_id, route, message, stack, user_agent, created_at)
        values (${createRecordId("cerr")}, ${playerId}, ${payload.route}, ${payload.message}, ${payload.stack}, ${payload.userAgent}, now())
      `;
    },

    async appendAuditEvent(event: Omit<AuditEventRecord, "id" | "createdAt">) {
      await sql`
        insert into audit_events (id, player_id, session_id, event_type, payload_json, created_at)
        values (${createRecordId("audit")}, ${event.playerId}, ${event.sessionId}, ${event.eventType}, ${JSON.stringify(event.payload)}, now())
      `;
    }
  };
}
