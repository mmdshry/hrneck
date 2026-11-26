import { useSyncExternalStore } from "react";

function subscribeToNothing(): () => void {
  return () => {};
}

/**
 * Reads a value that only exists in the browser (sessionStorage, feature detection)
 * without an effect. `getServerSnapshot` is used during SSR and hydration, so the
 * first client render matches the server and the real value follows immediately.
 */
export function useClientSnapshot<T>(getSnapshot: () => T, getServerSnapshot: () => T): T {
  return useSyncExternalStore(subscribeToNothing, getSnapshot, getServerSnapshot);
}
