import { getTranslations } from "next-intl/server";
import { TicketDetailClient } from "./ticket-detail-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.ticketing");
  return {
    title: t("ticketDetail"),
  };
}
export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketDetailClient ticketId={Number(id)} />;
}
