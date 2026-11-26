import { ApiError } from "@/lib/api";
import type { SdDesk } from "./ticketing-types";

const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [500, 1500];

type RetryOptions = {
  /** Wait before each retry; the length sets how many retries follow the first attempt. */
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Auth failures do not recover by retrying; network errors, 429 and 5xx may. */
export function isRetryableLoadError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status !== 401 && err.status !== 403;
  }
  return true;
}

export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const delays = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? wait;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (err) {
      const delay = delays[attempt];
      if (delay === undefined || !isRetryableLoadError(err)) {
        throw err;
      }
      await sleep(delay);
    }
  }
}

/** Loads the desks a new ticket can target. The KB desk is not a ticket queue, so it is dropped. */
export async function loadActiveDesks(
  request: () => Promise<{ data?: SdDesk[] }>,
  options?: RetryOptions,
): Promise<SdDesk[]> {
  const res = await withRetry(request, options);
  return (res.data ?? []).filter((desk) => desk.type !== "kb");
}

/** Text for the error toast. Only API errors carry a message worth showing; others get the generic title. */
export function describeDeskLoadError(err: unknown): string | undefined {
  return err instanceof ApiError ? err.message : undefined;
}
