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

  function render() {
    if (!graphics || destroyed) {
      return;
    }

    const width = game.scale.width;
    const height = game.scale.height;
    const projection = getProjection(width, height);
    graphics.clear();

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(theme.canvasBackground).color);
    graphics.fillRect(0, 0, width, height);

    const trackPath = config.payload.track.waypoints.map((point) => projection.project(point.x, point.y));

    graphics.lineStyle(Math.max(44, config.payload.track.width * projection.scale * 0.74), Phaser.Display.Color.HexStringToColor(theme.trackBase).color, 1);
    graphics.beginPath();
    graphics.moveTo(trackPath[0]!.x, trackPath[0]!.y);
    trackPath.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.closePath();
    graphics.strokePath();

    graphics.lineStyle(Math.max(6, config.payload.track.width * projection.scale * 0.11), Phaser.Display.Color.HexStringToColor(theme.trackBorder).color, 1);
    graphics.beginPath();
    graphics.moveTo(trackPath[0]!.x, trackPath[0]!.y);
    trackPath.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.closePath();
    graphics.strokePath();

    graphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(theme.trackLane).color, 0.5);
    graphics.beginPath();
    graphics.moveTo(trackPath[0]!.x, trackPath[0]!.y);
    trackPath.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
    graphics.closePath();
    graphics.strokePath();

    const startLineA = projection.project(config.payload.track.startPositions[0]!.x - 44, config.payload.track.startPositions[0]!.y + 48);
    const startLineB = projection.project(config.payload.track.startPositions[0]!.x + 44, config.payload.track.startPositions[0]!.y - 48);
    graphics.lineStyle(8, Phaser.Display.Color.HexStringToColor(theme.startLine).color, 1);
    graphics.beginPath();
    graphics.moveTo(startLineA.x, startLineA.y);
    graphics.lineTo(startLineB.x, startLineB.y);
    graphics.strokePath();

    state.racers.forEach((racer, index) => {
      const projected = projection.project(racer.x, racer.y);
      const baseWidth = 30 * projection.scale;
      const baseHeight = 18 * projection.scale;
      const bodyColor =
        racer.kind === "player"
          ? theme.playerBody
          : theme.cpuBodies[index % theme.cpuBodies.length] ?? theme.cpuBodies[0]!;
      const accentColor = racer.kind === "player" ? theme.playerAccent : theme.trackBorder;

      graphics.save();
      graphics.translateCanvas(projected.x, projected.y);
      graphics.rotateCanvas(racer.angle);

      graphics.fillStyle(Phaser.Display.Color.HexStringToColor(theme.shadow).color, 0.8);
      graphics.fillRoundedRect(-baseWidth / 2 + 3, -baseHeight / 2 + 6, baseWidth, baseHeight, 4);

      graphics.fillStyle(
        Phaser.Display.Color.HexStringToColor(racer.offTrack ? theme.offTrack : bodyColor).color,
        1
      );
      graphics.fillRoundedRect(-baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight, 6);

      graphics.fillStyle(Phaser.Display.Color.HexStringToColor(accentColor).color, 1);
      graphics.fillRoundedRect(-baseWidth / 2 + 5, -baseHeight / 2 + 4, baseWidth * 0.45, baseHeight * 0.44, 4);

      graphics.fillStyle(0xffffff, 0.18);
      graphics.fillRoundedRect(baseWidth * 0.02, -baseHeight / 2 + 4, baseWidth * 0.22, baseHeight * 0.18, 4);
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
    backgroundColor: theme.canvasBackground,
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
