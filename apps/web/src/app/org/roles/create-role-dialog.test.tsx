import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CreateRoleDialog } from "./create-role-dialog";

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

describe("CreateRoleDialog", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({ data: {} });
  });

  it("creates the role with the chosen permissions", async () => {
    const onCreated = vi.fn(async () => undefined);
    render(
      <CreateRoleDialog
        catalog={["org.users.view", "org.users.manage"]}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Auditors" } });
    fireEvent.click(screen.getByLabelText(/org\.users\.view/));
    fireEvent.click(screen.getByRole("button", { name: "create" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
    const call = apiMock.mock.calls[0];
    expect(call[0]).toBe("/api/v1/org/roles");
    expect(call[1]?.method).toBe("POST");
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      name: "Auditors",
      permissions: ["org.users.view"],
    });
  });
});
