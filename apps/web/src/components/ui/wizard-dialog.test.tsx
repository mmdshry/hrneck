import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WizardDialog, type WizardLabels, type WizardStep } from "@/components/ui/wizard-dialog";

const labels: WizardLabels = {
  close: "Close",
  cancel: "Cancel",
  back: "Back",
  next: "Next",
  submit: "Save",
  progress: "Progress",
  stepCounter: (current, total) => `Step ${current} of ${total}`,
  discardMessage: "Discard unsaved changes?",
  keepEditing: "Keep editing",
  discard: "Discard",
};

afterEach(() => {
  cleanup();
});

function makeSteps(validateFirst?: () => boolean): WizardStep[] {
  return [
    {
      id: "identity",
      title: "Identity",
      validate: validateFirst,
      render: () => <input aria-label="Name" />,
    },
    {
      id: "groups",
      title: "Groups",
      render: () => <p>Groups body</p>,
    },
  ];
}

describe("WizardDialog", () => {
  it("renders the first step and marks it as current", () => {
    render(
      <WizardDialog
        open
        onOpenChange={() => undefined}
        title="New employee"
        steps={makeSteps()}
        onSubmit={vi.fn()}
        labels={labels}
      />,
    );

    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    const current = document.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain("Identity");
  });

  it("advances when the step validates", async () => {
    render(
      <WizardDialog
        open
        onOpenChange={() => undefined}
        title="New employee"
        steps={makeSteps(() => true)}
        onSubmit={vi.fn()}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("Groups body")).toBeTruthy();
    });
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
  });

  it("stays on the step when validation fails", async () => {
    const validate = vi.fn(() => false);
    render(
      <WizardDialog
        open
        onOpenChange={() => undefined}
        title="New employee"
        steps={makeSteps(validate)}
        onSubmit={vi.fn()}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(validate).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Groups body")).toBeNull();
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  it("goes back to the previous step", async () => {
    render(
      <WizardDialog
        open
        onOpenChange={() => undefined}
        title="New employee"
        steps={makeSteps()}
        onSubmit={vi.fn()}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByText("Groups body")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  it("calls onSubmit once on the last step", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <WizardDialog
        open
        onOpenChange={() => undefined}
        title="New employee"
        steps={makeSteps()}
        onSubmit={onSubmit}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      expect(screen.getByText("Groups body")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("closes immediately when there are no unsaved changes", () => {
    const onOpenChange = vi.fn();
    render(
      <WizardDialog
        open
        onOpenChange={onOpenChange}
        title="New employee"
        steps={makeSteps()}
        onSubmit={vi.fn()}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks before discarding unsaved changes", () => {
    const onOpenChange = vi.fn();
    render(
      <WizardDialog
        open
        isDirty
        onOpenChange={onOpenChange}
        title="New employee"
        steps={makeSteps()}
        onSubmit={vi.fn()}
        labels={labels}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Discard unsaved changes?");

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
