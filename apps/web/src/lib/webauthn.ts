/**
 * Browser side of WebAuthn passkey ceremonies.
 *
 * The API exchanges JSON with base64url strings, while `navigator.credentials`
 * works with ArrayBuffers. These helpers convert in both directions and keep no
 * module state, so they are safe to call from any client component.
 */

type CredentialDescriptorJson = {
  id: string;
  type: "public-key";
  transports?: AuthenticatorTransport[];
};

/** `publicKey` creation options as the API serializes them (binary fields as base64url). */
export type ServerCreationOptions = {
  publicKey: {
    challenge: string;
    rp: PublicKeyCredentialRpEntity;
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: PublicKeyCredentialParameters[];
    timeout?: number;
    excludeCredentials?: CredentialDescriptorJson[];
    authenticatorSelection?: AuthenticatorSelectionCriteria;
    attestation?: AttestationConveyancePreference;
  };
};

/** `publicKey` request options as the API serializes them (binary fields as base64url). */
export type ServerRequestOptions = {
  publicKey: {
    challenge: string;
    rpId?: string;
    timeout?: number;
    allowCredentials?: CredentialDescriptorJson[];
    userVerification?: UserVerificationRequirement;
  };
};

/** JSON body the API's WebAuthn deserializer accepts for a registration response. */
export type SerializedAttestation = {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports: AuthenticatorTransport[];
  };
  clientExtensionResults: Record<string, unknown>;
};

/** JSON body the API's WebAuthn deserializer accepts for an assertion response. */
export type SerializedAssertion = {
  id: string;
  rawId: string;
  type: "public-key";
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string;
  };
  clientExtensionResults: Record<string, unknown>;
};

/**
 * Why passkeys cannot be used on this page. "insecure" means the origin is not
 * https or localhost: browsers then hide the WebAuthn API entirely, even though
 * the browser itself supports passkeys. "unsupported" means the browser lacks them.
 */
export type PasskeyUnavailableReason = "insecure" | "unsupported";

/** Result for components. "pending" applies during SSR and hydration, before the client can check. */
export type PasskeyCheck = PasskeyUnavailableReason | "supported" | "pending";

export type PasskeyEnvironment = {
  isSecureContext: boolean;
  hasPublicKeyCredential: boolean;
  hasCredentialsApi: boolean;
};

export function readPasskeyEnvironment(): PasskeyEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      isSecureContext: false,
      hasPublicKeyCredential: false,
      hasCredentialsApi: false,
    };
  }

  return {
    isSecureContext: window.isSecureContext === true,
    hasPublicKeyCredential: typeof window.PublicKeyCredential !== "undefined",
    hasCredentialsApi:
      typeof navigator.credentials?.create === "function" &&
      typeof navigator.credentials?.get === "function",
  };
}

/** Null when passkeys can be used on this page. The secure-context check comes first. */
export function passkeyUnavailableReason(
  env: PasskeyEnvironment,
): PasskeyUnavailableReason | null {
  if (!env.isSecureContext) {
    return "insecure";
  }
  if (!env.hasPublicKeyCredential || !env.hasCredentialsApi) {
    return "unsupported";
  }

  return null;
}

/** Client-side check used with `useClientSnapshot`. */
export function checkPasskeySupport(): PasskeyCheck {
  return passkeyUnavailableReason(readPasskeyEnvironment()) ?? "supported";
}

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function toDescriptor(
  descriptor: CredentialDescriptorJson,
): PublicKeyCredentialDescriptor {
  return {
    type: descriptor.type,
    id: base64UrlToBuffer(descriptor.id),
    ...(descriptor.transports ? { transports: descriptor.transports } : {}),
  };
}

export function toCreationOptions(
  server: ServerCreationOptions,
): PublicKeyCredentialCreationOptions {
  const { challenge, user, excludeCredentials, ...rest } = server.publicKey;

  return {
    ...rest,
    challenge: base64UrlToBuffer(challenge),
    user: { ...user, id: base64UrlToBuffer(user.id) },
    excludeCredentials: (excludeCredentials ?? []).map(toDescriptor),
  };
}

export function toRequestOptions(
  server: ServerRequestOptions,
): PublicKeyCredentialRequestOptions {
  const { challenge, allowCredentials, ...rest } = server.publicKey;

  return {
    ...rest,
    challenge: base64UrlToBuffer(challenge),
    allowCredentials: (allowCredentials ?? []).map(toDescriptor),
  };
}

export function serializeAttestation(
  credential: PublicKeyCredential,
): SerializedAttestation {
  const response = credential.response as AuthenticatorAttestationResponse;

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: "public-key",
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports:
        typeof response.getTransports === "function"
          ? (response.getTransports() as AuthenticatorTransport[])
          : [],
    },
    clientExtensionResults: {},
  };
}

export function serializeAssertion(
  credential: PublicKeyCredential,
): SerializedAssertion {
  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: "public-key",
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      ...(response.userHandle
        ? { userHandle: bufferToBase64Url(response.userHandle) }
        : {}),
    },
    clientExtensionResults: {},
  };
}

/**
 * Runs the registration ceremony. Throws if the user cancels or the authenticator fails.
 */
export async function createPasskey(
  server: ServerCreationOptions,
): Promise<SerializedAttestation> {
  const credential = await navigator.credentials.create({
    publicKey: toCreationOptions(server),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey registration did not return a credential.");
  }

  return serializeAttestation(credential);
}

/**
 * Runs the authentication ceremony. Throws if the user cancels or the authenticator fails.
 */
export async function getPasskeyAssertion(
  server: ServerRequestOptions,
): Promise<SerializedAssertion> {
  const credential = await navigator.credentials.get({
    publicKey: toRequestOptions(server),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Passkey sign-in did not return a credential.");
  }

  return serializeAssertion(credential);
}

/** True when the user dismissed the browser prompt (not a server or device error). */
export function isPasskeyCancelled(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("name" in err)) {
    return false;
  }
  const name = (err as { name: unknown }).name;

  return name === "NotAllowedError" || name === "AbortError";
}
