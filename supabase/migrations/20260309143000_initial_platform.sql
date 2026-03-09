create table if not exists players (
  id text primary key,
  telegram_user_id text not null unique,
  username_snapshot text,
  display_name_snapshot text not null,
  avatar_url text,
  total_xp integer not null default 0,
  total_coins integer not null default 0,
  level integer not null default 1 check (level > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists telegram_accounts (
  player_id text not null references players(id) on delete cascade,
  telegram_user_id text primary key,
  username_snapshot text,
  display_name_snapshot text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists admin_users (
  id text primary key,
  player_id text unique references players(id) on delete cascade,
  telegram_user_id text unique,
  role text not null default 'ops',
  created_at timestamptz not null default now()
);

create table if not exists game_titles (
  id text primary key,
  slug text not null unique,
  name text not null,
  status text not null check (status in ('live', 'coming_soon')),
  tagline text not null,
  description text not null,
  cover_label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists game_profiles (
  player_id text not null references players(id) on delete cascade,
  game_title_id text not null references game_titles(id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  races_started integer not null default 0,
  races_finished integer not null default 0,
  best_time_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, game_title_id)
);

create table if not exists race_tracks (
  id text primary key,
  game_title_id text not null references game_titles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  version text not null,
  snapshot_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists race_sessions (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  game_title_id text not null references game_titles(id) on delete cascade,
  track_id text not null references race_tracks(id) on delete restrict,
  config_version text not null,
  seed integer not null,
  config_json jsonb not null,
  status text not null check (status in ('created', 'submitted', 'accepted', 'rejected', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  result_id text
);

create table if not exists race_inputs (
  session_id text primary key references race_sessions(id) on delete cascade,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists race_results (
  id text primary key,
  session_id text not null unique references race_sessions(id) on delete cascade,
  player_id text not null references players(id) on delete cascade,
  status text not null check (status in ('accepted', 'rejected')),
  placement integer not null,
  official_time_ms integer not null,
  elapsed_ms integer not null,
  rewards_json jsonb not null default '[]'::jsonb,
  cheat_flags_json jsonb not null default '[]'::jsonb,
  rejected_reason text,
  finishers_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists wallets (
  player_id text primary key references players(id) on delete cascade,
  coins integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_ledger (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  entry_type text not null check (entry_type in ('xp', 'coins')),
  amount integer not null,
  source_type text not null,
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (player_id, entry_type, source_type, source_id)
);

create table if not exists cosmetics (
  id text primary key,
  game_title_id text not null references game_titles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  type text not null,
  created_at timestamptz not null default now()
);

create table if not exists player_unlocks (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  cosmetic_id text not null references cosmetics(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (player_id, cosmetic_id)
);

create table if not exists audit_events (
  id text primary key,
  player_id text references players(id) on delete set null,
  session_id text references race_sessions(id) on delete set null,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists cheat_flags (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  session_id text not null references race_sessions(id) on delete cascade,
  flag text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists client_error_reports (
  id text primary key,
  player_id text references players(id) on delete set null,
  route text not null,
  message text not null,
  stack text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists analytics_daily_rollups (
  date_key date not null,
  game_title_id text not null references game_titles(id) on delete cascade,
  new_players integer not null default 0,
  dau integer not null default 0,
  wau integer not null default 0,
  race_starts integer not null default 0,
  race_finishes integer not null default 0,
  rewards_granted integer not null default 0,
  suspicious_runs integer not null default 0,
  rejected_submissions integer not null default 0,
  client_errors integer not null default 0,
  primary key (date_key, game_title_id)
);

create table if not exists analytics_game_rollups (
  game_title_id text primary key references game_titles(id) on delete cascade,
  total_players integer not null default 0,
  total_race_starts integer not null default 0,
  total_race_finishes integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_auth_sessions_player_id on auth_sessions(player_id);
create index if not exists idx_race_sessions_player_id on race_sessions(player_id, created_at desc);
create index if not exists idx_race_results_player_id on race_results(player_id, created_at desc);
create index if not exists idx_wallet_ledger_player_id on wallet_ledger(player_id, created_at desc);
create index if not exists idx_audit_events_player_id on audit_events(player_id, created_at desc);
create index if not exists idx_cheat_flags_player_id on cheat_flags(player_id, created_at desc);
create index if not exists idx_client_error_reports_created_at on client_error_reports(created_at desc);

create or replace view leaderboards_all_time as
with best_runs as (
  select
    rr.player_id,
    min(rr.official_time_ms) as best_time_ms
  from race_results rr
  where rr.status = 'accepted'
  group by rr.player_id
)
select
  row_number() over (order by br.best_time_ms asc, p.display_name_snapshot asc) as placement,
  p.id as player_id,
  p.display_name_snapshot as display_name,
  br.best_time_ms,
  p.level,
  p.total_coins
from best_runs br
join players p on p.id = br.player_id;

create or replace view leaderboards_daily as
with best_runs as (
  select
    rr.player_id,
    min(rr.official_time_ms) as best_time_ms
  from race_results rr
  where rr.status = 'accepted'
    and rr.created_at >= date_trunc('day', now())
  group by rr.player_id
)
select
  row_number() over (order by br.best_time_ms asc, p.display_name_snapshot asc) as placement,
  p.id as player_id,
  p.display_name_snapshot as display_name,
  br.best_time_ms,
  p.level,
  p.total_coins
from best_runs br
join players p on p.id = br.player_id;

create or replace view leaderboards_weekly as
with best_runs as (
  select
    rr.player_id,
    min(rr.official_time_ms) as best_time_ms
  from race_results rr
  where rr.status = 'accepted'
    and rr.created_at >= date_trunc('week', now())
  group by rr.player_id
)
select
  row_number() over (order by br.best_time_ms asc, p.display_name_snapshot asc) as placement,
  p.id as player_id,
  p.display_name_snapshot as display_name,
  br.best_time_ms,
  p.level,
  p.total_coins
from best_runs br
join players p on p.id = br.player_id;

create or replace view ops_kpis as
select
  (select count(*) from players) as total_players,
  (select count(*) from players where created_at >= date_trunc('day', now())) as new_players_today,
  (select count(*) from players where last_seen_at >= date_trunc('day', now())) as dau,
  (select count(*) from players where last_seen_at >= now() - interval '7 days') as wau,
  (select count(*) from race_sessions) as total_race_starts,
  (select count(*) from race_results where status = 'accepted') as total_race_finishes,
  coalesce(
    round(
      ((select count(*) from race_results where status = 'accepted')::numeric / nullif((select count(*) from race_sessions), 0)) * 100
    ),
    0
  ) as completion_rate,
  (select avg(official_time_ms) from race_results where status = 'accepted') as average_race_duration_ms,
  (select coalesce(sum(amount), 0) from wallet_ledger where entry_type = 'coins') as rewards_granted,
  (select count(*) from cheat_flags) as suspicious_runs,
  (select count(*) from race_results where status = 'rejected') as rejected_submissions,
  (select count(*) from client_error_reports) as client_error_count;

alter table players enable row level security;
alter table telegram_accounts enable row level security;
alter table auth_sessions enable row level security;
alter table admin_users enable row level security;
alter table game_titles enable row level security;
alter table game_profiles enable row level security;
alter table race_tracks enable row level security;
alter table race_sessions enable row level security;
alter table race_inputs enable row level security;
alter table race_results enable row level security;
alter table wallets enable row level security;
alter table wallet_ledger enable row level security;
alter table cosmetics enable row level security;
alter table player_unlocks enable row level security;
alter table audit_events enable row level security;
alter table cheat_flags enable row level security;
alter table client_error_reports enable row level security;
alter table analytics_daily_rollups enable row level security;
alter table analytics_game_rollups enable row level security;

create policy "public read game titles"
  on game_titles for select
  using (true);

create policy "public read race tracks"
  on race_tracks for select
  using (true);

create policy "public read cosmetics"
  on cosmetics for select
  using (true);
