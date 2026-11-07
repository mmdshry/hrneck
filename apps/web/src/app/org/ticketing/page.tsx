import { TicketingQueueClient } from "./ticketing-queue-client";

export const metadata = {
  title: "Ticketing",
  description: "ITIL service desk tickets for incidents, problems, changes, and requests.",
};

export default function TicketingPage() {
  return <TicketingQueueClient />;
}
