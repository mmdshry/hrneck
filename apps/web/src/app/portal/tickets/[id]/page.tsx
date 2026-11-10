import { PortalTicketDetailClient } from "./portal-ticket-detail-client";

export const instant = false;

export const metadata = {
  title: "Ticket",
  description: "Portal ticket detail.",
};

export default async function PortalTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalTicketDetailClient ticketId={Number(id)} />;
}
