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
});
