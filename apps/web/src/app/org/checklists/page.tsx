import { ChecklistsClient } from "./checklists-client";

export const instant = false;

export const metadata = {
  title: "Checklists",
  description: "Internal HR checklist templates for employee tracking.",
};

export default function ChecklistsPage() {
  return <ChecklistsClient />;
}
