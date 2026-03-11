import type { RaceTrackSnapshot, Vector2 } from "./types";

export const racerTrack: RaceTrackSnapshot = {
  id: "track-neon-loop",
  slug: "neon-loop",
  name: "Neon Loop",
  version: "racer-poc-v3",
  laps: 3,
  width: 120,
  expectedMsRange: {
    min: 38000,
    max: 80000
  },
  startPositions: [
    { x: 432, y: 580, angle: -0.78 },
    { x: 414, y: 593, angle: -0.78 },
    { x: 397, y: 606, angle: -0.78 },
    { x: 379, y: 620, angle: -0.78 },
    { x: 362, y: 633, angle: -0.78 },
    { x: 345, y: 647, angle: -0.78 }
  ],
  waypoints: [
    // Start/finish line
    { x: 432, y: 580 },

    // Turn 1 – sweeping right into back straight
    { x: 470, y: 520 },
    { x: 520, y: 465 },
    { x: 580, y: 420 },
    { x: 650, y: 385 },

    // Back straight
    { x: 740, y: 358 },
    { x: 840, y: 340 },
    { x: 940, y: 340 },

    // Braking zone
    { x: 1030, y: 355 },
    { x: 1100, y: 385 },

    // Hairpin
    { x: 1155, y: 430 },
    { x: 1190, y: 490 },
    { x: 1200, y: 555 },
    { x: 1190, y: 620 },
    { x: 1155, y: 675 },
    { x: 1100, y: 715 },

    // S-curve
    { x: 1035, y: 740 },
    { x: 970, y: 790 },
    { x: 910, y: 795 },
    { x: 840, y: 830 },
    { x: 770, y: 848 },

    // Bottom sweeper
    { x: 680, y: 855 },
    { x: 580, y: 845 },
    { x: 490, y: 815 },

    // Final approach
    { x: 415, y: 775 },
    { x: 360, y: 725 },
    { x: 320, y: 670 },
    { x: 365, y: 630 }
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
