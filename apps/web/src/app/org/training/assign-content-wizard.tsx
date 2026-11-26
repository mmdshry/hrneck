"use client";

import { useTranslations } from "next-intl";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog } from "@/components/ui/wizard-dialog";
import type { AudienceGroup, AudienceTarget } from "./audience-picker";
import type { AssignDraft } from "./training-assign-draft";
import { useAssignWizard, type AssignCourse } from "./training-assign-steps";

type AssignContentWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: AssignCourse[];
  targets: AudienceTarget[];
  groups: AudienceGroup[];
  busy: boolean;
  /** Resolves true when the assignment was created, which closes the wizard. */
  onAssign: (draft: AssignDraft) => Promise<boolean>;
};

export function AssignContentWizard({
  open,
  onOpenChange,
  courses,
  targets,
  groups,
  busy,
  onAssign,
}: AssignContentWizardProps) {
  const t = useTranslations("org.training");
  const wizard = useAssignWizard({ courses, targets, groups });
  const labels = useWizardLabels({ submit: t("assignNow") });

  function handleOpenChange(next: boolean) {
    if (!next) {
      wizard.reset();
    }
    onOpenChange(next);
  }

  return (
    <WizardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("assignContent")}
      steps={wizard.steps}
      labels={labels}
      size="xl"
      busy={busy}
      isDirty={wizard.isDirty}
      onSubmit={async () => {
        if (await onAssign(wizard.draft)) {
          handleOpenChange(false);
        }
      }}
    />
  );
}
