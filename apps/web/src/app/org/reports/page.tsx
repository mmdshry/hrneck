import { ReportsClient } from "./reports-client";

export const metadata = {
  title: "Reports",
  description:
    "Detailed organization analytics across company, people, campaigns, training, checklists, and ticketing.",
};

export default function ReportsPage() {
  return <ReportsClient />;
}
