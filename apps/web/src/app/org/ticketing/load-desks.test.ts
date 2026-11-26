import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { SdDesk } from "./ticketing-types";
import {
  describeDeskLoadError,
  isRetryableLoadError,
  loadActiveDesks,
  withRetry,
} from "./load-desks";

const noWait = { sleep: async () => {} };

describe("isRetryableLoadError", () => {
  it("retries server, rate-limit and network failures", () => {
    expect(isRetryableLoadError(new ApiError(500, "Server Error"))).toBe(true);
    expect(isRetryableLoadError(new ApiError(429, "Too Many"))).toBe(true);
    expect(isRetryableLoadError(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not retry auth failures", () => {
    expect(isRetryableLoadError(new ApiError(401, "Unauthenticated"))).toBe(false);
    expect(isRetryableLoadError(new ApiError(403, "Forbidden"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns the first success after transient failures", async () => {
    const task = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ApiError(503, "Unavailable"))
      .mockRejectedValueOnce(new ApiError(503, "Unavailable"))
      .mockResolvedValueOnce("ok");
    const waits: number[] = [];

    await expect(
      withRetry(task, {
        sleep: async (ms) => {
          waits.push(ms);
        },
      }),
    ).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([500, 1500]);
  });

  it("gives up after the configured retries", async () => {
    const task = vi.fn(async () => {
      throw new ApiError(500, "Server Error");
    });

    await expect(withRetry(task, noWait)).rejects.toBeInstanceOf(ApiError);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("fails immediately on 403 without retrying", async () => {
    const task = vi.fn(async () => {
      throw new ApiError(403, "Forbidden");
    });

    await expect(withRetry(task, noWait)).rejects.toBeInstanceOf(ApiError);
    expect(task).toHaveBeenCalledTimes(1);
  });
});

describe("loadActiveDesks", () => {
  it("drops the knowledge base desk", async () => {
    const request = async () => ({
      data: [
        { id: 1, name: "Incident", type: "incident" } as SdDesk,
        { id: 5, name: "Knowledge Base", type: "kb" } as SdDesk,
      ],
    });

    await expect(loadActiveDesks(request, noWait)).resolves.toEqual([
      { id: 1, name: "Incident", type: "incident" },
    ]);
  });

  it("returns an empty list when the response has no data", async () => {
    await expect(loadActiveDesks(async () => ({}), noWait)).resolves.toEqual([]);
  });
});

describe("describeDeskLoadError", () => {
  it("shows the API message for API errors", () => {
    expect(describeDeskLoadError(new ApiError(429, '{"message":"Too Many Attempts."}'))).toBe(
      "Too Many Attempts.",
    );
  });

  it("omits the description for unexpected errors", () => {
    expect(describeDeskLoadError(new TypeError("Failed to fetch"))).toBeUndefined();
  });
});
