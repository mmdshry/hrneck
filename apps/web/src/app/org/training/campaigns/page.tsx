import { TrainingCampaignsClient } from "./training-campaigns-client";

export const instant = false;

export const metadata = {
  title: "Training campaigns",
  description: "Assign courses and track training campaign metrics.",
};

export default function TrainingCampaignsPage() {
  return <TrainingCampaignsClient />;
}
