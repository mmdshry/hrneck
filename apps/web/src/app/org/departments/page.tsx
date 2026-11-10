import { DepartmentsClient } from "./departments-client";

export const instant = false;

export const metadata = {
  title: "Departments",
  description: "Create and manage departments for employee assignment.",
};

export default function DepartmentsPage() {
  return <DepartmentsClient />;
}
