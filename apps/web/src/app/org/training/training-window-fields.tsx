"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TrainingWindowFieldsProps = {
  idPrefix: string;
  startsAt: string;
  expiresAt: string;
  onChangeStartsAt: (value: string) => void;
  onChangeExpiresAt: (value: string) => void;
};

export function TrainingWindowFields({
  idPrefix,
  startsAt,
  expiresAt,
  onChangeStartsAt,
  onChangeExpiresAt,
}: TrainingWindowFieldsProps) {
  const t = useTranslations("org.training");
  return (
    <div className="space-y-1">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-starts-at`} className="text-[var(--muted-foreground)]">
            {t("startsAt")}
          </Label>
          <Input
            id={`${idPrefix}-starts-at`}
            type="datetime-local"
            value={startsAt}
            onChange={(e) => onChangeStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-expires-at`} className="text-[var(--muted-foreground)]">
            {t("expiresAt")}
          </Label>
          <Input
            id={`${idPrefix}-expires-at`}
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => onChangeExpiresAt(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{t("windowHint")}</p>
    </div>
  );
}
