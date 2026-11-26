import { getTranslations } from "next-intl/server";
import { PortalTicketDetailClient } from "./portal-ticket-detail-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("portal");
  return {
    title: t("ticket"),
    description: t("ticketDetailMetaDescription"),
  };
}

export default async function PortalTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PortalTicketDetailClient ticketId={Number(id)} />;
}
