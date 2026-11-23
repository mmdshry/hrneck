"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  FIELD_LABELS,
  PLATFORM_FIELDS,
  type ColumnMap,
  type ImportMappingTemplate,
  type ImportSession,
  type PlatformField,
} from "./import-types";

type ImportMappingStepProps = {
  session: ImportSession;
  columnMap: ColumnMap;
  onColumnMapChange: (next: ColumnMap) => void;
  templates: ImportMappingTemplate[];
  selectedTemplateId: string;
  onSelectTemplate: (id: string) => void;
  templateName: string;
  onTemplateNameChange: (name: string) => void;
  onSaveTemplate: () => void;
  onDeleteTemplate: () => void;
  busy: boolean;
};

export function ImportMappingStep({
  session,
  columnMap,
  onColumnMapChange,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  templateName,
  onTemplateNameChange,
  onSaveTemplate,
  onDeleteTemplate,
  busy,
}: ImportMappingStepProps) {
  const t = useTranslations("org.employees");
  const tCommon = useTranslations("common");

  function setField(field: PlatformField, value: string) {
    onColumnMapChange({
      ...columnMap,
      [field]: value === "" ? null : value,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm">
        <p>
          {t("fileMeta", {
            name: session.original_filename,
            rows: session.row_count,
            cols: session.headers.length,
          })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="import-template-select">{t("savedMappingTemplate")}</Label>
          <Select
            id="import-template-select"
            value={selectedTemplateId}
            disabled={busy}
            onChange={(event) => onSelectTemplate(event.target.value)}
          >
            <option value="">{t("suggestedMapping")}</option>
            {templates.map((template) => (
              <option key={template.id} value={String(template.id)}>
                {template.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="import-template-name">{t("templateName")}</Label>
          <Input
            id="import-template-name"
            value={templateName}
            disabled={busy}
            placeholder="e.g. BambooHR export"
            onChange={(event) => onTemplateNameChange(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onSaveTemplate}>
            {t("saveTemplate")}
          </Button>
          {selectedTemplateId ? (
            <Button type="button" variant="outline" disabled={busy} onClick={onDeleteTemplate}>
              {tCommon("delete")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {PLATFORM_FIELDS.map((field) => (
          <div
            key={field}
            className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[160px_1fr]"
          >
            <Label htmlFor={`map-${field}`} className="text-sm">
              {FIELD_LABELS[field]}
              {field === "email" ? " *" : ""}
            </Label>
            <Select
              id={`map-${field}`}
              value={columnMap[field] ?? ""}
              disabled={busy}
              onChange={(event) => setField(field, event.target.value)}
            >
              <option value="">{field === "email" ? t("selectColumn") : t("skip")}</option>
              {session.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>

      {session.sample_rows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">{t("sampleRows")}</p>
          <div className="max-h-40 overflow-auto rounded-[var(--radius)] border border-[var(--border)]">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[var(--muted)]/40">
                <tr>
                  {session.headers.map((header) => (
                    <th key={header} className="whitespace-nowrap px-2 py-1 font-medium">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {session.sample_rows.map((row, index) => (
                  <tr key={index} className="border-t border-[var(--border)]">
                    {session.headers.map((header) => (
                      <td key={header} className="whitespace-nowrap px-2 py-1">
                        {row[header] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
