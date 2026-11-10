import { describe, expect, it } from "vitest";
import { nextLiveStatus, nextReconnectDelayMs } from "./use-live-topic";

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

  it("moves to connecting when reconnecting from live", () => {
    expect(nextLiveStatus("live", "reconnecting")).toBe("connecting");
  });

  it("keeps error visible while reconnecting after a failure", () => {
    expect(nextLiveStatus("error", "reconnecting")).toBe("error");
  });
});

describe("nextReconnectDelayMs", () => {
  it("grows exponentially and caps", () => {
    expect(nextReconnectDelayMs(0)).toBe(1000);
    expect(nextReconnectDelayMs(1)).toBe(2000);
    expect(nextReconnectDelayMs(2)).toBe(4000);
    expect(nextReconnectDelayMs(10)).toBe(30_000);
  });
});
