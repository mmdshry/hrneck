"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Panel } from "@/components/ui/panel";
import type { SdDesk } from "../ticketing-types";
import {
  type DeskDialog,
  type DeskProcedure,
  type DeskSla,
  type DeskStage,
  type DeskSupportRow,
  type SupportTable,
} from "./desk-types";

type DeskDetailPanelProps = {
  desk: SdDesk;
  canAdmin: boolean;
  onEditDesk: () => void;
  onOpenDialog: (dialog: DeskDialog) => void;
};

function editColumn<T>(
  header: string,
  label: string,
  onEdit: (row: T) => void,
): DataTableColumn<T> {
  return {
    id: "actions",
    header,
    filter: "none",
    enableSorting: false,
    enableGlobalFilter: false,
    cell: (row) => (
      <Button type="button" variant="outline" size="compact" onClick={() => onEdit(row)}>
        {label}
      </Button>
    ),
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--muted-foreground)]">{label}</dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  );
}

/** Read-only details for the selected desk, with buttons to add or edit its stages, support rows, procedures and SLA policies. */
export function DeskDetailPanel({ desk, canAdmin, onEditDesk, onOpenDialog }: DeskDetailPanelProps) {
  const t = useTranslations("org.ticketing");
  const tCommon = useTranslations("common");
  const actionHeader = tCommon("actions");
  const editLabel = tCommon("edit");

  const stageColumns: Array<DataTableColumn<DeskStage>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (stage) => stage.name,
    },
    {
      id: "sequence",
      header: tCommon("sequence"),
      accessorKey: "sequence",
      cell: (stage) => stage.sequence,
    },
    {
      id: "escalation",
      header: t("escalation"),
      filterValue: (stage) => stage.default_escalation_minutes ?? "",
      cell: (stage) =>
        stage.default_escalation_minutes != null
          ? `${stage.default_escalation_minutes}m`
          : tCommon("emDash"),
    },
    {
      id: "terminal",
      header: tCommon("terminal"),
      filter: "select",
      filterOptions: [
        { label: tCommon("terminal"), value: "yes" },
        { label: tCommon("open"), value: "no" },
      ],
      filterValue: (stage) => (stage.is_terminal ? "yes" : "no"),
      cell: (stage) => (stage.is_terminal ? tCommon("terminal") : tCommon("emDash")),
    },
  ];

  const supportColumns: Array<DataTableColumn<DeskSupportRow>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (row) => row.name,
    },
    {
      id: "slug",
      header: tCommon("slug"),
      accessorKey: "slug",
      cell: (row) => row.slug,
    },
  ];

  const procedureColumns: Array<DataTableColumn<DeskProcedure>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (procedure) => procedure.name,
    },
    {
      id: "hook",
      header: t("hook"),
      accessorKey: "hook",
      cell: (procedure) => procedure.hook,
    },
    {
      id: "active",
      header: tCommon("active"),
      filter: "select",
      filterOptions: [
        { label: tCommon("active"), value: "active" },
        { label: tCommon("inactive"), value: "inactive" },
      ],
      filterValue: (procedure) => (procedure.is_active ? "active" : "inactive"),
      cell: (procedure) => (procedure.is_active ? tCommon("active") : tCommon("inactive")),
    },
  ];

  const slaColumns: Array<DataTableColumn<DeskSla>> = [
    {
      id: "name",
      header: tCommon("name"),
      accessorKey: "name",
      sticky: true,
      cell: (policy) => policy.name,
    },
    {
      id: "default",
      header: tCommon("default"),
      filter: "select",
      filterOptions: [
        { label: tCommon("default"), value: "yes" },
        { label: tCommon("no"), value: "no" },
      ],
      filterValue: (policy) => (policy.is_default ? "yes" : "no"),
      cell: (policy) => (policy.is_default ? tCommon("default") : tCommon("emDash")),
    },
  ];

  const stageTableColumns = canAdmin
    ? [
        ...stageColumns,
        editColumn(actionHeader, editLabel, (stage: DeskStage) =>
          onOpenDialog({ kind: "stage", stage }),
        ),
      ]
    : stageColumns;
  const procedureTableColumns = canAdmin
    ? [
        ...procedureColumns,
        editColumn(actionHeader, editLabel, (procedure: DeskProcedure) =>
          onOpenDialog({ kind: "procedure", procedure }),
        ),
      ]
    : procedureColumns;
  const slaTableColumns = canAdmin
    ? [
        ...slaColumns,
        editColumn(actionHeader, editLabel, (policy: DeskSla) =>
          onOpenDialog({ kind: "sla", policy }),
        ),
      ]
    : slaColumns;

  const supportSections: Array<{
    table: SupportTable;
    title: string;
    empty: string;
    rows: DeskSupportRow[];
  }> = [
    { table: "statuses", title: t("statuses"), empty: t("noStatuses"), rows: desk.statuses ?? [] },
    {
      table: "priorities",
      title: t("priorities"),
      empty: t("noPriorities"),
      rows: desk.priorities ?? [],
    },
    {
      table: "severities",
      title: t("severities"),
      empty: t("noSeverities"),
      rows: desk.severities ?? [],
    },
    {
      table: "categories",
      title: t("categories"),
      empty: t("noCategories"),
      rows: desk.categories ?? [],
    },
  ];

  return (
    <Panel
      title={desk.name}
      actions={
        canAdmin ? (
          <Button type="button" variant="outline" size="sm" onClick={onEditDesk}>
            {t("editDesk")}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-6 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={tCommon("type")}>{desk.type}</Field>
          <Field label={tCommon("slug")}>{desk.slug}</Field>
          <Field label={t("numberPrefix")}>{desk.number_prefix || tCommon("emDash")}</Field>
          <Field label={tCommon("active")}>
            {desk.is_active ? tCommon("yes") : tCommon("no")}
          </Field>
        </dl>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{t("stages")}</div>
            {canAdmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenDialog({ kind: "stage", stage: null })}
              >
                {t("addStage")}
              </Button>
            ) : null}
          </div>
          <DataTable
            mode="client"
            caption={t("deskStages")}
            columns={stageTableColumns}
            rows={desk.stages ?? []}
            getRowId={(row) => row.id}
            emptyTitle={t("noStages")}
          />
        </div>

        {supportSections.map((section) => (
          <div key={section.table}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{section.title}</div>
              {canAdmin ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenDialog({ kind: "support", table: section.table })}
                >
                  {t("addSupportRow")}
                </Button>
              ) : null}
            </div>
            <DataTable
              mode="client"
              caption={section.title}
              columns={supportColumns}
              rows={section.rows}
              getRowId={(row) => row.id}
              emptyTitle={section.empty}
            />
          </div>
        ))}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{t("procedures")}</div>
            {canAdmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenDialog({ kind: "procedure", procedure: null })}
              >
                {t("addProcedure")}
              </Button>
            ) : null}
          </div>
          <DataTable
            mode="client"
            caption={t("deskProcedures")}
            columns={procedureTableColumns}
            rows={desk.procedures ?? []}
            getRowId={(row) => row.id}
            emptyTitle={t("noProcedures")}
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{t("slaPolicies")}</div>
            {canAdmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenDialog({ kind: "sla", policy: null })}
              >
                {t("addSla")}
              </Button>
            ) : null}
          </div>
          <DataTable
            mode="client"
            caption={t("slaPoliciesCaption")}
            columns={slaTableColumns}
            rows={desk.sla_policies ?? []}
            getRowId={(row) => row.id}
            emptyTitle={t("noSlaPolicies")}
          />
        </div>
      </div>
    </Panel>
  );
}
