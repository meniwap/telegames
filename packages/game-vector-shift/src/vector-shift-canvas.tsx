"use client";

import { useEffect, useRef } from "react";

import type { VectorShiftSessionConfig, VectorShiftState } from "@telegramplay/game-vector-shift-core";

export type VectorShiftCanvasProps = {
  config: VectorShiftSessionConfig;
  state: VectorShiftState;
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

function interpolate(left: number, right: number, progress: number) {
  return left + (right - left) * progress;
}

export function VectorShiftCanvas({ config, state, className }: VectorShiftCanvasProps) {
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
    const course = config.payload.course;
    const scale = Math.min(width / course.worldWidth, height / course.worldHeight);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#07101d");
    background.addColorStop(0.55, "#091220");
    background.addColorStop(1, "#04070f");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.fillStyle = "rgba(74,210,255,0.06)";
    for (let star = 0; star < 32; star += 1) {
      const x = ((star * 67 + state.tick * 9) % (width * 1.4)) - width * 0.2;
      const y = ((star * 43 + state.tick * 3) % (height * 0.7)) + 18;
      context.fillRect(x, y, 2, 2);
    }

    context.save();
    context.scale(scale, scale);

    const topY = 58;
    const bottomY = course.worldHeight - 54;
    const topLeft = 110;
    const topRight = course.worldWidth - 110;
    const bottomLeft = 26;
    const bottomRight = course.worldWidth - 26;

    context.fillStyle = "rgba(8,16,28,0.72)";
    context.beginPath();
    context.moveTo(bottomLeft, bottomY);
    context.lineTo(topLeft, topY);
    context.lineTo(topRight, topY);
    context.lineTo(bottomRight, bottomY);
    context.closePath();
    context.fill();

    for (let lane = 1; lane < course.laneCount; lane += 1) {
      const laneProgress = lane / course.laneCount;
      const startX = interpolate(bottomLeft, bottomRight, laneProgress);
      const endX = interpolate(topLeft, topRight, laneProgress);
      context.strokeStyle = "rgba(74,210,255,0.18)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(startX, bottomY);
      context.lineTo(endX, topY);
      context.stroke();
    }

    for (let stripe = 0; stripe < 10; stripe += 1) {
      const y = bottomY - ((state.distance * 0.22 + stripe * 64) % (bottomY - topY));
      const progress = (y - topY) / (bottomY - topY);
      const left = interpolate(topLeft, bottomLeft, progress);
      const right = interpolate(topRight, bottomRight, progress);
      context.strokeStyle = "rgba(255,255,255,0.04)";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(right, y);
      context.stroke();
    }

    const visibleTicks = 24;
    for (const row of course.rows) {
      const deltaTicks = row.tick - state.tick;
      if (deltaTicks < 0 || deltaTicks > visibleTicks) {
        continue;
      }

      const progress = 1 - deltaTicks / visibleTicks;
      const y = interpolate(topY + 18, bottomY - 88, progress);
      const rowLeft = interpolate(topLeft, bottomLeft, progress);
      const rowRight = interpolate(topRight, bottomRight, progress);
      const laneWidth = (rowRight - rowLeft) / course.laneCount;
      const rowHeight = interpolate(8, 32, progress);

      row.blockedLanes.forEach((lane) => {
        const left = rowLeft + laneWidth * lane;
        context.fillStyle = "rgba(255,138,61,0.94)";
        context.beginPath();
        context.roundRect(left + 4, y, laneWidth - 8, rowHeight, 8);
        context.fill();
        context.fillStyle = "rgba(255,255,255,0.18)";
        context.fillRect(left + 10, y + 4, Math.max(0, laneWidth - 20), 5);
      });

      if (row.chargeLane !== null && row.chargeLane !== undefined && !row.blockedLanes.includes(row.chargeLane)) {
        const centerX = rowLeft + laneWidth * row.chargeLane + laneWidth / 2;
        const radius = interpolate(5, 12, progress);
        const chargeGlow = context.createRadialGradient(centerX, y + rowHeight / 2, 2, centerX, y + rowHeight / 2, radius * 2.6);
        chargeGlow.addColorStop(0, "rgba(74,210,255,0.88)");
        chargeGlow.addColorStop(0.5, "rgba(74,210,255,0.18)");
        chargeGlow.addColorStop(1, "rgba(74,210,255,0)");
        context.fillStyle = chargeGlow;
        context.beginPath();
        context.arc(centerX, y + rowHeight / 2, radius * 2.4, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "#71d8ff";
        context.beginPath();
        context.arc(centerX, y + rowHeight / 2, radius, 0, Math.PI * 2);
        context.fill();
      }
    }

    const playerProgress = 0.92;
    const playerY = interpolate(topY, bottomY, playerProgress);
    const playerLeft = interpolate(topLeft, bottomLeft, playerProgress);
    const playerRight = interpolate(topRight, bottomRight, playerProgress);
    const playerLaneWidth = (playerRight - playerLeft) / course.laneCount;
    const playerCenterX = playerLeft + playerLaneWidth * state.lane + playerLaneWidth / 2;
    const shipWidth = Math.max(20, playerLaneWidth - 14);
    const shipHeight = 34;

    context.fillStyle = "rgba(0,0,0,0.26)";
    context.beginPath();
    context.ellipse(playerCenterX, playerY + 18, shipWidth * 0.56, 10, 0, 0, Math.PI * 2);
    context.fill();

    const shipGradient = context.createLinearGradient(playerCenterX, playerY - 20, playerCenterX, playerY + 20);
    shipGradient.addColorStop(0, "#8de4ff");
    shipGradient.addColorStop(0.5, "#4ad2ff");
    shipGradient.addColorStop(1, "#0e7fb0");
    context.fillStyle = shipGradient;
    context.beginPath();
    context.moveTo(playerCenterX, playerY - shipHeight / 2);
    context.lineTo(playerCenterX + shipWidth / 2, playerY + shipHeight / 2);
    context.lineTo(playerCenterX - shipWidth / 2, playerY + shipHeight / 2);
    context.closePath();
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.3)";
    context.beginPath();
    context.moveTo(playerCenterX, playerY - shipHeight / 2 + 6);
    context.lineTo(playerCenterX + shipWidth / 4, playerY + 4);
    context.lineTo(playerCenterX - shipWidth / 4, playerY + 4);
    context.closePath();
    context.fill();

    context.fillStyle = state.collided ? "#ff8a3d" : "rgba(255,138,61,0.8)";
    context.beginPath();
    context.moveTo(playerCenterX - 7, playerY + shipHeight / 2 - 2);
    context.lineTo(playerCenterX, playerY + shipHeight / 2 + 20);
    context.lineTo(playerCenterX + 7, playerY + shipHeight / 2 - 2);
    context.closePath();
    context.fill();

    context.restore();
  }, [config, state]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="h-full w-full rounded-[24px]" />
    </div>
  );
}
