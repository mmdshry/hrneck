"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWizardLabels } from "@/components/ui/use-wizard-labels";
import { WizardDialog } from "@/components/ui/wizard-dialog";
import type { AudienceGroup, AudienceTarget } from "../audience-picker";
import type { AssignDraft } from "../training-assign-draft";
import { useAssignWizard, type AssignCourse } from "../training-assign-steps";

type LaunchCampaignWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: AssignCourse[];
  targets: AudienceTarget[];
  groups: AudienceGroup[];
  /** Resolves true when the campaign was created, which closes the wizard. */
  onLaunch: (name: string, draft: AssignDraft) => Promise<boolean>;
};

export function LaunchCampaignWizard({
  open,
  onOpenChange,
  courses,
  targets,
  groups,
  onLaunch,
}: LaunchCampaignWizardProps) {
  const t = useTranslations("org.campaigns");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const wizard = useAssignWizard({
    courses,
    targets,
    groups,
    reviewFields: (
      <div className="space-y-1">
        <Label htmlFor="training-campaign-name" className="text-[var(--muted-foreground)]">
          {tCommon("name")}
        </Label>
        <Input
          id="training-campaign-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("namePlaceholder")}
        />
        <p className="text-xs text-[var(--muted-foreground)]">{t("nameDefaultHint")}</p>
      </div>
    ),
  });
  const labels = useWizardLabels({ submit: t("launchCampaign") });

  function handleOpenChange(next: boolean) {
    if (!next) {
      wizard.reset();
      setName("");
    }
    onOpenChange(next);
  }

  return (
    <WizardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("createCampaign")}
      steps={wizard.steps}
      labels={labels}
      size="xl"
      isDirty={wizard.isDirty || name !== ""}
      onSubmit={async () => {
        if (await onLaunch(name, wizard.draft)) {
          handleOpenChange(false);
        }
      }}
    />
  );
}
