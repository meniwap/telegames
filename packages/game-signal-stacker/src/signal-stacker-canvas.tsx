"use client";

import { useEffect, useRef } from "react";

import { getActiveSignalBlock } from "@telegramplay/game-signal-stacker-core";
import type { SignalStackerSessionConfig, SignalStackerState } from "@telegramplay/game-signal-stacker-core";

export type SignalStackerCanvasProps = {
  config: SignalStackerSessionConfig;
  state: SignalStackerState;
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

export function SignalStackerCanvas({ config, state, className }: SignalStackerCanvasProps) {
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
    const tower = config.payload.tower;
    const scale = Math.min(width / tower.worldWidth, height / tower.worldHeight);

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, "#090f1f");
    background.addColorStop(0.52, "#0d1528");
    background.addColorStop(1, "#050811");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(width * 0.62, height * 0.2, 14, width * 0.62, height * 0.2, width * 0.65);
    glow.addColorStop(0, "rgba(255,138,61,0.24)");
    glow.addColorStop(0.45, "rgba(255,138,61,0.09)");
    glow.addColorStop(1, "rgba(255,138,61,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.save();
    context.scale(scale, scale);

    for (let row = 0; row < 8; row += 1) {
      context.strokeStyle = row % 2 === 0 ? "rgba(74,210,255,0.08)" : "rgba(255,255,255,0.04)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(18, 34 + row * 58);
      context.lineTo(tower.worldWidth - 18, 34 + row * 58);
      context.stroke();
    }

    const pedestalGradient = context.createLinearGradient(0, tower.worldHeight - 86, 0, tower.worldHeight);
    pedestalGradient.addColorStop(0, "rgba(255,138,61,0.06)");
    pedestalGradient.addColorStop(1, "rgba(255,138,61,0.24)");
    context.fillStyle = pedestalGradient;
    context.fillRect(0, tower.worldHeight - 86, tower.worldWidth, 86);

    const trackY = tower.worldHeight - 42;
    context.fillStyle = "rgba(255,255,255,0.06)";
    context.fillRect(20, trackY, tower.worldWidth - 40, 8);
    context.fillStyle = "rgba(74,210,255,0.12)";
    context.fillRect(44, trackY + 2, tower.worldWidth - 88, 4);

    const bottomPadding = 48;
    state.towerBlocks.forEach((block, index) => {
      const top = tower.worldHeight - bottomPadding - tower.blockHeight * (index + 1);
      const left = block.centerX - block.width / 2;

      context.fillStyle = index === 0 ? "#233652" : block.perfect ? "#ff9d55" : "#5dc4f8";
      context.beginPath();
      context.roundRect(left, top, block.width, tower.blockHeight, 8);
      context.fill();

      const gloss = context.createLinearGradient(left, top, left, top + tower.blockHeight);
      gloss.addColorStop(0, "rgba(255,255,255,0.22)");
      gloss.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gloss;
      context.fillRect(left + 4, top + 3, Math.max(0, block.width - 8), tower.blockHeight * 0.34);

      context.strokeStyle = "rgba(255,255,255,0.16)";
      context.lineWidth = 1.5;
      context.strokeRect(left + 1, top + 1, Math.max(0, block.width - 2), tower.blockHeight - 2);
    });

    if (!state.ended) {
      const active = getActiveSignalBlock(state, config);
      const top = tower.worldHeight - bottomPadding - tower.blockHeight * (state.towerBlocks.length + 1);
      const left = active.centerX - active.width / 2;
      const shadowWidth = active.width + 14;

      context.fillStyle = "rgba(0,0,0,0.22)";
      context.beginPath();
      context.ellipse(active.centerX, top + tower.blockHeight + 18, shadowWidth / 2, 8, 0, 0, Math.PI * 2);
      context.fill();

      const activeGradient = context.createLinearGradient(left, top, left + active.width, top + tower.blockHeight);
      activeGradient.addColorStop(0, "#ffb36a");
      activeGradient.addColorStop(0.5, "#ff8a3d");
      activeGradient.addColorStop(1, "#d86a1f");
      context.fillStyle = activeGradient;
      context.beginPath();
      context.roundRect(left, top, active.width, tower.blockHeight, 8);
      context.fill();

      context.fillStyle = "rgba(255,255,255,0.22)";
      context.fillRect(left + 5, top + 4, Math.max(0, active.width - 10), 6);
      context.strokeStyle = "rgba(255,255,255,0.24)";
      context.lineWidth = 1.5;
      context.strokeRect(left + 1, top + 1, Math.max(0, active.width - 2), tower.blockHeight - 2);
    }

    context.restore();
  }, [config, state]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="h-full w-full rounded-[24px]" />
    </div>
  );
}
