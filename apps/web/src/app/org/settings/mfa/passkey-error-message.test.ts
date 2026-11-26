import { describe, expect, it } from "vitest";
import { passkeyErrorMessage } from "./passkey-error-message";

function namedError(name: string, message: string): Error {
  return Object.assign(new Error(message), { name });
}

describe("passkeyErrorMessage", () => {
  it("uses the cancelled wording when the browser prompt was dismissed", () => {
    expect(
      passkeyErrorMessage(namedError("NotAllowedError", "denied"), "Failed", "Cancelled"),
    ).toBe("Cancelled");
    expect(
      passkeyErrorMessage(namedError("AbortError", "aborted"), "Failed", "Cancelled"),
    ).toBe("Cancelled");
  });

  it("shows the error's own message for other errors", () => {
    expect(
      passkeyErrorMessage(new Error("Server rejected the key"), "Failed", "Cancelled"),
    ).toBe("Server rejected the key");
  });

  it("uses the fallback when the thrown value is not an Error", () => {
    expect(passkeyErrorMessage("boom", "Failed", "Cancelled")).toBe("Failed");
  });
});
