import { getTranslations } from "next-intl/server";
import { TicketingQueueClient } from "./ticketing-queue-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.ticketing");
  return {
    title: t("title"),
    description: t("description"),
  };
}
export default function TicketingPage() {
  return <TicketingQueueClient />;
}
