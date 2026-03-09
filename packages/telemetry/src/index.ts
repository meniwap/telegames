import { randomUUID } from "node:crypto";

import pino from "pino";

export type LogBindings = {
  requestId?: string;
  playerId?: string;
  raceSessionId?: string;
  route?: string;
};

const level = process.env.LOG_LEVEL ?? "info";

export const logger = pino({
  level,
  redact: {
    paths: ["req.headers.authorization", "botToken", "serviceRoleKey"],
    censor: "[redacted]"
  }
});

export function createRequestLogger(bindings: LogBindings = {}) {
  return logger.child({
    requestId: bindings.requestId ?? randomUUID(),
    ...bindings
  });
}
