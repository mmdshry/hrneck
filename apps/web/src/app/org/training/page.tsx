import dynamic from "next/dynamic";
import { MinimalLoader } from "@/components/ui/minimal-loader";

export const instant = false;

const TrainingHubClient = dynamic(
  () =>
    import("./training-hub-client").then((mod) => mod.TrainingHubClient),
  {
    loading: () => <MinimalLoader />,
  },
);

export const metadata = {
  title: "Training",
  description: "Assign courses to learners and track viewing progress.",
};

export default function TrainingPage() {
  return <TrainingHubClient />;
}
