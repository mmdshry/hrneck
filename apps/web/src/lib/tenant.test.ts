import { afterEach, describe, expect, it } from "vitest";
import {
  clearTenant,
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
