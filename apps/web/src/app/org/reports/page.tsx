import { ReportsClient } from "./reports-client";

export const instant = false;

export const metadata = {
  title: "Reports",
  description:
    "Detailed organization analytics across company, employees, campaigns, training, checklists, and ticketing.",
};

export default function ReportsPage() {
  return <ReportsClient />;
}
