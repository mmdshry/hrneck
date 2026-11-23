"use client";

import { useTranslations } from "next-intl";
import type { ImportPreviewResult } from "./import-types";

type ImportPreviewStepProps = {
  preview: ImportPreviewResult;
  sendInvites: boolean;
  onSendInvitesChange: (value: boolean) => void;
};

export function ImportPreviewStep({
  preview,
  sendInvites,
  onSendInvitesChange,
}: ImportPreviewStepProps) {
  const t = useTranslations("org.employees");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("wouldCreate")} value={preview.would_create} />
        <Stat label={t("wouldUpdate")} value={preview.would_update} />
        <Stat label={t("wouldSkip")} value={preview.skipped} />
      </div>
      <label className="flex items-start gap-2 text-sm text-[var(--foreground)]">
        <input
          type="checkbox"
          className="mt-1"
          checked={sendInvites}
          onChange={(event) => onSendInvitesChange(event.target.checked)}
        />
        <span>
          {t("sendInvites")}
          <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
            {t("sendInvitesHint")}
          </span>
        </span>
      </label>
      {preview.warning_count > 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          {t("fieldWarnings", { count: preview.warning_count })}
        </p>
      ) : null}
      <ErrorTable errors={preview.errors} emptyLabel={t("noRowErrors")} />
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

export function ErrorTable({
  errors,
  emptyLabel,
}: {
  errors: Array<{ row: number; email: string | null; messages: string[] }>;
  emptyLabel: string;
}) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");
  if (errors.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">{emptyLabel}</p>;
  }

  return (
    <div className="max-h-56 overflow-auto rounded-[var(--radius)] border border-[var(--border)]">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-[var(--muted)]/40">
          <tr>
            <th className="px-2 py-1 font-medium">{t("row")}</th>
            <th className="px-2 py-1 font-medium">{tCommon("email")}</th>
            <th className="px-2 py-1 font-medium">{t("messages")}</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error, index) => (
            <tr key={`${error.row}-${index}`} className="border-t border-[var(--border)]">
              <td className="px-2 py-1 align-top">{error.row}</td>
              <td className="px-2 py-1 align-top">{error.email ?? tCommon("emDash")}</td>
              <td className="px-2 py-1 align-top">{error.messages.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
