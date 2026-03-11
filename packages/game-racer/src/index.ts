import * as Phaser from "phaser";

import { TICK_MS, createInitialRaceState, replayRace, stepRaceState } from "@telegramplay/game-racer-core";
import type { OfficialRacerResult, RaceState, RacerReplayPayload, RacerSessionConfig } from "@telegramplay/game-racer-core";

export type RacerRenderTheme = {
  canvasBackground: string;
  trackBase: string;
  trackLane: string;
  trackBorder: string;
  startLine: string;
  playerBody: string;
  playerAccent: string;
  cpuBodies: string[];
  shadow: string;
  offTrack: string;
  grass: string;
  asphalt: string;
  curbRed: string;
  curbWhite: string;
  headlight: string;
  taillight: string;
  wheelColor: string;
  gravel?: string;
  grassDark?: string;
  grassLight?: string;
  barrier?: string;
  asphaltLight?: string;
  racingLine?: string;
};

export type LocalRaceFinish = {
  provisionalResult: OfficialRacerResult;
  recordedFrames: number[];
  state: RaceState;
};

export type RacerController = {
  destroy: () => void;
  setInputMask: (nextMask: number) => void;
  setPaused: (paused: boolean) => void;
  getRaceState: () => RaceState;
  getRecordedFrames: () => number[];
  advanceTime: (ms: number) => void;
  renderGameToText: () => string;
};

function hexToColor(hex: string) {
  return Phaser.Display.Color.HexStringToColor(hex).color;
}

function drawCar(
  graphics: Phaser.GameObjects.Graphics,
  scale: number,
  bodyColor: string,
  accentColor: string,
  isPlayer: boolean,
  isOffTrack: boolean,
  offTrackColor: string,
  shadowColor: string,
  headlightColor: string,
  taillightColor: string,
  wheelColor: string
) {
  const w = 34 * scale;
  const h = 18 * scale;
  const hw = w / 2;
  const hh = h / 2;

  // shadow
  graphics.fillStyle(hexToColor(shadowColor), 0.6);
  graphics.beginPath();
  graphics.moveTo(-hw * 0.7 + 3, -hh + 5);
  graphics.lineTo(hw * 0.85 + 3, -hh * 0.7 + 5);
  graphics.lineTo(hw + 3, -hh * 0.3 + 5);
  graphics.lineTo(hw + 3, hh * 0.3 + 5);
  graphics.lineTo(hw * 0.85 + 3, hh * 0.7 + 5);
  graphics.lineTo(-hw * 0.7 + 3, hh + 5);
  graphics.lineTo(-hw + 3, hh * 0.6 + 5);
  graphics.lineTo(-hw + 3, -hh * 0.6 + 5);
  graphics.closePath();
  graphics.fillPath();

  // player glow
  if (isPlayer) {
    graphics.fillStyle(hexToColor(bodyColor), 0.2);
    graphics.beginPath();
    graphics.moveTo(-hw * 0.7 - 2, -hh - 2);
    graphics.lineTo(hw * 0.85 - 2, -hh * 0.7 - 2);
    graphics.lineTo(hw + 2, -hh * 0.3 - 1);
    graphics.lineTo(hw + 2, hh * 0.3 + 1);
    graphics.lineTo(hw * 0.85 - 2, hh * 0.7 + 2);
    graphics.lineTo(-hw * 0.7 - 2, hh + 2);
    graphics.lineTo(-hw - 2, hh * 0.6 + 1);
    graphics.lineTo(-hw - 2, -hh * 0.6 - 1);
    graphics.closePath();
    graphics.fillPath();
  }

  // wheels (4 dark rectangles)
  const wheelW = 7 * scale;
  const wheelH = 3.5 * scale;
  graphics.fillStyle(hexToColor(wheelColor), 1);
  graphics.fillRoundedRect(hw * 0.35, -hh - wheelH * 0.3, wheelW, wheelH, 1);
  graphics.fillRoundedRect(hw * 0.35, hh - wheelH * 0.7, wheelW, wheelH, 1);
  graphics.fillRoundedRect(-hw * 0.65, -hh - wheelH * 0.3, wheelW, wheelH, 1);
  graphics.fillRoundedRect(-hw * 0.65, hh - wheelH * 0.7, wheelW, wheelH, 1);

  // main body - car-shaped polygon
  const color = isOffTrack ? offTrackColor : bodyColor;
  graphics.fillStyle(hexToColor(color), 1);
  graphics.beginPath();
  graphics.moveTo(hw, 0);
  graphics.lineTo(hw * 0.85, -hh * 0.65);
  graphics.lineTo(-hw * 0.2, -hh * 0.9);
  graphics.lineTo(-hw * 0.65, -hh);
  graphics.lineTo(-hw, -hh * 0.6);
  graphics.lineTo(-hw, hh * 0.6);
  graphics.lineTo(-hw * 0.65, hh);
  graphics.lineTo(-hw * 0.2, hh * 0.9);
  graphics.lineTo(hw * 0.85, hh * 0.65);
  graphics.closePath();
  graphics.fillPath();

  // body outline
  graphics.lineStyle(1, hexToColor(accentColor), 0.35);
  graphics.beginPath();
  graphics.moveTo(hw, 0);
  graphics.lineTo(hw * 0.85, -hh * 0.65);
  graphics.lineTo(-hw * 0.2, -hh * 0.9);
  graphics.lineTo(-hw * 0.65, -hh);
  graphics.lineTo(-hw, -hh * 0.6);
  graphics.lineTo(-hw, hh * 0.6);
  graphics.lineTo(-hw * 0.65, hh);
  graphics.lineTo(-hw * 0.2, hh * 0.9);
  graphics.lineTo(hw * 0.85, hh * 0.65);
  graphics.closePath();
  graphics.strokePath();

  // windshield/cabin
  graphics.fillStyle(hexToColor("#0a1020"), 0.7);
  graphics.beginPath();
  graphics.moveTo(hw * 0.45, -hh * 0.45);
  graphics.lineTo(hw * 0.1, -hh * 0.6);
  graphics.lineTo(-hw * 0.25, -hh * 0.55);
  graphics.lineTo(-hw * 0.25, hh * 0.55);
  graphics.lineTo(hw * 0.1, hh * 0.6);
  graphics.lineTo(hw * 0.45, hh * 0.45);
  graphics.closePath();
  graphics.fillPath();

  // accent stripe along the side
  graphics.fillStyle(hexToColor(accentColor), 0.6);
  graphics.fillRoundedRect(-hw * 0.5, -hh * 0.95, w * 0.4, h * 0.12, 1);
  graphics.fillRoundedRect(-hw * 0.5, hh * 0.82, w * 0.4, h * 0.12, 1);

  // headlights (front)
  graphics.fillStyle(hexToColor(headlightColor), 0.9);
  graphics.fillRoundedRect(hw * 0.7, -hh * 0.5, 4 * scale, 2.5 * scale, 1);
  graphics.fillRoundedRect(hw * 0.7, hh * 0.25, 4 * scale, 2.5 * scale, 1);

  // tail lights (rear)
  graphics.fillStyle(hexToColor(taillightColor), 0.85);
  graphics.fillRoundedRect(-hw * 0.95, -hh * 0.5, 3 * scale, 2.5 * scale, 1);
  graphics.fillRoundedRect(-hw * 0.95, hh * 0.25, 3 * scale, 2.5 * scale, 1);

  // top shine highlight
  graphics.fillStyle(0xffffff, 0.12);
  graphics.fillRoundedRect(hw * 0.05, -hh * 0.3, w * 0.2, h * 0.15, 2);
}

export function createRacerController({
  container,
  config,
  theme,
  onFinish
}: {
  container: HTMLElement;
  config: RacerSessionConfig;
  theme: RacerRenderTheme;
  onFinish: (payload: LocalRaceFinish) => void;
}): RacerController {
  type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
  };

  const state = createInitialRaceState(config);
  const recordedFrames: number[] = [];
  const particles: Particle[] = [];
  const MAX_PARTICLES = 180;
  let inputMask = 0;
  let accumulator = 0;
  let destroyed = false;
  let finished = false;
  let paused = false;
  let lastDeltaSeconds = 1 / 60;
  let resizeObserver: ResizeObserver | null = null;

  // theme fallback colors
  const gravelColor = theme.gravel ?? "#8a7a5c";
  const grassDarkColor = theme.grassDark ?? "#152612";
  const grassLightColor = theme.grassLight ?? "#203d20";
  const barrierColor = theme.barrier ?? "#4a4e58";
  const racingLineColor = theme.racingLine ?? "#222530";

  const bounds = config.payload.track.waypoints.reduce(
    (accumulatorBounds, point) => ({
      minX: Math.min(accumulatorBounds.minX, point.x),
      minY: Math.min(accumulatorBounds.minY, point.y),
      maxX: Math.max(accumulatorBounds.maxX, point.x),
      maxY: Math.max(accumulatorBounds.maxY, point.y)
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 }
  );

  let staticGfx: Phaser.GameObjects.Graphics;
  let dynamicGfx: Phaser.GameObjects.Graphics;
  let staticWidth = 0;
  let staticHeight = 0;

  function getProjection(canvasWidth: number, canvasHeight: number) {
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    const lateralPadding = Math.max(14, Math.min(24, canvasWidth * 0.045));
    const reservedTop = Math.max(172, Math.min(248, canvasHeight * 0.31));
    const reservedBottom = Math.max(156, Math.min(224, canvasHeight * 0.25));
    const verticalScale = 0.72;
    const usableWidth = canvasWidth - lateralPadding * 2;
    const usableHeight = Math.max(180, canvasHeight - reservedTop - reservedBottom);
    const scaleX = usableWidth / worldWidth;
    const scaleY = usableHeight / (worldHeight * verticalScale);
    const scale = Math.max(0.2, Math.min(scaleX, scaleY) * 0.94);
    const projectedWidth = worldWidth * scale;
    const projectedHeight = worldHeight * scale * verticalScale;
    const offsetX = Math.max(lateralPadding, (canvasWidth - projectedWidth) / 2);
    const offsetY = reservedTop + Math.max(8, (usableHeight - projectedHeight) / 2);

    return {
      scale,
      project(x: number, y: number) {
        return {
          x: offsetX + (x - bounds.minX) * scale,
          y: offsetY + (y - bounds.minY) * scale * verticalScale
        };
      }
    };
  }

  function getSegmentNormal(p1: { x: number; y: number }, p2: { x: number; y: number }) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { nx: 0, ny: -1 };
    return { nx: -dy / len, ny: dx / len };
  }

  function getSegmentAngle(p1: { x: number; y: number }, p2: { x: number; y: number }) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  function renderStatic(width: number, height: number) {
    if (!staticGfx || destroyed) return;
    staticGfx.clear();
    const projection = getProjection(width, height);

    // ── background grass fill ──
    staticGfx.fillStyle(hexToColor(theme.grass), 1);
    staticGfx.fillRect(0, 0, width, height);

    // diagonal mow stripes
    staticGfx.fillStyle(hexToColor(grassDarkColor), 0.18);
    for (let stripe = -height; stripe < width + height; stripe += 36) {
      staticGfx.beginPath();
      staticGfx.moveTo(stripe, 0);
      staticGfx.lineTo(stripe + 4, 0);
      staticGfx.lineTo(stripe + 4 + height, height);
      staticGfx.lineTo(stripe + height, height);
      staticGfx.closePath();
      staticGfx.fillPath();
    }

    // organic grass scatter — round-ish patches
    staticGfx.fillStyle(hexToColor(grassDarkColor), 0.35);
    for (let gx = 0; gx < width; gx += 28) {
      for (let gy = 0; gy < height; gy += 28) {
        const hash = ((gx * 7 + gy * 13) ^ (gx ^ gy)) & 0xff;
        if (hash < 50) {
          const r = 4 + (hash % 5);
          staticGfx.beginPath();
          staticGfx.arc(gx + (hash % 12), gy + ((hash >> 3) % 12), r, 0, Math.PI * 2);
          staticGfx.closePath();
          staticGfx.fillPath();
        }
      }
    }
    staticGfx.fillStyle(hexToColor(grassLightColor), 0.25);
    for (let gx = 10; gx < width; gx += 32) {
      for (let gy = 14; gy < height; gy += 32) {
        const hash = ((gx * 11 + gy * 5) ^ (gx ^ (gy * 3))) & 0xff;
        if (hash < 35) {
          const r = 3 + (hash % 4);
          staticGfx.beginPath();
          staticGfx.arc(gx + (hash % 8), gy + ((hash >> 2) % 8), r, 0, Math.PI * 2);
          staticGfx.closePath();
          staticGfx.fillPath();
        }
      }
    }

    const trackPath = config.payload.track.waypoints.map((point) => projection.project(point.x, point.y));
    const trackWidth = Math.max(48, config.payload.track.width * projection.scale * 0.78);

    // ── detect sharp corners for gravel + barriers ──
    type CornerInfo = {
      idx: number;
      outerNx: number;
      outerNy: number;
      point: { x: number; y: number };
      sharpness: number;
    };
    const corners: CornerInfo[] = [];
    for (let i = 0; i < trackPath.length; i++) {
      const prev = trackPath[(i - 1 + trackPath.length) % trackPath.length]!;
      const curr = trackPath[i]!;
      const next = trackPath[(i + 1) % trackPath.length]!;
      const a1 = getSegmentAngle(prev, curr);
      const a2 = getSegmentAngle(curr, next);
      let diff = a2 - a1;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const sharpness = Math.abs(diff);
      if (sharpness > 0.35) {
        // outer side is opposite of the turn direction
        const outerSign = diff > 0 ? -1 : 1;
        const avgAngle = (a1 + a2) / 2;
        const perpAngle = avgAngle + Math.PI / 2;
        corners.push({
          idx: i,
          outerNx: Math.cos(perpAngle) * outerSign,
          outerNy: Math.sin(perpAngle) * outerSign,
          point: curr,
          sharpness
        });
      }
    }

    // ── gravel runoff areas at corners ──
    const gravelExtent = trackWidth * 0.7;
    staticGfx.fillStyle(hexToColor(gravelColor), 0.7);
    for (const corner of corners) {
      const curr = corner.point;
      const prev = trackPath[(corner.idx - 1 + trackPath.length) % trackPath.length]!;
      const next = trackPath[(corner.idx + 1) % trackPath.length]!;
      const outerOffset = trackWidth / 2 + 2;

      // trapezoid from prev-outer to next-outer, extended outward
      const p0x = prev.x + corner.outerNx * outerOffset;
      const p0y = prev.y + corner.outerNy * outerOffset;
      const p1x = curr.x + corner.outerNx * (outerOffset + gravelExtent);
      const p1y = curr.y + corner.outerNy * (outerOffset + gravelExtent);
      const p2x = next.x + corner.outerNx * outerOffset;
      const p2y = next.y + corner.outerNy * outerOffset;

      staticGfx.beginPath();
      staticGfx.moveTo(prev.x + corner.outerNx * outerOffset * 0.6, prev.y + corner.outerNy * outerOffset * 0.6);
      staticGfx.lineTo(p0x, p0y);
      staticGfx.lineTo(p1x, p1y);
      staticGfx.lineTo(p2x, p2y);
      staticGfx.lineTo(next.x + corner.outerNx * outerOffset * 0.6, next.y + corner.outerNy * outerOffset * 0.6);
      staticGfx.closePath();
      staticGfx.fillPath();

      // gravel dot texture
      staticGfx.fillStyle(hexToColor(gravelColor), 0.45);
      const cx = (p0x + p1x + p2x) / 3;
      const cy = (p0y + p1y + p2y) / 3;
      for (let d = 0; d < 12; d++) {
        const hash = ((corner.idx * 31 + d * 17) ^ 0xab) & 0xff;
        const dx = ((hash % 40) - 20) * (gravelExtent / 30);
        const dy = (((hash >> 2) % 30) - 15) * (gravelExtent / 30);
        staticGfx.beginPath();
        staticGfx.arc(cx + dx, cy + dy, 1.5, 0, Math.PI * 2);
        staticGfx.closePath();
        staticGfx.fillPath();
      }
      staticGfx.fillStyle(hexToColor(gravelColor), 0.7);
    }

    // ── environmental decorations — bushes around track ──
    const bushColor = hexToColor(grassDarkColor);
    const bushDistance = trackWidth * 2.2;
    for (let i = 0; i < trackPath.length; i += 2) {
      const curr = trackPath[i]!;
      const next = trackPath[(i + 1) % trackPath.length]!;
      const normal = getSegmentNormal(curr, next);
      const hash = ((i * 47 + 13) ^ 0xcd) & 0xff;

      // place bush on both sides at varying distances
      for (const side of [1, -1]) {
        const bushDist = bushDistance + (hash % 30);
        const bx = curr.x + normal.nx * side * bushDist;
        const by = curr.y + normal.ny * side * bushDist;
        // skip if outside canvas
        if (bx < -20 || bx > width + 20 || by < -20 || by > height + 20) continue;
        const r = 5 + (hash % 6);
        staticGfx.fillStyle(bushColor, 0.55);
        staticGfx.beginPath();
        staticGfx.arc(bx, by, r, 0, Math.PI * 2);
        staticGfx.closePath();
        staticGfx.fillPath();
        // lighter highlight
        staticGfx.fillStyle(hexToColor(grassLightColor), 0.35);
        staticGfx.beginPath();
        staticGfx.arc(bx - 1.5, by - 1.5, r * 0.55, 0, Math.PI * 2);
        staticGfx.closePath();
        staticGfx.fillPath();
      }
    }

    // ── track glow — soft bloom ──
    const glowColor = hexToColor(theme.trackBorder);
    for (const [mult, alpha] of [[3.2, 0.06], [2.0, 0.11], [1.3, 0.18]] as const) {
      staticGfx.lineStyle(trackWidth * mult, glowColor, alpha);
      staticGfx.beginPath();
      staticGfx.moveTo(trackPath[0]!.x, trackPath[0]!.y);
      trackPath.slice(1).forEach((point) => staticGfx.lineTo(point.x, point.y));
      staticGfx.closePath();
      staticGfx.strokePath();
    }

    // ── asphalt road surface ──
    staticGfx.lineStyle(trackWidth, hexToColor(theme.asphalt), 1);
    staticGfx.beginPath();
    staticGfx.moveTo(trackPath[0]!.x, trackPath[0]!.y);
    trackPath.slice(1).forEach((point) => staticGfx.lineTo(point.x, point.y));
    staticGfx.closePath();
    staticGfx.strokePath();

    // racing line darkening — offset toward apex at curves
    staticGfx.lineStyle(trackWidth * 0.35, hexToColor(racingLineColor), 0.1);
    staticGfx.beginPath();
    const rlOffsetStrength = trackWidth * 0.12;
    for (let i = 0; i < trackPath.length; i++) {
      const prev = trackPath[(i - 1 + trackPath.length) % trackPath.length]!;
      const curr = trackPath[i]!;
      const next = trackPath[(i + 1) % trackPath.length]!;
      const a1 = getSegmentAngle(prev, curr);
      const a2 = getSegmentAngle(curr, next);
      let diff = a2 - a1;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const normal = getSegmentNormal(curr, next);
      const sign = diff > 0 ? 1 : -1;
      const offset = Math.min(1, Math.abs(diff) / 0.8) * rlOffsetStrength * sign;
      const rx = curr.x + normal.nx * offset;
      const ry = curr.y + normal.ny * offset;
      if (i === 0) staticGfx.moveTo(rx, ry);
      else staticGfx.lineTo(rx, ry);
    }
    staticGfx.closePath();
    staticGfx.strokePath();

    // ── curb markings — wider with dark separator ──
    const curbWidth = Math.max(5, trackWidth * 0.14);
    const outerWidth = trackWidth / 2 + curbWidth * 0.5;

    // dark separator line between asphalt and curb
    for (const side of [1, -1]) {
      staticGfx.lineStyle(1.5, 0x000000, 0.3);
      staticGfx.beginPath();
      const sepOffset = trackWidth / 2 - 1;
      for (let i = 0; i < trackPath.length; i++) {
        const p1 = trackPath[i]!;
        const p2 = trackPath[(i + 1) % trackPath.length]!;
        const normal = getSegmentNormal(p1, p2);
        const sx = p1.x + normal.nx * side * sepOffset;
        const sy = p1.y + normal.ny * side * sepOffset;
        if (i === 0) staticGfx.moveTo(sx, sy);
        else staticGfx.lineTo(sx, sy);
      }
      staticGfx.closePath();
      staticGfx.strokePath();
    }

    // alternating red/white curb dashes
    for (let i = 0; i < trackPath.length; i++) {
      const p1 = trackPath[i]!;
      const p2 = trackPath[(i + 1) % trackPath.length]!;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      const normal = getSegmentNormal(p1, p2);
      const dashLen = 8;
      const steps = Math.max(1, Math.floor(segLen / dashLen));

      for (let s = 0; s < steps; s++) {
        const t1 = s / steps;
        const t2 = (s + 1) / steps;
        const ax = p1.x + dx * t1;
        const ay = p1.y + dy * t1;
        const bx = p1.x + dx * t2;
        const by = p1.y + dy * t2;
        const isEven = s % 2 === 0;
        const curbColor = isEven ? theme.curbRed : theme.curbWhite;

        staticGfx.lineStyle(curbWidth, hexToColor(curbColor), 0.9);
        // left side
        staticGfx.beginPath();
        staticGfx.moveTo(ax + normal.nx * outerWidth, ay + normal.ny * outerWidth);
        staticGfx.lineTo(bx + normal.nx * outerWidth, by + normal.ny * outerWidth);
        staticGfx.strokePath();
        // right side
        staticGfx.beginPath();
        staticGfx.moveTo(ax - normal.nx * outerWidth, ay - normal.ny * outerWidth);
        staticGfx.lineTo(bx - normal.nx * outerWidth, by - normal.ny * outerWidth);
        staticGfx.strokePath();
      }
    }

    // ── barriers at sharp corners ──
    const barrierOffset = outerWidth + curbWidth * 0.5 + gravelExtent * 0.85;
    staticGfx.lineStyle(3, hexToColor(barrierColor), 0.8);
    for (const corner of corners) {
      const prev = trackPath[(corner.idx - 1 + trackPath.length) % trackPath.length]!;
      const curr = corner.point;
      const next = trackPath[(corner.idx + 1) % trackPath.length]!;

      const b0x = prev.x + corner.outerNx * barrierOffset;
      const b0y = prev.y + corner.outerNy * barrierOffset;
      const b1x = curr.x + corner.outerNx * barrierOffset;
      const b1y = curr.y + corner.outerNy * barrierOffset;
      const b2x = next.x + corner.outerNx * barrierOffset;
      const b2y = next.y + corner.outerNy * barrierOffset;

      staticGfx.beginPath();
      staticGfx.moveTo(b0x, b0y);
      staticGfx.lineTo(b1x, b1y);
      staticGfx.lineTo(b2x, b2y);
      staticGfx.strokePath();

      // vertical post marks along the barrier
      const postSpacing = 18;
      for (let seg = 0; seg < 2; seg++) {
        const sx = seg === 0 ? b0x : b1x;
        const sy = seg === 0 ? b0y : b1y;
        const ex = seg === 0 ? b1x : b2x;
        const ey = seg === 0 ? b1y : b2y;
        const sLen = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
        const posts = Math.max(1, Math.floor(sLen / postSpacing));
        staticGfx.lineStyle(1.5, hexToColor(barrierColor), 0.6);
        for (let p = 0; p <= posts; p++) {
          const t = p / posts;
          const px = sx + (ex - sx) * t;
          const py = sy + (ey - sy) * t;
          staticGfx.beginPath();
          staticGfx.moveTo(px, py - 3);
          staticGfx.lineTo(px, py + 3);
          staticGfx.strokePath();
        }
      }
      staticGfx.lineStyle(3, hexToColor(barrierColor), 0.8);
    }

    // ── track border lines ──
    staticGfx.lineStyle(Math.max(2, trackWidth * 0.04), hexToColor(theme.trackBorder), 0.6);
    staticGfx.beginPath();
    staticGfx.moveTo(trackPath[0]!.x, trackPath[0]!.y);
    trackPath.slice(1).forEach((point) => staticGfx.lineTo(point.x, point.y));
    staticGfx.closePath();
    staticGfx.strokePath();

    // ── dashed center lane markings ──
    for (let i = 0; i < trackPath.length; i++) {
      const p1 = trackPath[i]!;
      const p2 = trackPath[(i + 1) % trackPath.length]!;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      const dashLen = 10;
      const gapLen = 10;
      const totalLen = dashLen + gapLen;
      const steps = Math.max(1, Math.floor(segLen / totalLen));

      staticGfx.lineStyle(2, hexToColor(theme.trackLane), 0.5);
      for (let s = 0; s < steps; s++) {
        const t1 = (s * totalLen) / segLen;
        const t2 = Math.min(1, (s * totalLen + dashLen) / segLen);
        staticGfx.beginPath();
        staticGfx.moveTo(p1.x + dx * t1, p1.y + dy * t1);
        staticGfx.lineTo(p1.x + dx * t2, p1.y + dy * t2);
        staticGfx.strokePath();
      }
    }

    // ── checkered start/finish line ──
    // Use track direction at WP0 for proper alignment
    const wp0 = trackPath[0]!;
    const wp1 = trackPath[1]!;
    const trackDir = getSegmentAngle(wp0, wp1);
    const perpAngle = trackDir + Math.PI / 2;
    const halfTrack = trackWidth / 2;
    const startA = {
      x: wp0.x + Math.cos(perpAngle) * halfTrack,
      y: wp0.y + Math.sin(perpAngle) * halfTrack
    };
    const startB = {
      x: wp0.x - Math.cos(perpAngle) * halfTrack,
      y: wp0.y - Math.sin(perpAngle) * halfTrack
    };
    const slDx = startB.x - startA.x;
    const slDy = startB.y - startA.y;
    const slLen = Math.sqrt(slDx * slDx + slDy * slDy);
    const checkerSize = Math.max(4, slLen / 14);
    const checkerSteps = Math.max(2, Math.floor(slLen / checkerSize));
    const slNx = slDx / slLen;
    const slNy = slDy / slLen;

    for (let c = 0; c < checkerSteps; c++) {
      for (let r = 0; r < 2; r++) {
        const isBlack = (c + r) % 2 === 0;
        staticGfx.fillStyle(isBlack ? 0x111111 : 0xffffff, 1);
        const cx = startA.x + slNx * c * checkerSize + (-slNy) * r * checkerSize;
        const cy = startA.y + slNy * c * checkerSize + slNx * r * checkerSize;
        staticGfx.fillRect(cx, cy, checkerSize, checkerSize);
      }
    }

    // starting grid position markers
    for (let g = 0; g < config.payload.track.startPositions.length; g++) {
      const gPos = config.payload.track.startPositions[g]!;
      const gp = projection.project(gPos.x, gPos.y);
      staticGfx.lineStyle(1, 0xffffff, 0.35);
      const gridSize = 6 * projection.scale;
      staticGfx.strokeRect(gp.x - gridSize, gp.y - gridSize * 0.5, gridSize * 2, gridSize);
    }

    // ── flag marshal posts at sharp corners ──
    for (const corner of corners) {
      if (corner.sharpness < 0.5) continue;
      const flagDist = trackWidth * 1.5;
      // place flag on the outer side
      const fx = corner.point.x + corner.outerNx * flagDist;
      const fy = corner.point.y + corner.outerNy * flagDist;
      if (fx < -10 || fx > width + 10 || fy < -10 || fy > height + 10) continue;
      // pole
      staticGfx.lineStyle(1.5, 0x888888, 0.6);
      staticGfx.beginPath();
      staticGfx.moveTo(fx, fy + 8);
      staticGfx.lineTo(fx, fy - 4);
      staticGfx.strokePath();
      // flag (yellow for sharp corners)
      staticGfx.fillStyle(0xeecc00, 0.7);
      staticGfx.fillRect(fx, fy - 4, 5, 4);
    }
  }

  function renderDynamic() {
    if (!dynamicGfx || destroyed) return;
    dynamicGfx.clear();

    const width = game.scale.width;
    const height = game.scale.height;
    const projection = getProjection(width, height);

    // draw cars (sorted by progress so leaders appear on top)
    const sortedRacers = [...state.racers].sort((a, b) => a.progressDistance - b.progressDistance);

    sortedRacers.forEach((racer) => {
      const racerIndex = state.racers.indexOf(racer);
      const projected = projection.project(racer.x, racer.y);
      const bodyColor =
        racer.kind === "player"
          ? theme.playerBody
          : theme.cpuBodies[racerIndex % theme.cpuBodies.length] ?? theme.cpuBodies[0]!;
      const accentColor = racer.kind === "player" ? theme.playerAccent : theme.trackBorder;

      dynamicGfx.save();
      dynamicGfx.translateCanvas(projected.x, projected.y);
      dynamicGfx.rotateCanvas(racer.angle);

      drawCar(
        dynamicGfx,
        projection.scale,
        bodyColor,
        accentColor,
        racer.kind === "player",
        racer.offTrack,
        theme.offTrack,
        theme.shadow,
        theme.headlight,
        theme.taillight,
        theme.wheelColor
      );

      dynamicGfx.restore();

      // emit drift smoke / dirt particles
      const isPlayerDrifting = racer.kind === "player" && (inputMask & 4) !== 0;
      if ((isPlayerDrifting || racer.offTrack) && particles.length < MAX_PARTICLES) {
        const carScale = projection.scale;
        const hw = 17 * carScale;
        const hh = 9 * carScale;
        const cosA = Math.cos(racer.angle);
        const sinA = Math.sin(racer.angle);
        const lateralX = Math.cos(racer.angle + Math.PI / 2);
        const lateralY = Math.sin(racer.angle + Math.PI / 2);
        const wheelPositions = [
          { x: projected.x - cosA * hw * 0.65 + lateralX * hh, y: projected.y - sinA * hw * 0.65 + lateralY * hh },
          { x: projected.x - cosA * hw * 0.65 - lateralX * hh, y: projected.y - sinA * hw * 0.65 - lateralY * hh }
        ];
        const pColor = isPlayerDrifting ? "#c8c8c8" : "#8a6a3a";
        const pLife = isPlayerDrifting ? 0.55 : 0.35;
        for (const pos of wheelPositions) {
          particles.push({
            x: pos.x + (Math.random() - 0.5) * 4,
            y: pos.y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 1.2,
            vy: -Math.random() * 1.0,
            life: pLife,
            maxLife: pLife,
            color: pColor
          });
        }
      }
    });

    // update and draw particles
    for (let pi = particles.length - 1; pi >= 0; pi--) {
      const p = particles[pi]!;
      p.life -= lastDeltaSeconds;
      if (p.life <= 0) {
        particles.splice(pi, 1);
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      const t = p.life / p.maxLife;
      const radius = Math.max(1, (1 - t) * 5 + 1.5);
      const alpha = t * 0.55;
      dynamicGfx.fillStyle(hexToColor(p.color), alpha);
      dynamicGfx.beginPath();
      dynamicGfx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      dynamicGfx.closePath();
      dynamicGfx.fillPath();
    }

    // speed vignette at high speed
    const playerRacer = state.racers[0];
    if (playerRacer && playerRacer.speed > 130) {
      const vignetteStrength = Math.min(1, (playerRacer.speed - 130) / (180 - 130));
      const vAlpha = vignetteStrength * 0.38;
      const vw = width;
      const vh = height;
      const cornerRadius = Math.min(vw, vh) * 0.72;
      dynamicGfx.fillStyle(0x000000, vAlpha * 0.7);

      dynamicGfx.beginPath();
      dynamicGfx.arc(0, 0, cornerRadius, 0, Math.PI / 2);
      dynamicGfx.lineTo(0, 0);
      dynamicGfx.closePath();
      dynamicGfx.fillPath();

      dynamicGfx.beginPath();
      dynamicGfx.arc(vw, 0, cornerRadius, Math.PI / 2, Math.PI);
      dynamicGfx.lineTo(vw, 0);
      dynamicGfx.closePath();
      dynamicGfx.fillPath();

      dynamicGfx.beginPath();
      dynamicGfx.arc(0, vh, cornerRadius, -Math.PI / 2, 0);
      dynamicGfx.lineTo(0, vh);
      dynamicGfx.closePath();
      dynamicGfx.fillPath();

      dynamicGfx.beginPath();
      dynamicGfx.arc(vw, vh, cornerRadius, Math.PI, (3 * Math.PI) / 2);
      dynamicGfx.lineTo(vw, vh);
      dynamicGfx.closePath();
      dynamicGfx.fillPath();
    }
  }

  function render() {
    if (destroyed) return;
    const width = game.scale.width;
    const height = game.scale.height;

    if (width !== staticWidth || height !== staticHeight) {
      staticWidth = width;
      staticHeight = height;
    }

    renderStatic(width, height);
    renderDynamic();
  }

  function stepOneFrame() {
    if (finished) {
      return;
    }

    recordedFrames.push(inputMask);
    stepRaceState(state, config, inputMask);

    if (state.playerFinished && !finished) {
      finished = true;
      const player = state.racers[0]!;
      onFinish({
        provisionalResult: replayRace(config, {
          sessionId: config.sessionId,
          configVersion: config.configVersion,
          payload: {
            frames: recordedFrames
          },
          clientSummary: {
            elapsedMs: Math.round(state.elapsedMs),
            reportedPlacement: player.place ?? 6,
            reportedScoreSortValue: Math.round(player.finishedAtMs ?? state.elapsedMs),
            reportedDisplayValue: `${((player.finishedAtMs ?? state.elapsedMs) / 1000).toFixed(2)}s`
          }
        } satisfies RacerReplayPayload),
        recordedFrames: [...recordedFrames],
        state: structuredClone(state)
      });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: container,
    width: container.clientWidth || 390,
    height: container.clientHeight || 680,
    backgroundColor: theme.grass,
    transparent: false,
    scene: {
      key: "race",
      create(this: Phaser.Scene) {
        staticGfx = this.add.graphics();
        dynamicGfx = this.add.graphics();
        staticGfx.setDepth(0);
        dynamicGfx.setDepth(1);
        render();
      },
      update(_time: number, delta: number) {
        lastDeltaSeconds = delta / 1000;
        accumulator += delta;

        while (!paused && accumulator >= TICK_MS) {
          stepOneFrame();
          accumulator -= TICK_MS;
        }

        if (paused) {
          accumulator = 0;
        }

        render();
      }
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      antialias: true,
      pixelArt: false
    }
  });

  resizeObserver = new ResizeObserver(() => {
    game.scale.resize(container.clientWidth || 390, container.clientHeight || 680);
    render();
  });

  resizeObserver.observe(container);

  return {
    destroy() {
      destroyed = true;
      resizeObserver?.disconnect();
      game.destroy(true);
    },
    setInputMask(nextMask) {
      inputMask = nextMask;
    },
    setPaused(nextPaused) {
      paused = nextPaused;
    },
    getRaceState() {
      return structuredClone(state);
    },
    getRecordedFrames() {
      return [...recordedFrames];
    },
    advanceTime(ms) {
      const steps = Math.max(1, Math.round(ms / TICK_MS));
      for (let index = 0; index < steps; index += 1) {
        stepOneFrame();
      }
      render();
    },
    renderGameToText() {
      const player = state.racers[0]!;
      return JSON.stringify({
        coordinateSystem: {
          origin: "top-left",
          x: "right",
          y: "down"
        },
        mode: finished ? "finished" : "racing",
        elapsedMs: Math.round(state.elapsedMs),
        player: {
          x: Math.round(player.x),
          y: Math.round(player.y),
          speed: Math.round(player.speed),
          laps: player.completedLaps,
          place: player.place,
          offTrack: player.offTrack
        },
        racers: state.racers.map((racer) => ({
          id: racer.id,
          place: racer.place,
          laps: racer.completedLaps,
          finishedAtMs: racer.finishedAtMs ? Math.round(racer.finishedAtMs) : null
        }))
      });
    }
  };
}
