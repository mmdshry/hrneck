"use client";

import { useTranslations } from "next-intl";
import { ErrorTable } from "./import-preview-step";
import type { ImportCommitResult } from "./import-types";

type ImportResultStepProps = {
  result: ImportCommitResult;
};

export function ImportResultStep({ result }: ImportResultStepProps) {
  const t = useTranslations("org.employees");
  const autoCount = result.meta?.auto_assigned_instance_count ?? 0;
  const invited = result.meta?.login_invited ?? 0;
  const managerSkipped = result.meta?.manager_skipped ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("created")} value={result.created} />
        <Stat label={t("updated")} value={result.updated} />
        <Stat label={t("skipped")} value={result.skipped} />
      </div>
      <ul className="space-y-1 text-sm text-[var(--muted-foreground)]">
        <li>{t("importedEmployees", { count: result.imported })}</li>
        {autoCount > 0 ? <li>{t("autoAssigned", { count: autoCount })}</li> : null}
        {invited > 0 ? <li>{t("queuedInvites", { count: invited })}</li> : null}
        {managerSkipped > 0 ? (
          <li>{t("managerLinksSkipped", { count: managerSkipped })}</li>
        ) : null}
      </ul>
      <ErrorTable errors={result.errors} emptyLabel={t("importFinishedClean")} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] px-3 py-2">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="text-lg font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}
