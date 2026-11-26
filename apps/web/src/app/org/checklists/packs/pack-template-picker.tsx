"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ChecklistTemplate } from "../checklist-types";
import { moveTemplateId, toggleTemplateId } from "../pack-template-order";

type PackTemplatePickerProps = {
  templates: ChecklistTemplate[];
  selectedTemplateIds: number[];
  onChange: (ids: number[]) => void;
};

export function PackTemplatePicker({
  templates,
  selectedTemplateIds,
  onChange,
}: PackTemplatePickerProps) {
  const t = useTranslations("org.checklists");

  return (
    <div className="space-y-2 rounded-md border border-[var(--border)] p-3">
      {templates.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">{t("copySystemFirst")}</p>
      ) : (
        templates.map((template) => {
          const selected = selectedTemplateIds.includes(template.id);
          const order = selectedTemplateIds.indexOf(template.id);
          return (
            <div
              key={template.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onChange(toggleTemplateId(selectedTemplateIds, template.id))}
                />
                <span>
                  {template.name}
                  {selected ? ` · #${order + 1}` : ""}
                </span>
              </label>
              {selected ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onChange(moveTemplateId(selectedTemplateIds, template.id, -1))
                    }
                  >
                    {t("moveUp")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onChange(moveTemplateId(selectedTemplateIds, template.id, 1))}
                  >
                    {t("moveDown")}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
