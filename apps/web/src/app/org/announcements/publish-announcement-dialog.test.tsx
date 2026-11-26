import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { PublishAnnouncementDialog } from "./publish-announcement-dialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  ensureCsrf: vi.fn(async () => undefined),
}));

vi.mock("@/lib/toast", () => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  resolveTenant: () => "acme",
}));

const apiMock = vi.mocked(api);

afterEach(() => {
  cleanup();
});

describe("PublishAnnouncementDialog", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("publishes the announcement and hands the created row back", async () => {
    const created = { id: 9, title: "Office closed", body: "Friday", published_at: null };
    apiMock.mockResolvedValue({ data: created });
    const onPublished = vi.fn(async () => undefined);
    render(<PublishAnnouncementDialog onClose={vi.fn()} onPublished={onPublished} />);

    fireEvent.change(screen.getByLabelText("titleLabel"), { target: { value: "Office closed" } });
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "Friday" } });
    fireEvent.click(screen.getByRole("button", { name: "publish" }));

    await waitFor(() => {
      expect(onPublished).toHaveBeenCalledWith(created);
    });
    const call = apiMock.mock.calls[0];
    expect(call[0]).toBe("/api/v1/org/announcements");
    expect(call[1]?.method).toBe("POST");
    expect(JSON.parse(String(call[1]?.body))).toEqual({ title: "Office closed", body: "Friday" });
  });

  it("keeps the title and body length limits", () => {
    render(<PublishAnnouncementDialog onClose={vi.fn()} onPublished={vi.fn()} />);

    expect(screen.getByLabelText("titleLabel").getAttribute("maxlength")).toBe("190");
    expect(screen.getByLabelText("message").getAttribute("maxlength")).toBe("5000");
  });
});
