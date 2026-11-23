import { beforeEach, describe, expect, it, vi } from "vitest";

const success = vi.fn();
const error = vi.fn();
const warning = vi.fn();
const message = vi.fn();
const base = vi.fn();

vi.mock("sonner", () => ({
  toast: Object.assign(base, {
    success,
    error,
    warning,
    message,
  }),
}));

describe("toast helpers", () => {
  beforeEach(() => {
    success.mockClear();
    error.mockClear();
    warning.mockClear();
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

  it("exposes typed toast helpers with icons", async () => {
    const { toastSuccess, toastError, toastWarning, toastInfo } = await import("./toast");
    toastSuccess("ok");
    expect(success).toHaveBeenCalledWith(
      "ok",
      expect.objectContaining({ duration: 4000, icon: expect.anything() }),
    );
    toastError("bad");
    expect(error).toHaveBeenCalledWith(
      "bad",
      expect.objectContaining({ duration: 4000, icon: expect.anything() }),
    );
    toastWarning("careful");
    expect(warning).toHaveBeenCalledWith(
      "careful",
      expect.objectContaining({ duration: 4000, icon: expect.anything() }),
    );
    toastInfo("note");
    expect(message).toHaveBeenCalledWith(
      "note",
      expect.objectContaining({ duration: 4000, icon: expect.anything() }),
    );
  });
});
