import { getTranslations } from "next-intl/server";
import { PortalTicketsClient } from "./portal-tickets-client";

export async function generateMetadata() {
  const t = await getTranslations("portal");
  return {
    title: t("myTickets"),
    description: t("ticketsMetaDescription"),
  };
}

export default function PortalTicketsPage() {
  return <PortalTicketsClient />;
}
