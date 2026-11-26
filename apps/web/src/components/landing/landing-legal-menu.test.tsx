import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingLegalMenu } from "./landing-legal-menu";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

describe("LandingLegalMenu", () => {
  it("starts closed with no legal links in the DOM", () => {
    render(<LandingLegalMenu />);
    const trigger = screen.getByRole("button", { name: "legalLabel" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "privacyPolicy" })).toBeNull();
    expect(screen.queryByRole("link", { name: "termsOfService" })).toBeNull();
  });

  it("opens on click and links to /privacy and /terms", () => {
    render(<LandingLegalMenu />);
    const trigger = screen.getByRole("button", { name: "legalLabel" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("link", { name: "privacyPolicy" }).getAttribute("href"),
    ).toBe("/privacy");
    expect(
      screen.getByRole("link", { name: "termsOfService" }).getAttribute("href"),
    ).toBe("/terms");
  });

  it("toggles closed when the trigger is clicked again", () => {
    render(<LandingLegalMenu />);
    const trigger = screen.getByRole("button", { name: "legalLabel" });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "privacyPolicy" })).toBeNull();
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(<LandingLegalMenu />);
    const trigger = screen.getByRole("button", { name: "legalLabel" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on outside pointer-down", () => {
    render(
      <div>
        <p>outside</p>
        <LandingLegalMenu />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "legalLabel" });
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("stays open for pointer-down inside the menu", () => {
    render(<LandingLegalMenu />);
    const trigger = screen.getByRole("button", { name: "legalLabel" });
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole("link", { name: "privacyPolicy" }));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes when a legal link is chosen", () => {
    render(<LandingLegalMenu />);
    const trigger = screen.getByRole("button", { name: "legalLabel" });
    fireEvent.click(trigger);
    const termsLink = screen.getByRole("link", { name: "termsOfService" });
    // jsdom cannot navigate; cancel the default so the test stays quiet.
    termsLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(termsLink);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
