import { TargetsClient } from "./targets-client";

export const instant = false;

export const metadata = {
  title: "Employees",
  description: "Manage employees, CSV import, and directory sync.",
};

export default function TargetsPage() {
  return <TargetsClient />;
}
