"use client";

import { useEffect, useRef } from "react";

import type { OrbitForgeSessionConfig, OrbitForgeState } from "@telegramplay/game-orbit-forge-core";

export type OrbitForgeCanvasProps = {
  config: OrbitForgeSessionConfig;
  state: OrbitForgeState;
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

function polar(centerX: number, centerY: number, radius: number, angle: number) {
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius
  };
}

export function OrbitForgeCanvas({ config, state, className }: OrbitForgeCanvasProps) {
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
    const centerX = width / 2;
    const centerY = height / 2;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const background = context.createRadialGradient(centerX, centerY, 12, centerX, centerY, height * 0.8);
    background.addColorStop(0, "#0d1528");
    background.addColorStop(0.45, "#09121d");
    background.addColorStop(1, "#03070d");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(centerX, centerY);
    context.scale(scale, scale);

    const coreGlow = context.createRadialGradient(0, 0, 10, 0, 0, course.coreRadius * 2.2);
    coreGlow.addColorStop(0, "rgba(255,138,61,0.82)");
    coreGlow.addColorStop(0.45, "rgba(255,138,61,0.22)");
    coreGlow.addColorStop(1, "rgba(255,138,61,0)");
    context.fillStyle = coreGlow;
    context.beginPath();
    context.arc(0, 0, course.coreRadius * 2.1, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#17253d";
    context.beginPath();
    context.arc(0, 0, course.coreRadius, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "rgba(74,210,255,0.14)";
    context.lineWidth = 10;
    for (const radius of course.ringRadii) {
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.stroke();
    }

    for (let idx = 0; idx < 18; idx += 1) {
      const angle = (Math.PI * 2 * idx) / 18 + state.tick * 0.01;
      const mark = polar(0, 0, course.ringRadii[1] + 18, angle);
      context.fillStyle = "rgba(255,255,255,0.08)";
      context.beginPath();
      context.arc(mark.x, mark.y, 2.2, 0, Math.PI * 2);
      context.fill();
    }

    const visibleEvents = course.events.filter((event) => event.tick >= state.tick && event.tick <= state.tick + 80);
    for (const event of visibleEvents) {
      const progress = (event.tick - state.tick) / 80;
      const angle = state.angle + (event.tick - state.tick) * course.angularSpeed;
      const radius = course.ringRadii[event.hazardRing];
      const alpha = 1 - progress * 0.72;
      const span = 0.22 + (1 - progress) * 0.18;

      context.strokeStyle = `rgba(255,138,61,${alpha})`;
      context.lineWidth = 12;
      context.beginPath();
      context.arc(0, 0, radius, angle - span, angle + span);
      context.stroke();

      if (event.shardRing !== null) {
        const shardRadius = course.ringRadii[event.shardRing];
        const shard = polar(0, 0, shardRadius, angle);
        context.fillStyle = `rgba(74,210,255,${alpha})`;
        context.beginPath();
        context.moveTo(shard.x, shard.y - 8);
        context.lineTo(shard.x + 7, shard.y);
        context.lineTo(shard.x, shard.y + 8);
        context.lineTo(shard.x - 7, shard.y);
        context.closePath();
        context.fill();
      }
    }

    const playerRadius = course.ringRadii[state.ring];
    const player = polar(0, 0, playerRadius, state.angle);
    const playerGlow = context.createRadialGradient(player.x, player.y, 3, player.x, player.y, 20);
    playerGlow.addColorStop(0, "rgba(255,255,255,0.95)");
    playerGlow.addColorStop(0.4, state.phaseActive ? "rgba(74,210,255,0.92)" : "rgba(255,138,61,0.92)");
    playerGlow.addColorStop(1, "rgba(255,138,61,0)");
    context.fillStyle = playerGlow;
    context.beginPath();
    context.arc(player.x, player.y, 20, 0, Math.PI * 2);
    context.fill();

    if (state.phaseActive) {
      context.strokeStyle = "rgba(74,210,255,0.66)";
      context.lineWidth = 6;
      context.beginPath();
      context.arc(0, 0, playerRadius, state.angle - 0.34, state.angle + 0.34);
      context.stroke();
    }

    context.fillStyle = state.phaseActive ? "#74dbff" : "#ff8a3d";
    context.beginPath();
    context.arc(player.x, player.y, course.playerRadius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(255,255,255,0.35)";
    context.beginPath();
    context.arc(player.x - 3, player.y - 4, course.playerRadius * 0.45, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }, [config, state]);

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="h-full w-full rounded-[24px]" />
    </div>
  );
}
