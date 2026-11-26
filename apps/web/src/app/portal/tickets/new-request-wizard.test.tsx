import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { NewRequestWizard } from "./new-request-wizard";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  ensureCsrf: vi.fn(async () => undefined),
}));

vi.mock("@/lib/toast", () => ({
  toastError: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  resolveTenant: () => "acme",
}));

const apiMock = vi.mocked(api);
const desks = [
  { id: 3, name: "IT", type: "it" },
  { id: 4, name: "HR", type: "hr" },
];

function currentStepText(): string | null | undefined {
  return document.querySelector('[aria-current="step"]')?.textContent;
}

afterEach(() => {
  cleanup();
});

describe("NewRequestWizard", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("walks desk, details and review, then submits the request", async () => {
    apiMock.mockResolvedValue({ data: { id: 77 } });
    render(<NewRequestWizard desks={desks} onClose={vi.fn()} />);

    expect((screen.getByLabelText("desk") as HTMLSelectElement).value).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "next" }));

    await screen.findByLabelText("summary");
    fireEvent.change(screen.getByLabelText("summary"), { target: { value: "VPN broken" } });
    fireEvent.change(screen.getByLabelText("details"), { target: { value: "Since Monday" } });
    fireEvent.click(screen.getByRole("button", { name: "next" }));

    await waitFor(() => {
      expect(currentStepText()).toContain("reviewRequest");
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledTimes(1);
    });
    const call = apiMock.mock.calls[0];
    expect(call[0]).toBe("/api/v1/org/portal/ticketing/tickets");
    expect(call[1]?.method).toBe("POST");
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      desk_id: 3,
      summary: "VPN broken",
      description: "Since Monday",
    });
  });

  it("does not leave the details step without a summary", async () => {
    render(<NewRequestWizard desks={desks} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "next" }));
    await screen.findByLabelText("summary");
    fireEvent.click(screen.getByRole("button", { name: "next" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(currentStepText()).toContain("details");
    expect(apiMock).not.toHaveBeenCalled();
  });
});
