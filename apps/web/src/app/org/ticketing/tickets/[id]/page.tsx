import { TicketDetailClient } from "./ticket-detail-client";

export const instant = false;

export const metadata = {
  title: "Ticket",
  description: "Ticket detail and workflow.",
};

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetailClient ticketId={Number(id)} />;
}
