import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecipientPicker, type RecipientOption } from "./recipient-picker";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values
      ? `${key} ${Object.entries(values)
          .map(([name, value]) => `${name}=${String(value)}`)
          .join(" ")}`
      : key,
}));

const options: RecipientOption[] = [
  { id: 1, name: "Ana Admin", email: "ana@itneck.test" },
  { id: 2, name: "Bob Viewer", email: "bob@itneck.test" },
  { id: 3, name: "Former Member", email: "former@itneck.test", unavailable: true },
];

describe("RecipientPicker", () => {
  it("shows the selected count and a chip for each selected person", () => {
    render(<RecipientPicker id="picker" options={options} selectedIds={[1]} onChange={vi.fn()} />);

    expect(screen.getByText("recipientsSelectedCount count=1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "removeRecipient name=Ana Admin" })).toBeTruthy();
  });

  it("adds a person when their checkbox is ticked", () => {
    const onChange = vi.fn();
    render(<RecipientPicker id="picker" options={options} selectedIds={[1]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Bob Viewer/ }));

    expect(onChange).toHaveBeenCalledWith([1, 2]);
  });

  it("removes a person when their checkbox is unticked", () => {
    const onChange = vi.fn();
    render(<RecipientPicker id="picker" options={options} selectedIds={[1, 2]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /Ana Admin/ }));

    expect(onChange).toHaveBeenCalledWith([2]);
  });

  it("filters people by name or email", () => {
    render(<RecipientPicker id="picker" options={options} selectedIds={[]} onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bob@" } });

    expect(screen.queryByRole("checkbox", { name: /Ana Admin/ })).toBeNull();
    expect(screen.getByRole("checkbox", { name: /Bob Viewer/ })).toBeTruthy();
  });

  it("shows an empty message when nobody matches the search", () => {
    render(<RecipientPicker id="picker" options={options} selectedIds={[]} onChange={vi.fn()} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });

    expect(screen.getByText("recipientsNoMatch")).toBeTruthy();
  });

  it("flags people who no longer have report access", () => {
    render(<RecipientPicker id="picker" options={options} selectedIds={[3]} onChange={vi.fn()} />);

    expect(screen.getByText("recipientUnavailable")).toBeTruthy();
  });

  it("selects every visible person with select all", () => {
    const onChange = vi.fn();
    render(<RecipientPicker id="picker" options={options} selectedIds={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "selectAll" }));

    expect(onChange).toHaveBeenCalledWith([1, 2, 3]);
  });

  it("does not submit the surrounding form when Enter is pressed in the search box", () => {
    render(<RecipientPicker id="picker" options={options} selectedIds={[]} onChange={vi.fn()} />);

    const dispatchedAndNotCancelled = fireEvent.keyDown(screen.getByRole("searchbox"), {
      key: "Enter",
    });

    expect(dispatchedAndNotCancelled).toBe(false);
  });
});
