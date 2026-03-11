"use client";

import { useEffect, useRef } from "react";

import { getLaneCenter } from "@telegramplay/game-prism-break-core";
import type { PrismBreakSessionConfig, PrismBreakState, PrismTile } from "@telegramplay/game-prism-break-core";

export type PrismBreakCanvasProps = {
  config: PrismBreakSessionConfig;
  state: PrismBreakState;
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

function getPrismPalette(tile: PrismTile) {
  if (tile.kind === 0) {
    return {
      start: "#74dbff",
      end: "#1e8ec6"
    };
  }
  if (tile.kind === 1) {
    return {
      start: "#ffb266",
      end: "#db6f24"
    };
  }
  return {
    start: "#d8a2ff",
    end: "#8e4fde"
  };
}

export function PrismBreakCanvas({ config, state, className }: PrismBreakCanvasProps) {
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
    const chamber = config.payload.chamber;
    const scale = Math.min(width / chamber.worldWidth, height / chamber.worldHeight);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#08101f");
    background.addColorStop(0.6, "#09121d");
    background.addColorStop(1, "#04070f");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.save();
    context.scale(scale, scale);

    context.fillStyle = "rgba(255,255,255,0.04)";
    context.fillRect(18, 18, chamber.worldWidth - 36, chamber.worldHeight - 36);
    context.strokeStyle = "rgba(255,255,255,0.08)";
    context.lineWidth = 2;
    context.strokeRect(18, 18, chamber.worldWidth - 36, chamber.worldHeight - 36);

    for (let y = 56; y < chamber.worldHeight - 44; y += 44) {
      context.strokeStyle = "rgba(74,210,255,0.06)";
      context.beginPath();
      context.moveTo(26, y);
      context.lineTo(chamber.worldWidth - 26, y);
      context.stroke();
    }

    if (state.burstFlashTicks > 0) {
      const flash = context.createRadialGradient(state.ballX, state.ballY, 8, state.ballX, state.ballY, 90);
      flash.addColorStop(0, "rgba(255,255,255,0.22)");
      flash.addColorStop(0.5, "rgba(255,138,61,0.18)");
      flash.addColorStop(1, "rgba(255,138,61,0)");
      context.fillStyle = flash;
      context.fillRect(0, 0, chamber.worldWidth, chamber.worldHeight);
    }

    state.prisms.forEach((tile) => {
      const palette = getPrismPalette(tile);
      const gradient = context.createLinearGradient(tile.x, tile.y, tile.x + tile.width, tile.y + tile.height);
      gradient.addColorStop(0, palette.start);
      gradient.addColorStop(1, palette.end);
      context.fillStyle = gradient;
      context.beginPath();
      context.roundRect(tile.x, tile.y, tile.width, tile.height, 8);
      context.fill();

      context.fillStyle = "rgba(255,255,255,0.18)";
      context.fillRect(tile.x + 4, tile.y + 3, Math.max(0, tile.width - 8), 5);
      context.strokeStyle = "rgba(255,255,255,0.2)";
      context.lineWidth = 1.4;
      context.strokeRect(tile.x + 1, tile.y + 1, tile.width - 2, tile.height - 2);
    });

    const paddleCenter = getLaneCenter(state.deflectorLane);
    const paddleGradient = context.createLinearGradient(
      paddleCenter,
      chamber.paddleY - chamber.paddleHeight / 2,
      paddleCenter,
      chamber.paddleY + chamber.paddleHeight / 2
    );
    paddleGradient.addColorStop(0, state.attached ? "#8ddfff" : "#ffb266");
    paddleGradient.addColorStop(1, state.attached ? "#3597c7" : "#d86b20");
    context.fillStyle = paddleGradient;
    context.beginPath();
    context.roundRect(
      paddleCenter - chamber.paddleWidth / 2,
      chamber.paddleY - chamber.paddleHeight / 2,
      chamber.paddleWidth,
      chamber.paddleHeight,
      10
    );
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.18)";
    context.fillRect(
      paddleCenter - chamber.paddleWidth / 2 + 6,
      chamber.paddleY - chamber.paddleHeight / 2 + 3,
      chamber.paddleWidth - 12,
      4
    );

    const ballGlow = context.createRadialGradient(state.ballX, state.ballY, 4, state.ballX, state.ballY, 22);
    ballGlow.addColorStop(0, "rgba(255,255,255,0.96)");
    ballGlow.addColorStop(0.45, "rgba(74,210,255,0.9)");
    ballGlow.addColorStop(1, "rgba(74,210,255,0)");
    context.fillStyle = ballGlow;
    context.beginPath();
    context.arc(state.ballX, state.ballY, 22, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f7fbff";
    context.beginPath();
    context.arc(state.ballX, state.ballY, chamber.ballRadius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.45)";
    context.beginPath();
    context.arc(state.ballX - 2, state.ballY - 2, chamber.ballRadius * 0.36, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }, [config, state]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="h-full w-full rounded-[24px]" />
    </div>
  );
}
