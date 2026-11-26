import { describe, expect, it } from "vitest";
import {
  base64UrlToBuffer,
  bufferToBase64Url,
  checkPasskeySupport,
  isPasskeyCancelled,
  passkeyUnavailableReason,
  serializeAssertion,
  serializeAttestation,
  toCreationOptions,
  toRequestOptions,
} from "./webauthn";

function bytes(...values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer as ArrayBuffer;
}

function asBytes(buffer: ArrayBuffer): number[] {
  return Array.from(new Uint8Array(buffer));
}

describe("base64url", () => {
  it("round-trips canonical unpadded values", () => {
    const encoded = "AQID-_8";
    expect(bufferToBase64Url(base64UrlToBuffer(encoded))).toBe(encoded);
  });

  it("decodes every padding length the WebAuthn payloads can produce", () => {
    expect(asBytes(base64UrlToBuffer("AQ"))).toEqual([1]);
    expect(asBytes(base64UrlToBuffer("AQI"))).toEqual([1, 2]);
    expect(asBytes(base64UrlToBuffer("AQID"))).toEqual([1, 2, 3]);
  });

  it("never emits padding or the standard base64 alphabet", () => {
    const encoded = bufferToBase64Url(bytes(251, 255, 191));
    expect(encoded).not.toMatch(/[+/=]/);
    expect(encoded).toBe("-_-_");
  });
});

describe("option conversion", () => {
  it("turns the server creation challenge, user id and excludeCredentials into binary", () => {
    const options = toCreationOptions({
      publicKey: {
        challenge: "AQID",
        rp: { id: "hrneck.test", name: "HRNeck" },
        user: { id: "Ag", name: "ada@example.test", displayName: "Ada" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        timeout: 60000,
        attestation: "none",
        excludeCredentials: [
          { id: "BAU", type: "public-key", transports: ["internal"] },
        ],
      },
    });

    expect(asBytes(options.challenge as ArrayBuffer)).toEqual([1, 2, 3]);
    expect(asBytes(options.user.id as ArrayBuffer)).toEqual([2]);
    expect(options.user.name).toBe("ada@example.test");
    expect(options.rp).toEqual({ id: "hrneck.test", name: "HRNeck" });
    expect(options.timeout).toBe(60000);
    expect(options.excludeCredentials).toHaveLength(1);
    expect(asBytes(options.excludeCredentials![0].id as ArrayBuffer)).toEqual([
      4, 5,
    ]);
    expect(options.excludeCredentials![0].transports).toEqual(["internal"]);
  });

  it("maps allowCredentials for assertion and leaves transports out when absent", () => {
    const options = toRequestOptions({
      publicKey: {
        challenge: "AQID",
        rpId: "hrneck.test",
        userVerification: "preferred",
        allowCredentials: [{ id: "BAU", type: "public-key" }],
      },
    });

    expect(asBytes(options.challenge as ArrayBuffer)).toEqual([1, 2, 3]);
    expect(options.rpId).toBe("hrneck.test");
    expect(options.userVerification).toBe("preferred");
    expect(options.allowCredentials![0]).not.toHaveProperty("transports");
  });

  it("defaults to empty allow and exclude lists", () => {
    expect(
      toRequestOptions({ publicKey: { challenge: "AQ" } }).allowCredentials,
    ).toEqual([]);
    expect(
      toCreationOptions({
        publicKey: {
          challenge: "AQ",
          rp: { name: "HRNeck" },
          user: { id: "Ag", name: "a", displayName: "a" },
          pubKeyCredParams: [],
        },
      }).excludeCredentials,
    ).toEqual([]);
  });
});

describe("credential serialization", () => {
  it("serializes a registration response in the shape the API expects", () => {
    const credential = {
      id: "AAEC",
      rawId: bytes(0, 1, 2),
      response: {
        clientDataJSON: bytes(123, 125),
        attestationObject: bytes(163),
        getTransports: () => ["internal", "hybrid"],
      },
    } as unknown as PublicKeyCredential;

    const payload = serializeAttestation(credential);

    expect(payload).toEqual({
      id: "AAEC",
      rawId: "AAEC",
      type: "public-key",
      response: {
        clientDataJSON: "e30",
        attestationObject: "ow",
        transports: ["internal", "hybrid"],
      },
      clientExtensionResults: {},
    });
  });

  it("serializes an assertion and keeps userHandle only when the authenticator sent one", () => {
    const base = {
      id: "AAEC",
      rawId: bytes(0, 1, 2),
      response: {
        clientDataJSON: bytes(123, 125),
        authenticatorData: bytes(1),
        signature: bytes(2),
      },
    };

    const withoutHandle = serializeAssertion({
      ...base,
      response: { ...base.response, userHandle: null },
    } as unknown as PublicKeyCredential);
    expect(withoutHandle.response).not.toHaveProperty("userHandle");
    expect(withoutHandle.response.signature).toBe("Ag");

    const withHandle = serializeAssertion({
      ...base,
      response: { ...base.response, userHandle: bytes(7) },
    } as unknown as PublicKeyCredential);
    expect(withHandle.response.userHandle).toBe("Bw");
  });
});

describe("passkey availability", () => {
  const ready = {
    isSecureContext: true,
    hasPublicKeyCredential: true,
    hasCredentialsApi: true,
  };

  it("allows passkeys on a secure origin with the WebAuthn API", () => {
    expect(passkeyUnavailableReason(ready)).toBeNull();
  });

  it("reports plain http as insecure, even when the API object exists", () => {
    expect(passkeyUnavailableReason({ ...ready, isSecureContext: false })).toBe(
      "insecure",
    );
  });

  it("reports browsers without passkey support on a secure origin", () => {
    expect(
      passkeyUnavailableReason({ ...ready, hasPublicKeyCredential: false }),
    ).toBe("unsupported");
    expect(
      passkeyUnavailableReason({ ...ready, hasCredentialsApi: false }),
    ).toBe("unsupported");
  });

  it("reports insecure outside a browser, where there is no secure context", () => {
    expect(checkPasskeySupport()).toBe("insecure");
  });
});

describe("passkey cancellation", () => {
  it("treats user cancellation as its own case", () => {
    expect(isPasskeyCancelled({ name: "NotAllowedError" })).toBe(true);
    expect(isPasskeyCancelled({ name: "AbortError" })).toBe(true);
    expect(isPasskeyCancelled(new Error("network down"))).toBe(false);
    expect(isPasskeyCancelled(null)).toBe(false);
  });
});
