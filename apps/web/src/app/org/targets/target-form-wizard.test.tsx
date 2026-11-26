import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { TargetFormWizard } from "./target-form-wizard";
import type { Target } from "./target-types";

vi.mock("next-intl", () => {
  const translate = (key: string) => key;
  return { useTranslations: () => translate };
});

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

function requestFor(path: string, method: string) {
  const call = apiMock.mock.calls.find(
    ([callPath, init]) => callPath === path && init?.method === method,
  );
  return JSON.parse(String(call?.[1]?.body));
}

async function clickButton(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

describe("TargetFormWizard", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path) => {
      if (path.startsWith("/api/v1/org/departments")) return { data: [] };
      if (path.startsWith("/api/v1/org/targets?")) return { data: [] };
      if (path === "/api/v1/org/targets") {
        return { data: { id: 7, email: "ana@example.test" }, meta: {} };
      }
      return { data: { id: 3, email: "bo@example.test", status: "inactive" } };
    });
  });

  it("keeps the identity step open while the email is empty", async () => {
    render(<TargetFormWizard target={null} onClose={vi.fn()} onSaved={vi.fn()} />);

    await clickButton("next");

    expect(screen.getByLabelText("email")).toBeTruthy();
    expect(screen.queryByText("stepEmploymentHint")).toBeNull();
  });

  it("creates the employee with the sign-in password and role", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(
      <TargetFormWizard
        target={null}
        roleOptions={[{ id: 1, name: "learner" }]}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText("email"), { target: { value: "ana@example.test" } });
    fireEvent.change(screen.getByLabelText("loginPassword"), { target: { value: "secret123" } });
    await clickButton("next");
    await screen.findByText("stepEmploymentHint");
    await clickButton("next");
    await screen.findByText("stepContactHint");
    await clickButton("addEmployee");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(requestFor("/api/v1/org/targets", "POST")).toMatchObject({
      email: "ana@example.test",
      password: "secret123",
      roles: ["learner"],
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });

  it("edits an existing employee without create-only fields", async () => {
    const target: Target = { id: 3, email: "bo@example.test", status: "inactive" };
    const onSaved = vi.fn();
    render(<TargetFormWizard target={target} onClose={vi.fn()} onSaved={onSaved} />);

    expect(screen.queryByLabelText("loginPassword")).toBeNull();
    await clickButton("next");
    await screen.findByText("stepEmploymentHint");
    await clickButton("next");
    await screen.findByText("stepContactHint");
    await clickButton("saveChanges");

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const body = requestFor("/api/v1/org/targets/3", "PATCH");
    expect(body).toMatchObject({ email: "bo@example.test", status: "inactive" });
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("roles");
  });
});
