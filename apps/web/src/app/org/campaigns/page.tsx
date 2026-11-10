import { redirect } from "next/navigation";

export const instant = false;

export const metadata = {
  title: "Campaigns",
  description: "Launch and track training campaigns for your organization.",
};

/** Canonical campaigns UI lives under Training; keep this path as a redirect. */
export default function CampaignsPage() {
  redirect("/org/training/campaigns");
}
