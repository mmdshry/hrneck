import { afterEach, describe, expect, it } from "vitest";
import {
  clearTenant,
  hostKind,
  organizationSlugFromInput,
  requestHost,
  resolveTenant,
  setTenant,
  tenancyBaseDomain,
  tenantFromHostname,
  tenantWorkspaceUrl,
} from "./tenant";

function setLocation(hostname: string, search = ""): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      hostname,
      search,
      href: `http://${hostname}/${search}`,
    },
  });
}

afterEach(() => {
  window.localStorage.clear();
  setLocation("hrneck.test");
});

describe("tenantFromHostname", () => {
  it("treats apex as central", () => {
    expect(tenantFromHostname("hrneck.test")).toBeNull();
  });

  it("reads tenant slug from subdomain hosts", () => {
    expect(tenantFromHostname("itneck.hrneck.test")).toBe("itneck");
    expect(tenantFromHostname("company.hrneck.test")).toBe("company");
  });

  it("ignores reserved app aliases", () => {
    expect(tenantFromHostname("app.hrneck.test")).toBeNull();
    expect(tenantFromHostname("admin.hrneck.test")).toBeNull();
    expect(tenantFromHostname("api.hrneck.test")).toBeNull();
    expect(tenantFromHostname("mail.hrneck.test")).toBeNull();
    expect(tenantFromHostname("www.hrneck.test")).toBeNull();
  });
});

describe("hostKind", () => {
  it("treats a tenant subdomain as an organization", () => {
    expect(hostKind("itneck.hrneck.test")).toBe("organization");
    expect(hostKind("company.hrneck.com")).toBe("organization");
    expect(hostKind("ITNECK.hrneck.test:3100")).toBe("organization");
  });

  it("treats app.{base} as the platform staff host", () => {
    expect(hostKind("app.hrneck.test")).toBe("platform");
    expect(hostKind("app.hrneck.com:443")).toBe("platform");
  });

  it("treats the apex, www, admin and localhost as the main site", () => {
    expect(hostKind("hrneck.test")).toBe("central");
    expect(hostKind("hrneck.com")).toBe("central");
    expect(hostKind("www.hrneck.com")).toBe("central");
    expect(hostKind("admin.hrneck.com")).toBe("central");
    expect(hostKind("localhost:3100")).toBe("central");
    expect(hostKind("127.0.0.1:3100")).toBe("central");
  });
});

describe("requestHost", () => {
  it("prefers the forwarded host and keeps only the first hop", () => {
    const headers = new Headers({
      "x-forwarded-host": "itneck.hrneck.com, 10.0.0.1",
      host: "127.0.0.1:3100",
    });
    expect(requestHost(headers)).toBe("itneck.hrneck.com");
  });

  it("falls back to the host header", () => {
    expect(requestHost(new Headers({ host: "app.hrneck.test:3100" }))).toBe(
      "app.hrneck.test:3100",
    );
  });

  it("is empty when no host is sent", () => {
    expect(requestHost(new Headers())).toBe("");
  });
});

describe("organizationSlugFromInput", () => {
  it("accepts a bare organization name", () => {
    expect(organizationSlugFromInput("itneck")).toBe("itneck");
    expect(organizationSlugFromInput("  Acme-Corp  ")).toBe("acme-corp");
  });

  it("accepts an address or a pasted sign-in link", () => {
    expect(organizationSlugFromInput("itneck.hrneck.com")).toBe("itneck");
    expect(organizationSlugFromInput("https://ITneck.hrneck.com/login?next=/org")).toBe("itneck");
    expect(organizationSlugFromInput("http://company.hrneck.test/")).toBe("company");
  });

  it("rejects input that cannot be an organization", () => {
    expect(organizationSlugFromInput("")).toBeNull();
    expect(organizationSlugFromInput("   ")).toBeNull();
    expect(organizationSlugFromInput("my company")).toBeNull();
    expect(organizationSlugFromInput("-leading")).toBeNull();
    expect(organizationSlugFromInput("a".repeat(64))).toBeNull();
    expect(organizationSlugFromInput("user@itneck")).toBeNull();
  });

  it("accepts the longest valid slug", () => {
    expect(organizationSlugFromInput("a".repeat(63))).toBe("a".repeat(63));
  });
});

describe("resolveTenant", () => {
  it("uses localStorage on apex when set", () => {
    setLocation("hrneck.test");
    window.localStorage.setItem("hrneck_tenant", "itneck");
    expect(resolveTenant()).toBe("itneck");
  });

  it("prefers tenant subdomain over stale localStorage", () => {
    setLocation("itneck.hrneck.test");
    window.localStorage.setItem("hrneck_tenant", "company");
    expect(resolveTenant()).toBe("itneck");
  });

  it("uses localStorage on app alias hosts", () => {
    setLocation("app.hrneck.test");
    window.localStorage.setItem("hrneck_tenant", "company");
    expect(resolveTenant()).toBe("company");
  });

  it("honors ?tenant= and persists it", () => {
    setLocation("hrneck.test", "?tenant=test");
    expect(resolveTenant()).toBe("test");
    expect(window.localStorage.getItem("hrneck_tenant")).toBe("test");
  });

  it("defaults to itneck on apex without storage", () => {
    setLocation("hrneck.test");
    expect(resolveTenant()).toBe("itneck");
  });

  it("uses preferred tenant when provided on apex", () => {
    setLocation("hrneck.test");
    expect(resolveTenant("company")).toBe("company");
    expect(window.localStorage.getItem("hrneck_tenant")).toBe("company");
  });

  it("setTenant and clearTenant round-trip", () => {
    setLocation("hrneck.test");
    setTenant("company");
    expect(resolveTenant()).toBe("company");
    clearTenant();
    expect(resolveTenant()).toBe("itneck");
  });
});

describe("tenancyBaseDomain", () => {
  it("strips the tenant label from subdomain hosts", () => {
    expect(tenancyBaseDomain("mmdshry.hrneck.test")).toBe("hrneck.test");
  });

  it("returns apex hosts unchanged", () => {
    expect(tenancyBaseDomain("hrneck.test")).toBe("hrneck.test");
  });
});

describe("tenantWorkspaceUrl", () => {
  it("preserves path and search on the home tenant host", () => {
    expect(
      tenantWorkspaceUrl("itneck", "/org/training", {
        search: "?tab=courses",
        hostname: "mmdshry.hrneck.test",
        protocol: "http:",
        port: "",
      }),
    ).toBe("http://itneck.hrneck.test/org/training?tab=courses");
  });
});
