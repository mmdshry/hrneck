import { OrgDashboardClient } from "./org-client";

export const metadata = {
  title: "Organization",
  description: "Tenant admin dashboard for campaigns, targets, training, and reports.",
};

export default function OrgAdminPage() {
  return <OrgDashboardClient />;
}
