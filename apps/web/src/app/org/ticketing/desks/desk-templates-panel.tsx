"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import type { DeskDialog, TemplateMessage, TemplateNote } from "./desk-types";

type DeskTemplatesPanelProps = {
  deskName: string;
  messages: TemplateMessage[];
  notes: TemplateNote[];
  onOpenDialog: (dialog: DeskDialog) => void;
  onDeleteMessage: (template: TemplateMessage) => void;
  onDeleteNote: (template: TemplateNote) => void;
};

export function DeskTemplatesPanel({
  deskName,
  messages,
  notes,
  onOpenDialog,
  onDeleteMessage,
  onDeleteNote,
}: DeskTemplatesPanelProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");

  const messageColumns: Array<DataTableColumn<TemplateMessage>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (row) => row.name,
    },
    {
      id: "subject",
      header: tCommon("subject"),
      accessorKey: "subject",
      cell: (row) => row.subject || tCommon("emDash"),
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <Button type="button" variant="outline" size="compact" onClick={() => onDeleteMessage(row)}>
          {tCommon("delete")}
        </Button>
      ),
    },
  ];

  const noteColumns: Array<DataTableColumn<TemplateNote>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (row) => row.name,
    },
    {
      id: "body",
      header: tCommon("body"),
      accessorKey: "body",
      className: "max-w-md whitespace-pre-wrap",
      cell: (row) => row.body,
    },
    {
      id: "actions",
      header: tCommon("actions"),
      filter: "none",
      enableSorting: false,
      enableGlobalFilter: false,
      cell: (row) => (
        <Button type="button" variant="outline" size="compact" onClick={() => onDeleteNote(row)}>
          {tCommon("delete")}
        </Button>
      ),
    },
  ];

  return (
    <Panel title={t("templatesFor", { name: deskName })}>
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{t("messageTemplates")}</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenDialog({ kind: "messageTemplate" })}
            >
              {t("addMessageTemplate")}
            </Button>
          </div>
          <DataTable
            mode="client"
            caption={t("messageTemplates")}
            columns={messageColumns}
            rows={messages}
            getRowId={(row) => row.id}
            emptyTitle={t("noMessageTemplates")}
          />
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{t("noteTemplates")}</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenDialog({ kind: "noteTemplate" })}
            >
              {t("addNoteTemplate")}
            </Button>
          </div>
          <DataTable
            mode="client"
            caption={t("noteTemplates")}
            columns={noteColumns}
            rows={notes}
            getRowId={(row) => row.id}
            emptyTitle={t("noNoteTemplates")}
          />
        </div>
      </div>
    </Panel>
  );
}
