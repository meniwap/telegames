import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@telegramplay/design-tokens",
    "@telegramplay/game-core",
    "@telegramplay/game-hopper-core",
    "@telegramplay/game-hopper",
    "@telegramplay/game-racer-core",
    "@telegramplay/game-racer",
    "@telegramplay/game-memory-core",
    "@telegramplay/game-memory",
    "@telegramplay/telemetry",
    "@telegramplay/theme-engine",
    "@telegramplay/ui"
  ]
};

export default nextConfig;
