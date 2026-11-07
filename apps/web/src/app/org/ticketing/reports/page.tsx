import { ReportsClient } from "./reports-client";

export const metadata = {
  title: "Ticketing reports",
  description: "Service desk volume and SLA statistics.",
};

export default function TicketingReportsPage() {
  return <ReportsClient />;
}
