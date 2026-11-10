import { IntegrationsClient } from "./integrations-client";

export const instant = false;

export const metadata = {
  title: "Integrations",
  description: "SMTP and upcoming directory integrations.",
};

export default function IntegrationsPage() {
  return <IntegrationsClient />;
}
