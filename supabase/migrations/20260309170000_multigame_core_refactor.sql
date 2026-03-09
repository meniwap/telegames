do $$
begin
  if to_regclass('public.race_tracks') is not null and to_regclass('public.racer_tracks') is null then
    alter table race_tracks rename to racer_tracks;
  end if;

  if to_regclass('public.race_sessions') is not null and to_regclass('public.game_sessions') is null then
    alter table race_sessions rename to game_sessions;
  end if;

  if to_regclass('public.race_inputs') is not null and to_regclass('public.game_submissions') is null then
    alter table race_inputs rename to game_submissions;
  end if;

  if to_regclass('public.race_results') is not null and to_regclass('public.game_results') is null then
    alter table race_results rename to game_results;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_class where relkind = 'i' and relname = 'idx_race_sessions_player_id')
     and not exists (select 1 from pg_class where relkind = 'i' and relname = 'idx_game_sessions_player_id') then
    alter index idx_race_sessions_player_id rename to idx_game_sessions_player_id;
  end if;

  if exists (select 1 from pg_class where relkind = 'i' and relname = 'idx_race_results_player_id')
     and not exists (select 1 from pg_class where relkind = 'i' and relname = 'idx_game_results_player_id') then
    alter index idx_race_results_player_id rename to idx_game_results_player_id;
  end if;
end $$;

create table if not exists racer_player_stats (
  player_id text not null references players(id) on delete cascade,
  game_title_id text not null references game_titles(id) on delete cascade,
  sessions_started integer not null default 0,
  sessions_completed integer not null default 0,
  best_score_sort_value integer,
  best_display_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, game_title_id)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_profiles'
      and column_name = 'races_started'
  ) then
    insert into racer_player_stats (
      player_id,
      game_title_id,
      sessions_started,
      sessions_completed,
      best_score_sort_value,
      best_display_value,
      created_at,
      updated_at
    )
    select
      gp.player_id,
      gp.game_title_id,
      coalesce(gp.races_started, 0),
      coalesce(gp.races_finished, 0),
      gp.best_time_ms,
      case
        when gp.best_time_ms is null then null
        else to_char(gp.best_time_ms::numeric / 1000, 'FM999990.00') || 's'
      end,
      gp.created_at,
      gp.updated_at
    from game_profiles gp
    on conflict (player_id, game_title_id) do update set
      sessions_started = excluded.sessions_started,
      sessions_completed = excluded.sessions_completed,
      best_score_sort_value = excluded.best_score_sort_value,
      best_display_value = excluded.best_display_value,
      updated_at = excluded.updated_at;
  end if;
end $$;

alter table if exists game_profiles drop column if exists races_started;
alter table if exists game_profiles drop column if exists races_finished;
alter table if exists game_profiles drop column if exists best_time_ms;

alter table if exists game_sessions drop column if exists track_id;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_results'
      and column_name = 'official_time_ms'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_results'
      and column_name = 'score_sort_value'
  ) then
    alter table game_results rename column official_time_ms to score_sort_value;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_results'
      and column_name = 'cheat_flags_json'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_results'
      and column_name = 'flags_json'
  ) then
    alter table game_results rename column cheat_flags_json to flags_json;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_results'
      and column_name = 'finishers_json'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'game_results'
      and column_name = 'result_summary_json'
  ) then
    alter table game_results rename column finishers_json to result_summary_json;
  end if;
end $$;

alter table if exists game_results add column if not exists game_title_id text;
alter table if exists game_results add column if not exists display_value text;
alter table if exists game_results add column if not exists flags_json jsonb not null default '[]'::jsonb;
alter table if exists game_results add column if not exists result_summary_json jsonb not null default '{}'::jsonb;

update game_results gr
set game_title_id = gs.game_title_id
from game_sessions gs
where gs.id = gr.session_id
  and gr.game_title_id is null;

update game_results
set display_value = to_char(score_sort_value::numeric / 1000, 'FM999990.00') || 's'
where display_value is null
  and score_sort_value is not null;

update game_results
set result_summary_json = jsonb_build_object(
  'officialTimeMs',
  score_sort_value,
  'finishers',
  result_summary_json
)
where jsonb_typeof(result_summary_json) = 'array';

alter table if exists game_results alter column placement drop not null;
alter table if exists game_results alter column game_title_id set not null;
alter table if exists game_results alter column display_value set not null;
alter table if exists game_results alter column result_summary_json set default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'game_results_game_title_id_fkey'
  ) then
    alter table game_results
      add constraint game_results_game_title_id_fkey
      foreign key (game_title_id) references game_titles(id) on delete cascade;
  end if;
end $$;

alter table if exists cheat_flags add column if not exists game_title_id text;

update cheat_flags cf
set game_title_id = gs.game_title_id
from game_sessions gs
where gs.id = cf.session_id
  and cf.game_title_id is null;

alter table if exists cheat_flags alter column game_title_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cheat_flags_game_title_id_fkey'
  ) then
    alter table cheat_flags
      add constraint cheat_flags_game_title_id_fkey
      foreign key (game_title_id) references game_titles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_daily_rollups'
      and column_name = 'race_starts'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_daily_rollups'
      and column_name = 'session_starts'
  ) then
    alter table analytics_daily_rollups rename column race_starts to session_starts;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_daily_rollups'
      and column_name = 'race_finishes'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_daily_rollups'
      and column_name = 'session_finishes'
  ) then
    alter table analytics_daily_rollups rename column race_finishes to session_finishes;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_game_rollups'
      and column_name = 'total_race_starts'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_game_rollups'
      and column_name = 'total_session_starts'
  ) then
    alter table analytics_game_rollups rename column total_race_starts to total_session_starts;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_game_rollups'
      and column_name = 'total_race_finishes'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'analytics_game_rollups'
      and column_name = 'total_session_finishes'
  ) then
    alter table analytics_game_rollups rename column total_race_finishes to total_session_finishes;
  end if;
end $$;

create index if not exists idx_game_sessions_player_id on game_sessions(player_id, created_at desc);
create index if not exists idx_game_results_player_id on game_results(player_id, created_at desc);
create index if not exists idx_game_results_game_title_score on game_results(game_title_id, status, score_sort_value, created_at desc);
create index if not exists idx_cheat_flags_game_title_id on cheat_flags(game_title_id, created_at desc);

create or replace view leaderboard_best_results_all_time as
with best_results as (
  select
    gr.game_title_id,
    gt.slug as game_slug,
    gr.player_id,
    gr.score_sort_value,
    gr.display_value,
    gr.created_at,
    row_number() over (
      partition by gr.game_title_id, gr.player_id
      order by gr.score_sort_value asc, gr.created_at asc, gr.id asc
    ) as player_best_rank
  from game_results gr
  join game_titles gt on gt.id = gr.game_title_id
  where gr.status = 'accepted'
)
select
  row_number() over (
    partition by br.game_title_id
    order by br.score_sort_value asc, p.display_name_snapshot asc, br.player_id asc
  ) as placement,
  br.player_id,
  p.display_name_snapshot as display_name,
  br.score_sort_value,
  br.display_value,
  p.level,
  p.total_coins,
  br.game_title_id,
  br.game_slug
from best_results br
join players p on p.id = br.player_id
where br.player_best_rank = 1;

create or replace view leaderboard_best_results_daily as
with best_results as (
  select
    gr.game_title_id,
    gt.slug as game_slug,
    gr.player_id,
    gr.score_sort_value,
    gr.display_value,
    gr.created_at,
    row_number() over (
      partition by gr.game_title_id, gr.player_id
      order by gr.score_sort_value asc, gr.created_at asc, gr.id asc
    ) as player_best_rank
  from game_results gr
  join game_titles gt on gt.id = gr.game_title_id
  where gr.status = 'accepted'
    and gr.created_at >= date_trunc('day', now())
)
select
  row_number() over (
    partition by br.game_title_id
    order by br.score_sort_value asc, p.display_name_snapshot asc, br.player_id asc
  ) as placement,
  br.player_id,
  p.display_name_snapshot as display_name,
  br.score_sort_value,
  br.display_value,
  p.level,
  p.total_coins,
  br.game_title_id,
  br.game_slug
from best_results br
join players p on p.id = br.player_id
where br.player_best_rank = 1;

create or replace view leaderboard_best_results_weekly as
with best_results as (
  select
    gr.game_title_id,
    gt.slug as game_slug,
    gr.player_id,
    gr.score_sort_value,
    gr.display_value,
    gr.created_at,
    row_number() over (
      partition by gr.game_title_id, gr.player_id
      order by gr.score_sort_value asc, gr.created_at asc, gr.id asc
    ) as player_best_rank
  from game_results gr
  join game_titles gt on gt.id = gr.game_title_id
  where gr.status = 'accepted'
    and gr.created_at >= date_trunc('week', now())
)
select
  row_number() over (
    partition by br.game_title_id
    order by br.score_sort_value asc, p.display_name_snapshot asc, br.player_id asc
  ) as placement,
  br.player_id,
  p.display_name_snapshot as display_name,
  br.score_sort_value,
  br.display_value,
  p.level,
  p.total_coins,
  br.game_title_id,
  br.game_slug
from best_results br
join players p on p.id = br.player_id
where br.player_best_rank = 1;

drop view if exists ops_kpis;

create or replace view ops_kpis as
select
  (select count(*) from players) as total_players,
  (select count(*) from players where created_at >= date_trunc('day', now())) as new_players_today,
  (select count(*) from players where last_seen_at >= date_trunc('day', now())) as dau,
  (select count(*) from players where last_seen_at >= now() - interval '7 days') as wau,
  (select count(*) from game_sessions) as total_session_starts,
  (select count(*) from game_results where status = 'accepted') as total_session_finishes,
  coalesce(
    round(
      ((select count(*) from game_results where status = 'accepted')::numeric / nullif((select count(*) from game_sessions), 0)) * 100
    ),
    0
  ) as completion_rate,
  (select avg(elapsed_ms) from game_results where status = 'accepted') as average_session_duration_ms,
  (select coalesce(sum(amount), 0) from wallet_ledger where entry_type = 'coins') as rewards_granted,
  (select count(*) from cheat_flags) as suspicious_runs,
  (select count(*) from game_results where status = 'rejected') as rejected_submissions,
  (select count(*) from client_error_reports) as client_error_count;

alter table if exists racer_player_stats enable row level security;
alter table if exists game_sessions enable row level security;
alter table if exists game_submissions enable row level security;
alter table if exists game_results enable row level security;
alter table if exists racer_tracks enable row level security;
