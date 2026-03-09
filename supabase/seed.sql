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
