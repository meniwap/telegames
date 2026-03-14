"use client";

import { useEffect, useRef } from "react";

import {
  DRAIN_GAP_WIDTH,
  FLIPPER_LENGTH,
  FLIPPER_THICKNESS,
  FLIPPER_Y,
  LEFT_FLIPPER_PIVOT_X,
  RIGHT_FLIPPER_PIVOT_X
} from "@telegramplay/game-photon-pinball-core";
import type { PhotonPinballSessionConfig, PhotonPinballState } from "@telegramplay/game-photon-pinball-core";

export type PhotonPinballCanvasProps = {
  config: PhotonPinballSessionConfig;
  state: PhotonPinballState;
  className?: string;
};

function fitCanvas(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement;
  if (!parent) {
    return;
  }

  const rect = parent.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
}

function drawFlipper(
  context: CanvasRenderingContext2D,
  pivotX: number,
  pivotY: number,
  direction: -1 | 1,
  active: boolean
) {
  context.save();
  context.translate(pivotX, pivotY);
  context.rotate(active ? direction * 0.76 : direction * 0.18);

  const gradient = context.createLinearGradient(0, -FLIPPER_THICKNESS / 2, 0, FLIPPER_THICKNESS / 2);
  gradient.addColorStop(0, active ? "#ffba74" : "#8ddfff");
  gradient.addColorStop(1, active ? "#db6e28" : "#28739d");
  context.fillStyle = gradient;
  context.beginPath();
  context.roundRect(direction === -1 ? -FLIPPER_LENGTH : 0, -FLIPPER_THICKNESS / 2, FLIPPER_LENGTH, FLIPPER_THICKNESS, 12);
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.24)";
  context.beginPath();
  context.roundRect(direction === -1 ? -FLIPPER_LENGTH + 8 : 8, -FLIPPER_THICKNESS / 2 + 3, FLIPPER_LENGTH - 16, 4, 4);
  context.fill();

  context.restore();
}

export function PhotonPinballCanvas({ config, state, className }: PhotonPinballCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    fitCanvas(canvas);
    const observer = new ResizeObserver(() => fitCanvas(canvas));
    observer.observe(canvas.parentElement ?? canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    const table = config.payload.table;
    const scale = Math.min(width / table.worldWidth, height / table.worldHeight);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#07111d");
    background.addColorStop(0.55, "#09131f");
    background.addColorStop(1, "#05070d");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.save();
    context.scale(scale, scale);

    const panelGradient = context.createLinearGradient(0, 0, table.worldWidth, table.worldHeight);
    panelGradient.addColorStop(0, "#111927");
    panelGradient.addColorStop(0.55, "#0b1220");
    panelGradient.addColorStop(1, "#0a1018");
    context.fillStyle = panelGradient;
    context.beginPath();
    context.roundRect(18, 18, table.worldWidth - 36, table.worldHeight - 36, 28);
    context.fill();

    context.strokeStyle = "rgba(255,255,255,0.08)";
    context.lineWidth = 2;
    context.stroke();

    const railGradient = context.createLinearGradient(0, 0, 0, table.worldHeight);
    railGradient.addColorStop(0, "rgba(74,210,255,0.22)");
    railGradient.addColorStop(1, "rgba(255,138,61,0.2)");
    context.strokeStyle = railGradient;
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(76, 72);
    context.quadraticCurveTo(40, 210, 62, 430);
    context.quadraticCurveTo(84, 662, 150, 824);
    context.moveTo(table.worldWidth - 76, 72);
    context.quadraticCurveTo(table.worldWidth - 40, 210, table.worldWidth - 62, 430);
    context.quadraticCurveTo(table.worldWidth - 84, 662, table.worldWidth - 150, 824);
    context.stroke();

    context.strokeStyle = "rgba(255,255,255,0.05)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(136, 92);
    context.quadraticCurveTo(178, 152, 248, 208);
    context.quadraticCurveTo(326, 270, 404, 234);
    context.stroke();
    context.beginPath();
    context.moveTo(116, 318);
    context.quadraticCurveTo(188, 352, 246, 328);
    context.quadraticCurveTo(314, 300, 410, 352);
    context.stroke();

    const drainCenter = table.worldWidth / 2;
    context.fillStyle = "rgba(255,255,255,0.05)";
    context.fillRect(drainCenter - DRAIN_GAP_WIDTH / 2, table.worldHeight - 40, DRAIN_GAP_WIDTH, 10);

    table.targetLayout.forEach((target, index) => {
      const lit = state.targetStates[index]?.lit ?? true;
      const flash = state.targetFlashTicks[index] ?? 0;
      const gradient = context.createLinearGradient(target.x, target.y, target.x + target.width, target.y + target.height);
      gradient.addColorStop(0, lit ? "#74dbff" : "#2c3948");
      gradient.addColorStop(1, lit ? "#ff9e50" : "#17202e");
      context.fillStyle = gradient;
      context.beginPath();
      context.roundRect(target.x, target.y, target.width, target.height, 8);
      context.fill();

      if (flash > 0) {
        context.fillStyle = "rgba(255,255,255,0.24)";
        context.beginPath();
        context.roundRect(target.x - 2, target.y - 2, target.width + 4, target.height + 4, 10);
        context.fill();
      }
    });

    table.bumperLayout.forEach((bumper, index) => {
      const flash = state.bumperFlashTicks[index] ?? 0;
      const glow = context.createRadialGradient(bumper.x, bumper.y, 4, bumper.x, bumper.y, bumper.radius + 26);
      glow.addColorStop(0, flash > 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)");
      glow.addColorStop(0.35, flash > 0 ? "rgba(255,196,108,0.9)" : "rgba(74,210,255,0.5)");
      glow.addColorStop(1, "rgba(74,210,255,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(bumper.x, bumper.y, bumper.radius + 26, 0, Math.PI * 2);
      context.fill();

      const bumperGradient = context.createLinearGradient(
        bumper.x - bumper.radius,
        bumper.y - bumper.radius,
        bumper.x + bumper.radius,
        bumper.y + bumper.radius
      );
      bumperGradient.addColorStop(0, flash > 0 ? "#ffd98a" : "#83e2ff");
      bumperGradient.addColorStop(1, flash > 0 ? "#d46c27" : "#2a88ba");
      context.fillStyle = bumperGradient;
      context.beginPath();
      context.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "rgba(255,255,255,0.22)";
      context.beginPath();
      context.arc(bumper.x - bumper.radius * 0.22, bumper.y - bumper.radius * 0.26, bumper.radius * 0.34, 0, Math.PI * 2);
      context.fill();
    });

    drawFlipper(context, LEFT_FLIPPER_PIVOT_X, FLIPPER_Y, -1, state.leftFlipTicksRemaining > 0);
    drawFlipper(context, RIGHT_FLIPPER_PIVOT_X, FLIPPER_Y, 1, state.rightFlipTicksRemaining > 0);

    if (state.nudgeTicksRemaining > 0) {
      context.strokeStyle = "rgba(255,138,61,0.34)";
      context.lineWidth = 6;
      context.beginPath();
      context.arc(drainCenter, table.worldHeight - 132, 108, 0.18 * Math.PI, 0.82 * Math.PI);
      context.stroke();
    }

    const ballGlow = context.createRadialGradient(state.ballX, state.ballY, 4, state.ballX, state.ballY, 24);
    ballGlow.addColorStop(0, "rgba(255,255,255,0.96)");
    ballGlow.addColorStop(0.42, "rgba(74,210,255,0.86)");
    ballGlow.addColorStop(1, "rgba(74,210,255,0)");
    context.fillStyle = ballGlow;
    context.beginPath();
    context.arc(state.ballX, state.ballY, 24, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f7fbff";
    context.beginPath();
    context.arc(state.ballX, state.ballY, table.ballRadius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.52)";
    context.beginPath();
    context.arc(state.ballX - 2.5, state.ballY - 2.5, table.ballRadius * 0.34, 0, Math.PI * 2);
    context.fill();

    if (state.lastEventLabel && state.lastEventTicks > 0) {
      context.fillStyle = "rgba(255,255,255,0.92)";
      context.font = "600 24px system-ui";
      context.textAlign = "center";
      context.fillText(state.lastEventLabel, table.worldWidth / 2, 84);
      if (state.lastEventPoints > 0) {
        context.fillStyle = "#ffb266";
        context.font = "600 18px system-ui";
        context.fillText(`+${state.lastEventPoints}`, table.worldWidth / 2, 108);
      }
    }

    context.restore();
  }, [config, state]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="h-full w-full rounded-[24px]" />
    </div>
  );
}
