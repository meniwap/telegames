import type { CarPreset, CpuProfile } from "./types";

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_REPLAY_FRAMES = TICK_RATE * 120;

export const INPUT_LEFT = 1 << 0;
export const INPUT_RIGHT = 1 << 1;
export const INPUT_BRAKE = 1 << 2;

export const starterCarPreset: CarPreset = {
  id: "starter-voxel-runner",
  label: "Voxel Runner",
  acceleration: 118,
  braking: 182,
  drag: 0.992,
  offTrackDrag: 0.946,
  turnRate: 2.65,
  maxSpeed: 180,
  driftTurnBonus: 0.72
};

export const defaultCpuProfiles: CpuProfile[] = [
  {
    id: "cpu-1",
    label: "Quartz",
    aggression: 0.54,
    precision: 0.82,
    preferredSpeedRatio: 0.78
  },
  {
    id: "cpu-2",
    label: "Gauge",
    aggression: 0.61,
    precision: 0.86,
    preferredSpeedRatio: 0.84
  },
  {
    id: "cpu-3",
    label: "Rivet",
    aggression: 0.65,
    precision: 0.84,
    preferredSpeedRatio: 0.91
  },
  {
    id: "cpu-4",
    label: "Vector",
    aggression: 0.72,
    precision: 0.82,
    preferredSpeedRatio: 0.96
  },
  {
    id: "cpu-5",
    label: "Pulse",
    aggression: 0.76,
    precision: 0.92,
    preferredSpeedRatio: 1.0
  }
];
