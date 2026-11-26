import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { friendlyMessage, NO_ASSIGNED_TRAINING_MESSAGE } from "./api";

describe("friendlyMessage", () => {
  it("hides a debug 403 dump behind the learner sentence", () => {
    const body = JSON.stringify({
      message: "",
      exception: "Symfony\\Component\\HttpKernel\\Exception\\HttpException",
      file: "C:\\app\\vendor\\laravel\\framework\\Application.php",
      trace: [{ file: "vendor\\laravel\\framework\\helpers.php" }],
    });

    expect(friendlyMessage(403, body)).toBe(NO_ASSIGNED_TRAINING_MESSAGE);
    expect(friendlyMessage(403, body)).not.toContain("vendor");
    expect(friendlyMessage(403, body)).not.toContain("trace");
  });

  it("keeps a short server message", () => {
    expect(
      friendlyMessage(
        403,
        JSON.stringify({ message: NO_ASSIGNED_TRAINING_MESSAGE }),
      ),
    ).toBe(NO_ASSIGNED_TRAINING_MESSAGE);
  });

  it("does not return a raw body", () => {
    expect(friendlyMessage(500, "Exception trace vendor\\laravel")).toBe(
      "Request failed (500)",
    );
  });
});

const sessionUser = {
  id: 7,
  name: "Ada",
  email: "ada@hrneck.test",
  tenant_id: "acme",
  roles: ["admin"],
  permissions: ["org.settings.manage"],
  is_platform_staff: false,
  mfa_enabled: false,
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function clearCookies(): void {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (!name) continue;
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

describe("csrf and session dedupe", () => {
  beforeEach(() => {
    vi.resetModules();
    clearCookies();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookies();
    window.localStorage.removeItem("hrneck_tenant");
  });

  it("does not request a csrf cookie when XSRF-TOKEN is already set", async () => {
    document.cookie = "XSRF-TOKEN=already-set; path=/";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { ensureCsrf } = await import("./api");

    await ensureCsrf();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shares one csrf request across concurrent callers", async () => {
    const gate = deferred<Response>();
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      return gate.promise;
    });
    const { ensureCsrf } = await import("./api");

    const pending = Promise.all([ensureCsrf(), ensureCsrf()]);

    expect(calls).toBe(1);
    gate.resolve(new Response(null, { status: 204 }));
    await pending;
    expect(calls).toBe(1);
  });

  it("shares one /auth/me across concurrent callers and reuses it for the tab", async () => {
    document.cookie = "XSRF-TOKEN=already-set; path=/";
    const gate = deferred<Response>();
    const urls: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      urls.push(requestUrl(input));
      return gate.promise;
    });
    const { fetchSessionUser } = await import("./api");

    const pending = Promise.all([fetchSessionUser(), fetchSessionUser()]);

    const meCalls = () => urls.filter((url) => url.includes("/auth/me"));
    expect(meCalls()).toHaveLength(1);
    gate.resolve(jsonResponse({ data: sessionUser }));
    const [first, second] = await pending;
    expect(first?.email).toBe("ada@hrneck.test");
    expect(second).toEqual(first);

    await fetchSessionUser();
    expect(meCalls()).toHaveLength(1);
    expect(urls.some((url) => url.includes("csrf-cookie"))).toBe(false);
  });

  it("loads /auth/me again after signOut", async () => {
    document.cookie = "XSRF-TOKEN=already-set; path=/";
    const urls: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      urls.push(url);
      if ((init?.method ?? "GET").toUpperCase() === "POST") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(jsonResponse({ data: sessionUser }));
    });
    const { fetchSessionUser, signOut } = await import("./api");

    await fetchSessionUser();
    await signOut();
    await fetchSessionUser();

    expect(urls.filter((url) => url.includes("/auth/me"))).toHaveLength(2);
  });

  it("loads /auth/me again when the organization changes", async () => {
    document.cookie = "XSRF-TOKEN=already-set; path=/";
    window.localStorage.setItem("hrneck_tenant", "itneck");
    const urls: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      urls.push(requestUrl(input));
      return Promise.resolve(jsonResponse({ data: sessionUser }));
    });
    const { fetchSessionUser } = await import("./api");

    await fetchSessionUser();
    await fetchSessionUser();
    expect(urls.filter((url) => url.includes("/auth/me"))).toHaveLength(1);

    window.localStorage.setItem("hrneck_tenant", "company");
    await fetchSessionUser();
    expect(urls.filter((url) => url.includes("/auth/me"))).toHaveLength(2);
  });

  it("refreshes the csrf cookie after 419 even when a token is already present", async () => {
    document.cookie = "XSRF-TOKEN=stale; path=/";
    let me = 0;
    const urls: string[] = [];
    vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      urls.push(url);
      if (url.includes("csrf-cookie")) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      me += 1;
      if (me === 1) {
        return Promise.resolve(new Response("expired", { status: 419, statusText: "Page Expired" }));
      }
      return Promise.resolve(
        jsonResponse({ data: { ...sessionUser, mfa_enabled: true } }),
      );
    });
    const { fetchSessionUser } = await import("./api");

    const user = await fetchSessionUser();

    expect(user?.mfa_enabled).toBe(true);
    expect(urls.filter((url) => url.includes("csrf-cookie"))).toHaveLength(1);
    expect(urls.filter((url) => url.includes("/auth/me"))).toHaveLength(2);
  });

  it("drops the cached session after a successful mutation", async () => {
    document.cookie = "XSRF-TOKEN=already-set; path=/";
    let me = 0;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.includes("/auth/me")) {
        me += 1;
        return Promise.resolve(
          jsonResponse({ data: { ...sessionUser, mfa_enabled: me > 1 } }),
        );
      }
      if ((init?.method ?? "GET").toUpperCase() === "POST") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response("missing", { status: 404 }));
    });
    const { api, fetchSessionUser } = await import("./api");

    expect((await fetchSessionUser())?.mfa_enabled).toBe(false);
    await api("/api/v1/auth/mfa/confirm", { method: "POST" });
    expect((await fetchSessionUser())?.mfa_enabled).toBe(true);
  });

  it("retries csrf after a failed cookie request", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("offline"));
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const { ensureCsrf } = await import("./api");

    await expect(ensureCsrf()).rejects.toThrow("offline");
    await ensureCsrf();

    expect(calls).toBe(2);
  });

  it("retries /auth/me after a failed load", async () => {
    document.cookie = "XSRF-TOKEN=already-set; path=/";
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("offline"));
      return Promise.resolve(jsonResponse({ data: sessionUser }));
    });
    const { fetchSessionUser } = await import("./api");

    await expect(fetchSessionUser()).rejects.toThrow("offline");
    expect((await fetchSessionUser())?.email).toBe("ada@hrneck.test");
    expect(calls).toBe(2);
  });

  it("does not cache a signed-out session", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      return Promise.resolve(
        new Response(JSON.stringify({ message: "Unauthenticated." }), { status: 401 }),
      );
    });
    const { fetchSessionUser } = await import("./api");

    expect(await fetchSessionUser()).toBeNull();
    expect(await fetchSessionUser()).toBeNull();
    expect(calls).toBe(2);
  });
});


describe("session subscription", () => {
  beforeEach(() => {
    vi.resetModules();
    clearCookies();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCookies();
  });

  it("keeps plan, status and usage from /auth/me and drops malformed values", async () => {
    document.cookie = "XSRF-TOKEN=already-set; path=/";
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        jsonResponse({
          data: {
            ...sessionUser,
            subscription: {
              plan_name: "Growth",
              status: "active",
              effective_status: "bogus",
              read_only: true,
              ends_at: "2026-12-31T00:00:00+00:00",
              over_limit: true,
              usage: {
                employees: { used: "4", limit: 3, over_limit: true },
                users: { used: 1, limit: null, over_limit: false },
              },
            },
          },
        }),
      ),
    );
    const { fetchSessionUser } = await import("./api");

    const user = await fetchSessionUser();

    expect(user?.subscription).toEqual({
      plan_name: "Growth",
      status: "active",
      effective_status: null,
      read_only: true,
      ends_at: "2026-12-31T00:00:00+00:00",
      over_limit: true,
      usage: {
        employees: { used: 4, limit: 3, over_limit: true },
        users: { used: 1, limit: null, over_limit: false },
      },
    });
  });

  it("leaves subscription out when /auth/me sends none", async () => {
    document.cookie = "XSRF-TOKEN=already-set; path=/";
    vi.stubGlobal("fetch", () =>
      Promise.resolve(jsonResponse({ data: sessionUser })),
    );
    const { fetchSessionUser } = await import("./api");

    const user = await fetchSessionUser();

    expect(user).not.toHaveProperty("subscription");
  });
});