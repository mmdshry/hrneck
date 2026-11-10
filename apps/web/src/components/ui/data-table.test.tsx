import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "./data-table";

afterEach(() => {
  cleanup();
});

describe("DataTable", () => {
  const rows = [
    { id: 1, name: "Alice", status: "active" },
    { id: 2, name: "Bob", status: "archived" },
  ];

  const columns = [
    { id: "name", header: "Name", accessorKey: "name" as const, cell: (r: (typeof rows)[0]) => r.name },
    {
      id: "status",
      header: "Status",
      accessorKey: "status" as const,
      filter: "select" as const,
      filterOptions: [
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
      cell: (r: (typeof rows)[0]) => r.status,
    },
  ];

  it("filters rows in client mode via global search", () => {
    render(
      <DataTable
        mode="client"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        caption="People"
      />,
    );

    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bob")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search table"), { target: { value: "bob" } });
    expect(screen.queryByText("Alice")).toBeNull();
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("calls onFilterStateChange in server mode", () => {
    const onChange = vi.fn();
    render(
      <DataTable
        mode="server"
        columns={columns}
        rows={rows}
        filterState={{ q: "", columnFilters: {}, sorting: [] }}
        onFilterStateChange={onChange}
        getRowId={(row) => row.id}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search table"), { target: { value: "a" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("shows filtered empty state", () => {
    render(
      <DataTable mode="client" columns={columns} rows={rows} getRowId={(row) => row.id} />,
    );
    fireEvent.change(screen.getByLabelText("Search table"), { target: { value: "zzz" } });
    expect(screen.getByText("No results for filters")).toBeTruthy();
  });
});
