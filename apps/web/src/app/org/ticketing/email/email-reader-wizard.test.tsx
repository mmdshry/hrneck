import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { SdDesk } from "../ticketing-types";
import type { Reader } from "./email-reader-logic";
import { EmailReaderWizard } from "./email-reader-wizard";

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

const desks: SdDesk[] = [
  { id: 1, name: "Service", slug: "service", type: "service", is_active: true },
  { id: 2, name: "Incident", slug: "incident", type: "incident", is_active: true },
];

const reader: Reader = {
  id: 4,
  name: "Support inbox",
  desk_id: 2,
  host: "mail.example.test",
  port: 143,
  username: "support",
  is_active: false,
};

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

describe("EmailReaderWizard", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async () => ({ data: { id: 9, number: "1" } }));
  });

  it("keeps the connection step open while the name is empty", async () => {
    render(<EmailReaderWizard reader={null} desks={desks} onClose={vi.fn()} onSaved={vi.fn()} />);

    await clickButton("next");

    expect(screen.getByLabelText("name")).toBeTruthy();
    expect(screen.queryByLabelText("desk")).toBeNull();
  });

  it("creates a reader with the password and the preselected incident desk", async () => {
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<EmailReaderWizard reader={null} desks={desks} onClose={onClose} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Support" } });
    fireEvent.change(screen.getByLabelText("username"), {
      target: { value: "support@example.test" },
    });
    fireEvent.change(screen.getByLabelText("password"), { target: { value: "secret" } });
    await clickButton("next");
    await screen.findByLabelText("desk");
    await clickButton("next");
    await screen.findByText("readerPasswordReplaced");
    await clickButton("saveReader");

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledWith("create");
    expect(requestFor("/api/v1/org/ticketing/email-readers", "POST")).toEqual({
      name: "Support",
      desk_id: 2,
      host: "127.0.0.1",
      port: 993,
      username: "support@example.test",
      encryption: "ssl",
      is_active: true,
      password: "secret",
    });
  });

  it("edits a reader without pre-filling or sending a blank password", async () => {
    const onSaved = vi.fn();
    render(<EmailReaderWizard reader={reader} desks={desks} onClose={vi.fn()} onSaved={onSaved} />);

    expect((screen.getByLabelText("passwordKeepHint") as HTMLInputElement).value).toBe("");
    await clickButton("next");
    await screen.findByLabelText("active");
    await clickButton("next");
    await screen.findByText("readerPasswordKept");
    await clickButton("saveChanges");

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("update"));
    expect(requestFor("/api/v1/org/ticketing/email-readers/4", "PATCH")).toEqual({
      name: "Support inbox",
      desk_id: 2,
      host: "mail.example.test",
      port: 143,
      username: "support",
      encryption: "ssl",
      is_active: false,
    });
  });
});
