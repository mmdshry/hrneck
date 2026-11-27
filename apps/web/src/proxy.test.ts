import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function request(url: string): NextRequest {
  const host = new URL(url).host;
  return new NextRequest(url, { headers: { "x-forwarded-host": host } });
}

describe("proxy host rules", () => {
  it("sends forgot-password on the main site to the organization finder", async () => {
    const response = await proxy(request("https://hrneck.test/login/forgot"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://hrneck.test/login");
  });

  it("keeps forgot-password on an organization host", async () => {
    const response = await proxy(request("https://itneck.hrneck.test/login/forgot"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps forgot-password on the staff host", async () => {
    const response = await proxy(request("https://app.hrneck.test/login/forgot"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("marks organization hosts with their tenant and leaves the main site unmarked", async () => {
    const tenant = await proxy(request("https://itneck.hrneck.test/"));
    expect(tenant.headers.get("x-hrneck-tenant")).toBe("itneck");

    const central = await proxy(request("https://hrneck.test/"));
    expect(central.headers.get("x-hrneck-tenant")).toBeNull();

    const staff = await proxy(request("https://app.hrneck.test/"));
    expect(staff.headers.get("x-hrneck-tenant")).toBeNull();
  });
});
