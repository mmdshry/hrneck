import { ChecklistsClient } from "./checklists-client";

export const metadata = {
  title: "Checklists",
  description: "Internal HR checklist templates for employee tracking.",
};

export default function ChecklistsPage() {
  return <ChecklistsClient />;
}
