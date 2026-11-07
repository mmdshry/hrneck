import type { ReactNode } from "react";

export type ReportColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function ReportTable<T>({
  columns,
  rows,
  empty = "No rows yet.",
  onRowClick,
}: {
  columns: Array<ReportColumn<T>>;
  rows: T[];
  empty?: string;
  onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted-foreground)]">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--muted)]/40 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 font-medium ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className={`border-t border-[var(--border)] ${
                onRowClick ? "cursor-pointer hover:bg-[var(--muted)]/30" : ""
              }`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2 align-top ${col.className ?? ""}`}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
