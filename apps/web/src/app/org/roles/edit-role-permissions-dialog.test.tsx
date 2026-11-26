import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { EditRolePermissionsDialog } from "./edit-role-permissions-dialog";
import type { OrgRole } from "./role-types";

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
const catalog = ["org.users.view", "org.users.manage"];
const auditor: OrgRole = { id: 4, name: "auditor", permissions: ["org.users.view"] };

afterEach(() => {
  cleanup();
});

describe("EditRolePermissionsDialog", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({ data: {} });
  });

  it("saves the edited permission set and reports the role", async () => {
    const onSaved = vi.fn(async () => undefined);
    render(
      <EditRolePermissionsDialog
        role={auditor}
        catalog={catalog}
        readOnly={false}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByLabelText(/org\.users\.manage/));
    fireEvent.click(screen.getByRole("button", { name: "savePermissions" }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(4, ["org.users.view", "org.users.manage"]);
    });
    const call = apiMock.mock.calls[0];
    expect(call[0]).toBe("/api/v1/org/roles/4");
    expect(call[1]?.method).toBe("PUT");
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      permissions: ["org.users.view", "org.users.manage"],
    });
  });

  it("shows a built-in role read-only with no save action", () => {
    render(
      <EditRolePermissionsDialog
        role={{ ...auditor, name: "org_admin" }}
        catalog={catalog}
        readOnly
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByText("builtInManaged")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "savePermissions" })).toBeNull();
    expect((screen.getByLabelText(/org\.users\.view/) as HTMLInputElement).disabled).toBe(true);
    expect(apiMock).not.toHaveBeenCalled();
  });
});
