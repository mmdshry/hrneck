import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { OrgFinder } from "./org-finder";

const assign = vi.fn();
const toastErrorMock = vi.hoisted(() => vi.fn());
const apiMock = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return {
    ApiError,
    api: (...args: unknown[]) => apiMock(...args),
  };
});

vi.mock("@/lib/toast", () => ({
  toastError: (message: string) => toastErrorMock(message),
}));

function submitOrganization(value: string) {
  fireEvent.change(screen.getByLabelText("organizationAddress"), { target: { value } });
  fireEvent.submit(screen.getByLabelText("organizationAddress").closest("form") as HTMLFormElement);
}

describe("OrgFinder", () => {
  beforeEach(() => {
    vi.stubGlobal("location", { assign, origin: "https://hrneck.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("looks up the organization in an address and opens its own sign-in page", async () => {
    apiMock.mockResolvedValue({
      data: {
        tenant_id: "itneck",
        name: "ITneck",
        login_url: "https://itneck.hrneck.test/login",
      },
    });
    render(<OrgFinder />);

    submitOrganization("https://ITneck.hrneck.test/login?next=/org");

    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://itneck.hrneck.test/login"));
    expect(apiMock).toHaveBeenCalledWith("/api/v1/auth/organizations/itneck");
  });

  it("shows the not-found message for an unknown organization", async () => {
    apiMock.mockRejectedValue(new ApiError(404, "This organization does not exist."));
    render(<OrgFinder />);

    submitOrganization("nobody");

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("orgFinderNotFound"));
    expect(assign).not.toHaveBeenCalled();
  });

  it("shows the generic failure message when the lookup fails otherwise", async () => {
    apiMock.mockRejectedValue(new ApiError(500, "boom"));
    render(<OrgFinder />);

    submitOrganization("itneck");

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("requestFailed"));
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not call the API for input that cannot be an organization", async () => {
    render(<OrgFinder />);

    submitOrganization("my company");

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("orgFinderInvalid"));
    expect(apiMock).not.toHaveBeenCalled();
  });
});
