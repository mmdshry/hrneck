import { getTranslations } from "next-intl/server";
import { SendingProfilesClient } from "./sending-profiles-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.settings");
  return {
    title: t("sendingProfilesTitle"),
  };
}
export default function SendingProfilesPage() {
  return <SendingProfilesClient />;
}
