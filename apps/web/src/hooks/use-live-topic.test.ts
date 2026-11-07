import { describe, expect, it } from "vitest";
import { nextLiveStatus } from "./use-live-topic";

describe("nextLiveStatus", () => {
  it("marks a successful subscription as live", () => {
    expect(nextLiveStatus("connecting", "subscribed")).toBe("live");
  });

  it("keeps live when a late subscription callback arrives", () => {
    expect(nextLiveStatus("live", "subscribed")).toBe("live");
    expect(nextLiveStatus("live", "snapshot")).toBe("live");
  });

  it("does not return to connecting after the socket is up", () => {
    expect(nextLiveStatus("live", "subscribed")).not.toBe("connecting");
  });

  it("records an error", () => {
    expect(nextLiveStatus("live", "error")).toBe("error");
    expect(nextLiveStatus("connecting", "error")).toBe("error");
  });
});
