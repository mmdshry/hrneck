import { describe, expect, it } from "vitest";
import { friendlyMessage, NO_ASSIGNED_TRAINING_MESSAGE } from "./api";

describe("friendlyMessage", () => {
  it("hides a debug 403 dump behind the learner sentence", () => {
    const body = JSON.stringify({
      message: "",
      exception: "Symfony\\Component\\HttpKernel\\Exception\\HttpException",
      file: "C:\\app\\vendor\\laravel\\framework\\Application.php",
      trace: [{ file: "vendor\\laravel\\framework\\helpers.php" }],
    });

    expect(friendlyMessage(403, body)).toBe(NO_ASSIGNED_TRAINING_MESSAGE);
    expect(friendlyMessage(403, body)).not.toContain("vendor");
    expect(friendlyMessage(403, body)).not.toContain("trace");
  });

  it("keeps a short server message", () => {
    expect(
      friendlyMessage(
        403,
        JSON.stringify({ message: NO_ASSIGNED_TRAINING_MESSAGE }),
      ),
    ).toBe(NO_ASSIGNED_TRAINING_MESSAGE);
  });

  it("does not return a raw body", () => {
    expect(friendlyMessage(500, "Exception trace vendor\\laravel")).toBe(
      "Request failed (500)",
    );
  });
});
