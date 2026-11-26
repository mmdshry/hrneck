import { getTranslations } from "next-intl/server";
import { MfaSetupClient } from "@/app/org/settings/mfa/mfa-client";

export const instant = false;

export async function generateMetadata() {
  const t = await getTranslations("org.settings");
  return {
    title: t("accountMfa"),
  };
}

/** Employee copy of the account page: same component, without the org console settings link. */
export default function PortalAccountPage() {
  return <MfaSetupClient showSettingsLink={false} />;
}
