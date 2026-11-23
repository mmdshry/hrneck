import { getTranslations } from "next-intl/server";
import { MfaSetupClient } from "./mfa-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.settings");
  return {
    title: t("accountMfa"),
  };
}
export default function MfaSetupPage() {
  return <MfaSetupClient />;
}
