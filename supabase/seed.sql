insert into game_titles (id, slug, name, status, tagline, description, cover_label, sort_order)
values (
  'racer-poc',
  'racer-poc',
  'Blockshift Circuit',
  'live',
  'Premium Telegram toy-racer sprint.',
  'Tilted top-down arcade racer with official server-validated results, XP, coins, and leaderboard progression.',
  'Premium POC',
  1
)
on conflict (id) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  status = excluded.status,
  sort_order = excluded.sort_order;

insert into game_titles (id, slug, name, status, tagline, description, cover_label, sort_order)
values (
  'memory',
  'memory',
  'Memory Match',
  'live',
  'Find all pairs as fast as you can.',
  'Classic 4x4 memory card matching game. Flip cards to find matching pairs — fewer moves and faster times earn bigger rewards.',
  'Puzzle',
  2
)
on conflict (id) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  status = excluded.status,
  sort_order = excluded.sort_order;

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
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  status = excluded.status,
  sort_order = excluded.sort_order;

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
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  status = excluded.status,
  sort_order = excluded.sort_order;

insert into game_titles (id, slug, name, status, tagline, description, cover_label, sort_order)
values (
  'vector-shift',
  'vector-shift',
  'Vector Shift',
  'live',
  'Cut across neon lanes and survive the charge stream.',
  'A one-thumb lane dodger with deterministic obstacle waves, collectible charges, and official server-verified runs for Telegram leaderboards.',
  'Reflex',
  5
)
on conflict (id) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  status = excluded.status,
  sort_order = excluded.sort_order;

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
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  status = excluded.status,
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
  tagline = excluded.tagline,
  description = excluded.description,
  cover_label = excluded.cover_label,
  status = excluded.status,
  sort_order = excluded.sort_order;

insert into racer_tracks (id, game_title_id, slug, name, version, snapshot_json)
values (
  'track-neon-loop',
  'racer-poc',
  'neon-loop',
  'Neon Loop',
  'racer-poc-v1',
  '{
    "laps": 3,
    "width": 120,
    "expectedMsRange": { "min": 45000, "max": 90000 }
  }'::jsonb
)
on conflict (id) do update set
  version = excluded.version,
  snapshot_json = excluded.snapshot_json;

insert into cosmetics (id, game_title_id, slug, name, type)
values
  ('cosmetic-starter-paint', 'racer-poc', 'starter-paint', 'Starter Paint', 'paint')
on conflict (id) do nothing;
