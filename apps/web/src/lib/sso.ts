export const SSO_PROVIDERS = ["google", "microsoft"] as const;
export type SsoProvider = (typeof SSO_PROVIDERS)[number];

export function isSsoProvider(value: string): value is SsoProvider {
  return (SSO_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Codes the API puts in `?sso_error=`. Keep in sync with App\Domains\IdentityAccess\Support\SsoError.
 */
export const SSO_ERROR_CODES = [
  "cancelled",
  "invalid_request",
  "invalid_state",
  "provider_error",
  "not_linked",
  "account_disabled",
  "handoff_invalid",
  "provider_not_configured",
] as const;
export type SsoErrorCode = (typeof SSO_ERROR_CODES)[number];

export type SsoErrorMessageKey =
  | "ssoErrorCancelled"
  | "ssoErrorInvalidRequest"
  | "ssoErrorInvalidState"
  | "ssoErrorProviderError"
  | "ssoErrorNotLinked"
  | "ssoErrorAccountDisabled"
  | "ssoErrorHandoffInvalid"
  | "ssoErrorProviderNotConfigured";

export function isSsoErrorCode(value: string | null): value is SsoErrorCode {
  return value !== null && (SSO_ERROR_CODES as readonly string[]).includes(value);
}

export function ssoErrorMessageKey(code: SsoErrorCode): SsoErrorMessageKey {
  switch (code) {
    case "cancelled":
      return "ssoErrorCancelled";
    case "invalid_request":
      return "ssoErrorInvalidRequest";
    case "invalid_state":
      return "ssoErrorInvalidState";
    case "provider_error":
      return "ssoErrorProviderError";
    case "not_linked":
      return "ssoErrorNotLinked";
    case "account_disabled":
      return "ssoErrorAccountDisabled";
    case "handoff_invalid":
      return "ssoErrorHandoffInvalid";
    case "provider_not_configured":
      return "ssoErrorProviderNotConfigured";
    default: {
      const unreachable: never = code;
      return unreachable;
    }
  }
}

/** Same-origin relative paths only. The API applies the same rule server-side. */
export function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }
  return raw;
}

/** URL that starts the SSO flow. The API redirects from here to the identity provider. */
export function ssoStartUrl(
  provider: SsoProvider,
  options: { returnTo: string; next: string | null; remember: boolean },
): string {
  const params = new URLSearchParams({ return_to: options.returnTo });
  if (options.next) {
    params.set("next", options.next);
  }
  if (options.remember) {
    params.set("remember", "1");
  }
  return `/api/v1/auth/oauth/${provider}/redirect?${params.toString()}`;
}

export function ssoLoginErrorPath(code: SsoErrorCode): string {
  return `/login?${new URLSearchParams({ sso_error: code }).toString()}`;
}
