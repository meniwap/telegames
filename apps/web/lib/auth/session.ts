import { createHash, randomBytes, randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { getEnv } from "../env";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function createRecordId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export async function setSessionCookie(token: string) {
  const env = getEnv();
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  cookieStore.set(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires
  });
}

export async function clearSessionCookie() {
  const env = getEnv();
  const cookieStore = await cookies();
  cookieStore.delete(env.SESSION_COOKIE_NAME);
}

export async function getSessionCookieValue() {
  const env = getEnv();
  const cookieStore = await cookies();
  return cookieStore.get(env.SESSION_COOKIE_NAME)?.value ?? null;
}
