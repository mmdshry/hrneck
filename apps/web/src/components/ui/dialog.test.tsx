import { useRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";

afterEach(() => {
  cleanup();
});

describe("Dialog", () => {
  it("renders when open and closes on Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Test dialog" description="Details">
        <p>Body</p>
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Test dialog" })).toBeTruthy();
    expect(screen.getByText("Details")).toBeTruthy();
    expect(screen.getByText("Body")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not render when closed", () => {
    render(
      <Dialog open={false} onOpenChange={() => undefined} title="Hidden">
        <p>Secret</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps input focus when onOpenChange identity changes while open", () => {
    function Harness({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
      return (
        <Dialog open onOpenChange={onOpenChange} title="Add department">
          <input aria-label="Name" />
        </Dialog>
      );
    }

    const { rerender } = render(<Harness onOpenChange={() => undefined} />);
    const input = screen.getByLabelText("Name");
    input.focus();
    expect(document.activeElement).toBe(input);

    // Inline handlers are a new function each render (controlled forms).
    rerender(<Harness onOpenChange={() => undefined} />);
    expect(document.activeElement).toBe(input);
  });

  it("ignores Escape, backdrop clicks and the close button while busy", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open busy onOpenChange={onOpenChange} title="Saving">
        <p>Body</p>
      </Dialog>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog").parentElement as HTMLElement);

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close" }).hasAttribute("disabled")).toBe(true);
  });

  it("uses alertdialog role when requested", () => {
    render(
      <Dialog open role="alertdialog" onOpenChange={() => undefined} title="Delete item">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole("alertdialog", { name: "Delete item" })).toBeTruthy();
  });

  it("focuses the initialFocusRef element on open", () => {
    function Harness() {
      const secondRef = useRef<HTMLInputElement>(null);
      return (
        <Dialog open initialFocusRef={secondRef} onOpenChange={() => undefined} title="Edit">
          <input aria-label="First" />
          <input aria-label="Second" ref={secondRef} />
        </Dialog>
      );
    }

    render(<Harness />);
    expect(document.activeElement).toBe(screen.getByLabelText("Second"));
  });

  it("keeps long bodies inside a scroll container", () => {
    render(
      <Dialog open onOpenChange={() => undefined} title="Long" footer={<button type="button">Done</button>}>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByText("Body").closest(".overflow-y-auto")).toBeTruthy();
  });
});

describe("ConfirmDialog", () => {
  it("calls onConfirm and closes on success", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete item"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("keeps dialog open when onConfirm throws", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("fail"));
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Delete item"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("uses alertdialog role for destructive variants", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Delete item"
        description="This cannot be undone."
        variant="destructive"
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByRole("alertdialog", { name: "Delete item" })).toBeTruthy();
  });

  it("shows the error message when onConfirm rejects", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("Target is in use"));

    render(
      <ConfirmDialog
        open
        onOpenChange={() => undefined}
        title="Delete item"
        description="This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Target is in use");
  });
});
