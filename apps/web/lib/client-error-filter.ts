const GENERIC_SERVER_COMPONENT_ERROR_PREFIX = "An error occurred in the Server Components render.";

export function isGenericServerComponentRenderError(message: string | null | undefined) {
  return typeof message === "string" && message.startsWith(GENERIC_SERVER_COMPONENT_ERROR_PREFIX);
}

export function shouldPersistClientErrorReport(payload: { route?: string | null; message?: string | null }) {
  if (!payload.message) {
    return false;
  }

  if (payload.route === "app/error" && isGenericServerComponentRenderError(payload.message)) {
    return false;
  }

  return true;
}

export function toDisplayableAppErrorMessage(message: string | null | undefined) {
  if (isGenericServerComponentRenderError(message)) {
    return "This screen failed to load correctly. Try again, and if it happens again reopen the Mini App from Telegram.";
  }

  return message ?? "Something went wrong.";
}
