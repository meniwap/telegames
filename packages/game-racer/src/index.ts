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
};

export type LocalRaceFinish = {
  provisionalResult: OfficialRacerResult;
  recordedFrames: number[];
  state: RaceState;
};

export type RacerController = {
  destroy: () => void;
  setInputMask: (nextMask: number) => void;
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
  // front-left
  graphics.fillRoundedRect(hw * 0.35, -hh - wheelH * 0.3, wheelW, wheelH, 1);
  // front-right
  graphics.fillRoundedRect(hw * 0.35, hh - wheelH * 0.7, wheelW, wheelH, 1);
  // rear-left
  graphics.fillRoundedRect(-hw * 0.65, -hh - wheelH * 0.3, wheelW, wheelH, 1);
  // rear-right
  graphics.fillRoundedRect(-hw * 0.65, hh - wheelH * 0.7, wheelW, wheelH, 1);

  // main body - car-shaped polygon
  const color = isOffTrack ? offTrackColor : bodyColor;
  graphics.fillStyle(hexToColor(color), 1);
  graphics.beginPath();
  // front (nose - tapered)
  graphics.moveTo(hw, 0);
  graphics.lineTo(hw * 0.85, -hh * 0.65);
  // top side
  graphics.lineTo(-hw * 0.2, -hh * 0.9);
  graphics.lineTo(-hw * 0.65, -hh);
  // rear
  graphics.lineTo(-hw, -hh * 0.6);
  graphics.lineTo(-hw, hh * 0.6);
  // bottom side
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
  const state = createInitialRaceState(config);
  const recordedFrames: number[] = [];
  let inputMask = 0;
  let accumulator = 0;
  let destroyed = false;
  let finished = false;
  let resizeObserver: ResizeObserver | null = null;

  const bounds = config.payload.track.waypoints.reduce(
    (accumulatorBounds, point) => ({
      minX: Math.min(accumulatorBounds.minX, point.x),
      minY: Math.min(accumulatorBounds.minY, point.y),
      maxX: Math.max(accumulatorBounds.maxX, point.x),
      maxY: Math.max(accumulatorBounds.maxY, point.y)
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 }
  );

  let graphics: Phaser.GameObjects.Graphics;

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

  function render() {
    if (!graphics || destroyed) {
      return;
    }

    const width = game.scale.width;
    const height = game.scale.height;
    const projection = getProjection(width, height);
    graphics.clear();

    // background with grass tint
    graphics.fillStyle(hexToColor(theme.grass), 1);
    graphics.fillRect(0, 0, width, height);

    // subtle grass texture pattern
    graphics.fillStyle(hexToColor(theme.grass), 0.3);
    for (let gx = 0; gx < width; gx += 16) {
      for (let gy = 0; gy < height; gy += 16) {
        if ((gx + gy) % 32 === 0) {
          graphics.fillRect(gx, gy, 8, 8);
        }
      }
    }

    const trackPath = config.payload.track.waypoints.map((point) => projection.project(point.x, point.y));
    const trackWidth = Math.max(48, config.payload.track.width * projection.scale * 0.78);

    // asphalt road surface
    graphics.lineStyle(trackWidth, hexToColor(theme.asphalt), 1);
    graphics.beginPath();
    graphics.moveTo(trackPath[0]!.x, trackPath[0]!.y);
    trackPath.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.closePath();
    graphics.strokePath();

    // curb markings on both edges
    const curbWidth = Math.max(4, trackWidth * 0.08);
    const outerWidth = trackWidth / 2 + curbWidth;

    // Draw curb segments alternating red/white along the track
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

        // outer curb (left side)
        graphics.lineStyle(curbWidth, hexToColor(curbColor), 0.9);
        graphics.beginPath();
        graphics.moveTo(ax + normal.nx * outerWidth, ay + normal.ny * outerWidth);
        graphics.lineTo(bx + normal.nx * outerWidth, by + normal.ny * outerWidth);
        graphics.strokePath();

        // outer curb (right side)
        graphics.beginPath();
        graphics.moveTo(ax - normal.nx * outerWidth, ay - normal.ny * outerWidth);
        graphics.lineTo(bx - normal.nx * outerWidth, by - normal.ny * outerWidth);
        graphics.strokePath();
      }
    }

    // track border lines
    graphics.lineStyle(Math.max(2, trackWidth * 0.04), hexToColor(theme.trackBorder), 0.6);
    graphics.beginPath();
    graphics.moveTo(trackPath[0]!.x, trackPath[0]!.y);
    trackPath.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.closePath();
    graphics.strokePath();

    // dashed center lane markings
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

      graphics.lineStyle(2, hexToColor(theme.trackLane), 0.5);
      for (let s = 0; s < steps; s++) {
        const t1 = (s * totalLen) / segLen;
        const t2 = Math.min(1, (s * totalLen + dashLen) / segLen);
        graphics.beginPath();
        graphics.moveTo(p1.x + dx * t1, p1.y + dy * t1);
        graphics.lineTo(p1.x + dx * t2, p1.y + dy * t2);
        graphics.strokePath();
      }
    }

    // checkered start/finish line
    const startPos = config.payload.track.startPositions[0]!;
    const startA = projection.project(startPos.x - 44, startPos.y + 48);
    const startB = projection.project(startPos.x + 44, startPos.y - 48);
    const slDx = startB.x - startA.x;
    const slDy = startB.y - startA.y;
    const slLen = Math.sqrt(slDx * slDx + slDy * slDy);
    const checkerSize = Math.max(4, slLen / 12);
    const checkerSteps = Math.max(2, Math.floor(slLen / checkerSize));
    const slNx = slDx / slLen;
    const slNy = slDy / slLen;

    for (let c = 0; c < checkerSteps; c++) {
      for (let r = 0; r < 2; r++) {
        const isBlack = (c + r) % 2 === 0;
        graphics.fillStyle(isBlack ? 0x111111 : 0xffffff, 1);
        const cx = startA.x + slNx * c * checkerSize + (-slNy) * r * checkerSize;
        const cy = startA.y + slNy * c * checkerSize + slNx * r * checkerSize;
        graphics.fillRect(cx, cy, checkerSize, checkerSize);
      }
    }

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

      graphics.save();
      graphics.translateCanvas(projected.x, projected.y);
      graphics.rotateCanvas(racer.angle);

      drawCar(
        graphics,
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

      graphics.restore();
    });
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
        graphics = this.add.graphics();
        render();
      },
      update(_time: number, delta: number) {
        accumulator += delta;

        while (accumulator >= TICK_MS) {
          stepOneFrame();
          accumulator -= TICK_MS;
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
