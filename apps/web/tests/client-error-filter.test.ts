import { describe, expect, it } from "vitest";

import {
  isGenericServerComponentRenderError,
  shouldPersistClientErrorReport,
  toDisplayableAppErrorMessage
} from "../lib/client-error-filter";

describe("client error filtering", () => {
  const genericMessage =
    "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.";

  it("detects the generic production server component error", () => {
    expect(isGenericServerComponentRenderError(genericMessage)).toBe(true);
    expect(isGenericServerComponentRenderError("something else")).toBe(false);
  });

  it("does not persist generic app/error fallback reports", () => {
    expect(
      shouldPersistClientErrorReport({
        route: "app/error",
        message: genericMessage
      })
    ).toBe(false);
  });

  it("rephrases the generic production error for end users", () => {
    expect(toDisplayableAppErrorMessage(genericMessage)).toContain("failed to load correctly");
  });
});
