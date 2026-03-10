"use client";

import { useEffect, useRef } from "react";

import type { HopperSessionConfig, HopperState } from "@telegramplay/game-hopper-core";

export type HopperCanvasProps = {
  config: HopperSessionConfig;
  state: HopperState;
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

export function HopperCanvas({ config, state, className }: HopperCanvasProps) {
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
    const scaleX = width / course.worldWidth;
    const scaleY = height / course.worldHeight;
    const scale = Math.min(scaleX, scaleY);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#0b1324");
    gradient.addColorStop(0.5, "#09101d");
    gradient.addColorStop(1, "#050912");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(width * 0.72, height * 0.18, 10, width * 0.72, height * 0.18, width * 0.62);
    glow.addColorStop(0, "rgba(74,210,255,0.22)");
    glow.addColorStop(0.45, "rgba(74,210,255,0.08)");
    glow.addColorStop(1, "rgba(74,210,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    const groundGradient = context.createLinearGradient(0, height * 0.72, 0, height);
    groundGradient.addColorStop(0, "rgba(255,138,61,0)");
    groundGradient.addColorStop(1, "rgba(255,138,61,0.12)");
    context.fillStyle = groundGradient;
    context.fillRect(0, height * 0.72, width, height * 0.28);

    const skylineOffset = (state.distance * 0.12) % 90;
    for (let index = -1; index < 7; index += 1) {
      const x = index * 90 - skylineOffset;
      const buildingWidth = 54 + (index % 3) * 12;
      const buildingHeight = 70 + ((index + 3) % 4) * 34;
      context.fillStyle = "rgba(21,32,54,0.82)";
      context.fillRect(x, height - buildingHeight - 30, buildingWidth, buildingHeight);

      for (let windowRow = 0; windowRow < 5; windowRow += 1) {
        for (let windowCol = 0; windowCol < 3; windowCol += 1) {
          context.fillStyle = windowRow % 2 === 0 ? "rgba(255,206,122,0.22)" : "rgba(96,170,255,0.14)";
          context.fillRect(x + 8 + windowCol * 14, height - buildingHeight - 16 + windowRow * 14, 6, 8);
        }
      }
    }

    const cloudOffset = (state.distance * 0.04) % (width + 140);
    for (let index = 0; index < 4; index += 1) {
      const cloudX = ((index * 140 - cloudOffset) % (width + 140)) - 40;
      const cloudY = 68 + index * 32;
      context.fillStyle = "rgba(255,255,255,0.05)";
      context.beginPath();
      context.ellipse(cloudX, cloudY, 34, 16, 0, 0, Math.PI * 2);
      context.ellipse(cloudX + 24, cloudY - 4, 28, 14, 0, 0, Math.PI * 2);
      context.ellipse(cloudX - 22, cloudY + 2, 24, 12, 0, 0, Math.PI * 2);
      context.fill();
    }

    context.save();
    context.scale(scale, scale);

    for (const obstacle of course.obstacles) {
      const left = obstacle.x - state.distance;
      if (left > course.worldWidth + 50 || left + obstacle.width < -50) {
        continue;
      }

      const gapTop = obstacle.gapY - obstacle.gapHeight / 2;
      const gapBottom = obstacle.gapY + obstacle.gapHeight / 2;
      const pipeRadius = 14;

      const pipeGradient = context.createLinearGradient(left, 0, left + obstacle.width, 0);
      pipeGradient.addColorStop(0, "#1b2a45");
      pipeGradient.addColorStop(0.5, "#31476f");
      pipeGradient.addColorStop(1, "#152338");
      context.fillStyle = pipeGradient;

      const pipeTopHeight = Math.max(0, gapTop);
      const pipeBottomHeight = Math.max(0, course.worldHeight - gapBottom);

      context.beginPath();
      context.roundRect(left, 0, obstacle.width, pipeTopHeight, [0, 0, pipeRadius, pipeRadius]);
      context.fill();
      context.beginPath();
      context.roundRect(left, gapBottom, obstacle.width, pipeBottomHeight, [pipeRadius, pipeRadius, 0, 0]);
      context.fill();

      context.fillStyle = "rgba(255,255,255,0.12)";
      context.fillRect(left + 8, 0, 6, pipeTopHeight);
      context.fillRect(left + 8, gapBottom, 6, pipeBottomHeight);

      context.fillStyle = "#ff8a3d";
      for (const braceY of [gapTop - 34, gapBottom + 14]) {
        if (braceY < 0 || braceY > course.worldHeight) {
          continue;
        }
        context.fillRect(left - 6, braceY, obstacle.width + 12, 10);
      }

      context.strokeStyle = "rgba(74,210,255,0.24)";
      context.lineWidth = 2;
      context.strokeRect(left + 2, 2, obstacle.width - 4, Math.max(0, pipeTopHeight - 4));
      context.strokeRect(left + 2, gapBottom + 2, obstacle.width - 4, Math.max(0, pipeBottomHeight - 4));
    }

    const birdX = state.birdX;
    const birdY = state.birdY;
    const tilt = Math.max(-0.45, Math.min(0.5, state.birdVelocity / 420));

    context.save();
    context.translate(birdX, birdY);
    context.rotate(tilt);

    context.fillStyle = "rgba(0,0,0,0.28)";
    context.beginPath();
    context.ellipse(6, 18, 22, 8, 0, 0, Math.PI * 2);
    context.fill();

    const birdGradient = context.createLinearGradient(-18, -18, 18, 18);
    birdGradient.addColorStop(0, "#ffb36a");
    birdGradient.addColorStop(0.55, "#ff8a3d");
    birdGradient.addColorStop(1, "#c85d1a");
    context.fillStyle = birdGradient;
    context.beginPath();
    context.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#13233c";
    context.beginPath();
    context.ellipse(-5, 2, 10, 8, -0.35, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.32)";
    context.beginPath();
    context.ellipse(-4, -6, 7, 4, -0.45, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ffd788";
    context.beginPath();
    context.moveTo(14, -2);
    context.lineTo(27, 1);
    context.lineTo(14, 6);
    context.closePath();
    context.fill();

    context.fillStyle = "#0b1020";
    context.beginPath();
    context.arc(6, -4, 3.6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(7, -5, 1.2, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(74,210,255,0.55)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-8, -12);
    context.quadraticCurveTo(-18, -22, -24, -12);
    context.stroke();

    context.restore();
    context.restore();
  }, [config, state]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="h-full w-full rounded-[24px]" />
    </div>
  );
}
