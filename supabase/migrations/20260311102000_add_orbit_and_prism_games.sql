insert into game_titles (id, slug, name, status, tagline, description, cover_label, sort_order)
values (
  'orbit-forge',
  'orbit-forge',
  'Orbit Forge',
  'live',
  'Swap rings, phase hazards, and steal charge shards.',
  'A toy-tech orbital survival challenge with ring swaps, short phase pulses, shard pickups, and authoritative server-verified runs for Telegram leaderboards.',
  'Orbit',
  6
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  sort_order = excluded.sort_order;

insert into game_titles (id, slug, name, status, tagline, description, cover_label, sort_order)
values (
  'prism-break',
  'prism-break',
  'Prism Break',
  'live',
  'Shatter premium prism walls with lane-perfect rebounds.',
  'A one-thumb prism breaker with lane-based deflection, magnet catch control, glass-burst chains, and server-authoritative leaderboard runs.',
  'Breaker',
  7
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  sort_order = excluded.sort_order;

create table if not exists orbit_forge_player_stats (
  player_id              text        not null references players(id) on delete cascade,
  game_title_id          text        not null references game_titles(id) on delete cascade,
  sessions_started       integer     not null default 0,
  sessions_completed     integer     not null default 0,
  best_score_sort_value  integer,
  best_display_value     text,
  best_gates             integer,
  best_shards            integer,
  best_survival_ms       integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (player_id, game_title_id)
);

create table if not exists prism_break_player_stats (
  player_id              text        not null references players(id) on delete cascade,
  game_title_id          text        not null references game_titles(id) on delete cascade,
  sessions_started       integer     not null default 0,
  sessions_completed     integer     not null default 0,
  best_score_sort_value  integer,
  best_display_value     text,
  best_prisms            integer,
  best_chain_bursts      integer,
  best_survival_ms       integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (player_id, game_title_id)
);

insert into game_profiles (player_id, game_title_id, xp, level, created_at, updated_at)
select p.id, gt.id, 0, 1, now(), now()
from players p
join game_titles gt on gt.slug in ('orbit-forge', 'prism-break')
on conflict (player_id, game_title_id) do nothing;

insert into orbit_forge_player_stats (
  player_id,
  game_title_id,
  sessions_started,
  sessions_completed,
  best_score_sort_value,
  best_display_value,
  best_gates,
  best_shards,
  best_survival_ms,
  created_at,
  updated_at
)
select p.id, gt.id, 0, 0, null, null, null, null, null, now(), now()
from players p
join game_titles gt on gt.slug = 'orbit-forge'
on conflict (player_id, game_title_id) do nothing;

insert into prism_break_player_stats (
  player_id,
  game_title_id,
  sessions_started,
  sessions_completed,
  best_score_sort_value,
  best_display_value,
  best_prisms,
  best_chain_bursts,
  best_survival_ms,
  created_at,
  updated_at
)
select p.id, gt.id, 0, 0, null, null, null, null, null, now(), now()
from players p
join game_titles gt on gt.slug = 'prism-break'
on conflict (player_id, game_title_id) do nothing;

alter table orbit_forge_player_stats enable row level security;
alter table prism_break_player_stats enable row level security;

create policy "orbit_forge_player_stats_select_own"
  on orbit_forge_player_stats for select
  using (player_id = current_setting('app.current_player_id', true));

create policy "orbit_forge_player_stats_insert_own"
  on orbit_forge_player_stats for insert
  with check (player_id = current_setting('app.current_player_id', true));

create policy "orbit_forge_player_stats_update_own"
  on orbit_forge_player_stats for update
  using (player_id = current_setting('app.current_player_id', true));

create policy "prism_break_player_stats_select_own"
  on prism_break_player_stats for select
  using (player_id = current_setting('app.current_player_id', true));

create policy "prism_break_player_stats_insert_own"
  on prism_break_player_stats for insert
  with check (player_id = current_setting('app.current_player_id', true));

create policy "prism_break_player_stats_update_own"
  on prism_break_player_stats for update
  using (player_id = current_setting('app.current_player_id', true));
