import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MinimalLoader } from "@/components/ui/minimal-loader";
import { PageSkeleton } from "@/components/ui/page-skeleton";

afterEach(() => {
  cleanup();
});

describe("PageSkeleton", () => {
  it("exposes a busy status region", () => {
    render(<PageSkeleton />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Loading")).toBeTruthy();
  });

  it("renders the page heading by default", () => {
    render(<PageSkeleton />);
    expect(screen.getByRole("heading", { level: 1, name: "Loading" })).toBeTruthy();
  });

  it("drops the heading when nested under a section heading", () => {
    render(<PageSkeleton asHeading={false} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Loading")).toBeTruthy();
  });
});

describe("MinimalLoader", () => {
  it("exposes a busy status region", () => {
    render(<MinimalLoader label="Loading chart" />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Loading chart")).toBeTruthy();
  });
});
