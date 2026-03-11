insert into game_titles (id, slug, name, status, tagline, description, cover_label, sort_order)
values (
  'signal-stacker',
  'signal-stacker',
  'Signal Stacker',
  'live',
  'Drop precision stacks and hold the tower steady.',
  'A tactile one-thumb stacking challenge with server-verified timing, perfect-drop bonuses, and fast leaderboard climbs inside Telegram.',
  'Precision',
  4
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  sort_order = excluded.sort_order;

create table if not exists signal_stacker_player_stats (
  player_id              text        not null references players(id) on delete cascade,
  game_title_id          text        not null references game_titles(id) on delete cascade,
  sessions_started       integer     not null default 0,
  sessions_completed     integer     not null default 0,
  best_score_sort_value  integer,
  best_display_value     text,
  best_floors            integer,
  best_perfect_drops     integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (player_id, game_title_id)
);

insert into game_profiles (player_id, game_title_id, xp, level, created_at, updated_at)
select p.id, gt.id, 0, 1, now(), now()
from players p
join game_titles gt on gt.slug = 'signal-stacker'
on conflict (player_id, game_title_id) do nothing;

insert into signal_stacker_player_stats (
  player_id,
  game_title_id,
  sessions_started,
  sessions_completed,
  best_score_sort_value,
  best_display_value,
  best_floors,
  best_perfect_drops,
  created_at,
  updated_at
)
select p.id, gt.id, 0, 0, null, null, null, null, now(), now()
from players p
join game_titles gt on gt.slug = 'signal-stacker'
on conflict (player_id, game_title_id) do nothing;

alter table signal_stacker_player_stats enable row level security;

create policy "signal_stacker_player_stats_select_own"
  on signal_stacker_player_stats for select
  using (player_id = current_setting('app.current_player_id', true));

create policy "signal_stacker_player_stats_insert_own"
  on signal_stacker_player_stats for insert
  with check (player_id = current_setting('app.current_player_id', true));

create policy "signal_stacker_player_stats_update_own"
  on signal_stacker_player_stats for update
  using (player_id = current_setting('app.current_player_id', true));
