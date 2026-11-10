import { ChecklistInstancesClient } from "./instances-client";

export const instant = false;

export const metadata = {
  title: "Checklist instances",
  description: "Fill and track HR checklists for employees.",
};

export default function ChecklistInstancesPage() {
  return <ChecklistInstancesClient />;
}
