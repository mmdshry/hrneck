"use client";

import { useTranslations } from "next-intl";
import type { WizardLabels } from "@/components/ui/wizard-dialog";

/**
 * Translated labels for `WizardDialog`. Pass overrides for flow-specific wording,
 * e.g. `submit: t("launch")` on the last step.
 */
export function useWizardLabels(overrides?: Partial<WizardLabels>): WizardLabels {
  const t = useTranslations("common");
  return {
    close: t("close"),
    cancel: t("cancel"),
    back: t("back"),
    next: t("next"),
    submit: t("save"),
    progress: t("wizardProgress"),
    stepCounter: (current, total) => t("wizardStepCounter", { current, total }),
    discardMessage: t("wizardDiscardMessage"),
    keepEditing: t("wizardKeepEditing"),
    discard: t("wizardDiscard"),
    ...overrides,
  };
}
