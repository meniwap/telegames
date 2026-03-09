import { getSessionCookieValue } from "../auth/session";
import { getPlayerContextFromToken } from "./store";

export async function getPagePlayerContext() {
  return getPlayerContextFromToken(await getSessionCookieValue());
}
