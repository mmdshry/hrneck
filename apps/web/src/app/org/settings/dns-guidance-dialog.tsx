"use client";

import { useTranslations } from "next-intl";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";

export type Guidance = {
  domain: string;
  records: { type: string; host: string; value: string; purpose: string }[];
};

type DnsRecord = Guidance["records"][number];

type DnsGuidanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guidance: Guidance;
};

export function DnsGuidanceDialog({ open, onOpenChange, guidance }: DnsGuidanceDialogProps) {
  const t = useTranslations("org.settings");
  const tCommon = useTranslations("common");

  const columns: Array<DataTableColumn<DnsRecord>> = [
    {
      id: "type",
      header: tCommon("type"),
      accessorKey: "type",
      sticky: true,
      cell: (record) => record.type,
    },
    {
      id: "host",
      header: tCommon("host"),
      accessorKey: "host",
      cell: (record) => record.host,
    },
    {
      id: "value",
      header: tCommon("value"),
      accessorKey: "value",
      className: "max-w-md break-all",
      cell: (record) => record.value,
    },
    {
      id: "purpose",
      header: tCommon("purpose"),
      accessorKey: "purpose",
      className: "max-w-sm",
      cell: (record) => record.purpose,
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("dnsFor", { domain: guidance.domain })}
      size="xl"
      closeLabel={tCommon("close")}
    >
      <DataTable
        mode="client"
        caption={t("dnsCaption", { domain: guidance.domain })}
        columns={columns}
        rows={guidance.records}
        getRowId={(record) => `${record.type}-${record.host}-${record.value}`}
        emptyTitle={t("noDnsRecords")}
        emptyDescription={t("dnsGuidanceEmpty")}
      />
    </Dialog>
  );
}
