import type { RaceTrackSnapshot, Vector2 } from "./types";

export const racerTrack: RaceTrackSnapshot = {
  id: "track-neon-loop",
  slug: "neon-loop",
  name: "Neon Loop",
  version: "racer-poc-v2",
  laps: 3,
  width: 120,
  expectedMsRange: {
    min: 45000,
    max: 90000
  },
  startPositions: [
    { x: 380, y: 508, angle: -0.92 },
    { x: 338, y: 538, angle: -0.92 },
    { x: 296, y: 568, angle: -0.92 },
    { x: 254, y: 598, angle: -0.92 },
    { x: 212, y: 628, angle: -0.92 },
    { x: 170, y: 658, angle: -0.92 }
  ],
  waypoints: [
    { x: 402, y: 530 },
    { x: 516, y: 414 },
    { x: 700, y: 324 },
    { x: 920, y: 298 },
    { x: 1114, y: 356 },
    { x: 1258, y: 512 },
    { x: 1268, y: 714 },
    { x: 1114, y: 868 },
    { x: 862, y: 922 },
    { x: 598, y: 886 },
    { x: 390, y: 814 },
    { x: 282, y: 690 }
  ]
};

export type TrackRuntime = {
  totalLength: number;
  cumulativeLengths: number[];
};

export function buildTrackRuntime(track: RaceTrackSnapshot): TrackRuntime {
  const cumulativeLengths = [0];
  let totalLength = 0;

  for (let index = 0; index < track.waypoints.length; index += 1) {
    const start = track.waypoints[index]!;
    const end = track.waypoints[(index + 1) % track.waypoints.length]!;
    totalLength += Math.hypot(end.x - start.x, end.y - start.y);
    cumulativeLengths.push(totalLength);
  }

  return {
    totalLength,
    cumulativeLengths
  };
}

export function projectOntoTrack(point: Vector2, track: RaceTrackSnapshot, runtime: TrackRuntime) {
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestProgress = 0;
  let bestPoint: Vector2 = track.waypoints[0]!;
  let bestSegmentAngle = 0;

  for (let index = 0; index < track.waypoints.length; index += 1) {
    const start = track.waypoints[index]!;
    const end = track.waypoints[(index + 1) % track.waypoints.length]!;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    const rawT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
    const t = Math.min(Math.max(rawT, 0), 1);
    const projected = {
      x: start.x + dx * t,
      y: start.y + dy * t
    };
    const distance = Math.hypot(projected.x - point.x, projected.y - point.y);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = projected;
      bestProgress = runtime.cumulativeLengths[index]! + Math.hypot(projected.x - start.x, projected.y - start.y);
      bestSegmentAngle = Math.atan2(dy, dx);
    }
  }

  return {
    projectedPoint: bestPoint,
    distanceFromCenter: bestDistance,
    progress: bestProgress,
    segmentAngle: bestSegmentAngle
  };
}
