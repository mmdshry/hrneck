import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyPrimaryColor,
  brandDisplayName,
  clearPrimaryColor,
  isValidHexColor,
  normalizeHex,
} from "./branding";

describe("branding helpers", () => {
  afterEach(() => {
    clearPrimaryColor();
  });

  it("validates hex colors", () => {
    expect(isValidHexColor("#0f766e")).toBe(true);
    expect(isValidHexColor("#abc")).toBe(true);
    expect(isValidHexColor("blue")).toBe(false);
    expect(isValidHexColor(null)).toBe(false);
  });

  it("normalizes short hex", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });

  it("applies primary CSS variables", () => {
    const setProperty = vi.fn();
    const removeProperty = vi.fn();
    vi.stubGlobal("document", {
      documentElement: { style: { setProperty, removeProperty } },
    });

    applyPrimaryColor("#0f766e");
    expect(setProperty).toHaveBeenCalledWith("--primary", "#0f766e");
    expect(setProperty).toHaveBeenCalledWith("--ring", "#0f766e");
    expect(setProperty).not.toHaveBeenCalledWith("--brand", expect.anything());
    expect(setProperty).not.toHaveBeenCalledWith("--spark", expect.anything());

    applyPrimaryColor("nope");
    expect(removeProperty).toHaveBeenCalledWith("--primary");
  });

  it("resolves display name", () => {
    expect(brandDisplayName({ display_name: "ITneck" })).toBe("ITneck");
    expect(brandDisplayName({ display_name: "  " })).toBe("HRNECK");
    expect(brandDisplayName(null)).toBe("HRNECK");
  });
});
