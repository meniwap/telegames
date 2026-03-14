insert into game_titles (id, slug, name, status, tagline, description, cover_label, sort_order)
values (
  'photon-pinball',
  'photon-pinball',
  'Photon Pinball',
  'live',
  'Rip premium rebounds through a toy-tech pinball chamber.',
  'A three-ball premium pinball run with authoritative server replay, left and right flippers, controlled nudges, jackpots, and official Telegram leaderboard results.',
  'Pinball',
  8
)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  sort_order = excluded.sort_order;

create table if not exists photon_pinball_player_stats (
  player_id              text        not null references players(id) on delete cascade,
  game_title_id          text        not null references game_titles(id) on delete cascade,
  sessions_started       integer     not null default 0,
  sessions_completed     integer     not null default 0,
  best_score_sort_value  integer,
  best_display_value     text,
  best_score             integer,
  best_jackpots          integer,
  best_combo_peak        integer,
  best_survival_ms       integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  primary key (player_id, game_title_id)
);

insert into game_profiles (player_id, game_title_id, xp, level, created_at, updated_at)
select p.id, gt.id, 0, 1, now(), now()
from players p
join game_titles gt on gt.slug = 'photon-pinball'
on conflict (player_id, game_title_id) do nothing;

insert into photon_pinball_player_stats (
  player_id,
  game_title_id,
  sessions_started,
  sessions_completed,
  best_score_sort_value,
  best_display_value,
  best_score,
  best_jackpots,
  best_combo_peak,
  best_survival_ms,
  created_at,
  updated_at
)
select p.id, gt.id, 0, 0, null, null, null, null, null, null, now(), now()
from players p
join game_titles gt on gt.slug = 'photon-pinball'
on conflict (player_id, game_title_id) do nothing;

alter table photon_pinball_player_stats enable row level security;

create policy "photon_pinball_player_stats_select_own"
  on photon_pinball_player_stats for select
  using (player_id = current_setting('app.current_player_id', true));

create policy "photon_pinball_player_stats_insert_own"
  on photon_pinball_player_stats for insert
  with check (player_id = current_setting('app.current_player_id', true));

create policy "photon_pinball_player_stats_update_own"
  on photon_pinball_player_stats for update
  using (player_id = current_setting('app.current_player_id', true));
