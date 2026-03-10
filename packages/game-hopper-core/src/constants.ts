export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const TICK_SECONDS = 1 / TICK_RATE;

export const WORLD_WIDTH = 360;
export const WORLD_HEIGHT = 640;
export const WORLD_PADDING = 16;

export const BIRD_START_X = 118;
export const BIRD_START_Y = 320;
export const BIRD_RADIUS = 18;

export const PIPE_WIDTH = 76;
export const STREAM_START_X = 520;
export const MIN_SPAWN_SPACING = 188;
export const MAX_SPAWN_SPACING = 238;
export const MIN_GAP_HEIGHT = 172;
export const MAX_GAP_HEIGHT = 214;
export const MIN_GAP_CENTER = 176;
export const MAX_GAP_CENTER = WORLD_HEIGHT - 176;

export const GRAVITY = 1050;
export const FLAP_VELOCITY = -348;
export const BASE_SPEED = 160;
export const SPEED_RAMP = 4;
export const MAX_SPEED = 228;

export const MAX_DURATION_MS = 180000;
export const MAX_TICKS = Math.floor(MAX_DURATION_MS / TICK_MS);
export const MAX_REPLAY_FLAPS = 2200;
