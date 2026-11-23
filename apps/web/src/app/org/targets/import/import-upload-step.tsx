"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ImportUploadStepProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  busy: boolean;
};

export function ImportUploadStep({ file, onFileChange, busy }: ImportUploadStepProps) {
  const t = useTranslations("org.employees");
  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted-foreground)]">{t("importUploadHint")}</p>
      <div className="space-y-1">
        <Label htmlFor="employee-import-csv">{t("csvFile")}</Label>
        <Input
          id="employee-import-csv"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
      </div>
      {file ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {t("selectedFile", {
            name: file.name,
            size: Math.max(1, Math.round(file.size / 1024)),
          })}
        </p>
      ) : null}
    </div>
  );
}
