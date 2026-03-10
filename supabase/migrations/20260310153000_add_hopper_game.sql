insert into game_titles (id, slug, name, status, tagline, description, cover_label, sort_order)
values (
  'skyline-hopper',
  'skyline-hopper',
  'Skyline Hopper',
  'live',
  'Tap through the skyline and clear premium gate runs.',
  'Touch-driven endless hopper with authoritative server replay, premium obstacle lanes, and short-session leaderboard climbs inside Telegram.',
  'Arcade',
  3
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  sort_order = excluded.sort_order;

create table if not exists hopper_player_stats (
  player_id              text        not null references players(id) on delete cascade,
  game_title_id          text        not null references game_titles(id) on delete cascade,
  sessions_started       integer     not null default 0,
  sessions_completed     integer     not null default 0,
  best_score_sort_value  integer,
  best_display_value     text,
  best_gates             integer,
  best_survival_ms       integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (player_id, game_title_id)
);

insert into game_profiles (player_id, game_title_id, xp, level, created_at, updated_at)
select p.id, gt.id, 0, 1, now(), now()
from players p
join game_titles gt on gt.slug = 'skyline-hopper'
on conflict (player_id, game_title_id) do nothing;

insert into hopper_player_stats (
  player_id,
  game_title_id,
  sessions_started,
  sessions_completed,
  best_score_sort_value,
  best_display_value,
  best_gates,
  best_survival_ms,
  created_at,
  updated_at
)
select p.id, gt.id, 0, 0, null, null, null, null, now(), now()
from players p
join game_titles gt on gt.slug = 'skyline-hopper'
on conflict (player_id, game_title_id) do nothing;

alter table hopper_player_stats enable row level security;

create policy "hopper_player_stats_select_own"
  on hopper_player_stats for select
  using (player_id = current_setting('app.current_player_id', true));

create policy "hopper_player_stats_insert_own"
  on hopper_player_stats for insert
  with check (player_id = current_setting('app.current_player_id', true));

create policy "hopper_player_stats_update_own"
  on hopper_player_stats for update
  using (player_id = current_setting('app.current_player_id', true));
