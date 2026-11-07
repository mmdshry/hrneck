import { beforeEach, describe, expect, it, vi } from "vitest";

const success = vi.fn();
const error = vi.fn();
const message = vi.fn();
const base = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign(base, {
    success,
    error,
    message,
  }),
}));

describe("toast helpers", () => {
  beforeEach(() => {
    success.mockClear();
    error.mockClear();
    message.mockClear();
    base.mockClear();
  });

  it("routes notifyResult by message tone", async () => {
    const { notifyResult, toastNotification } = await import("./toast");
    notifyResult("Settings saved.");
    expect(success).toHaveBeenCalled();
    notifyResult("Save failed");
    expect(error).toHaveBeenCalled();
    notifyResult("Heads up");
    expect(message).toHaveBeenCalled();
    toastNotification("New item", "Body");
    expect(base).toHaveBeenCalled();
  });
});
