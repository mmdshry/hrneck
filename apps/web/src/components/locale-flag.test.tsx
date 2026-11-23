import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { LocaleFlag } from "./locale-flag";

describe("LocaleFlag", () => {
  it("renders an svg for every supported locale", () => {
    for (const locale of locales) {
      const { container, unmount } = render(<LocaleFlag locale={locale} />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.textContent ?? "").not.toMatch(/^[A-Z]{2}$/);
      unmount();
    }
  });
});
