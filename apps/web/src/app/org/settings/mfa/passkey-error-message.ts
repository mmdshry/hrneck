import { isPasskeyCancelled } from "@/lib/webauthn";

/**
 * Message for a failed passkey ceremony. A dismissed browser prompt gets its own wording;
 * other errors show their own message, or the fallback when the error has none.
 */
export function passkeyErrorMessage(
  err: unknown,
  fallback: string,
  cancelledMessage: string,
): string {
  if (isPasskeyCancelled(err)) {
    return cancelledMessage;
  }

  return err instanceof Error ? err.message : fallback;
}
