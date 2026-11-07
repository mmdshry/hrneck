import { CampaignsClient } from "./campaigns-client";

export const metadata = {
  title: "Campaigns",
  description: "Launch and track training campaigns for your organization.",
};

export default function CampaignsPage() {
  return <CampaignsClient />;
}
