import { getTranslations } from "next-intl/server";
import { EmailClient } from "./email-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.ticketing");
  return {
    title: t("email"),
    description: t("emailDescription"),
  };
}
export default function EmailPage() {
  return <EmailClient />;
}
